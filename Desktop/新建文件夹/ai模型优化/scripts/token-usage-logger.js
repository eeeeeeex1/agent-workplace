const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHARS_PER_TOKEN = 3.5;
const MESSAGE_OVERHEAD = 4;
const ROLE_OVERHEAD = 2;
const DEFAULT_LOG_DIR = path.join(process.cwd(), 'logs', 'token-usage');

function estimateTextTokens(text) {
  return Math.ceil(String(text || '').length / CHARS_PER_TOKEN);
}

function estimateMessageTokens(message) {
  return estimateTextTokens(message.content) + MESSAGE_OVERHEAD + ROLE_OVERHEAD;
}

function estimateMessagesTokens(messages) {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

function getArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  if (!filePath) return fallback;
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function resolveLogFile(date = getToday()) {
  const logDir = path.resolve(getArg('log-dir', DEFAULT_LOG_DIR));
  ensureDir(logDir);
  return path.join(logDir, `${date}.jsonl`);
}

function parseMessages() {
  const messagesFile = getArg('messages-file');
  const messagesJson = getArg('messages');
  const prompt = getArg('prompt');

  if (messagesFile) return readJson(messagesFile, []);
  if (messagesJson) return JSON.parse(messagesJson);
  if (prompt) return [{ role: 'user', content: prompt }];

  return [];
}

function parseResponseText() {
  const responseFile = getArg('response-file');
  const completion = getArg('completion', '');

  if (!responseFile) return completion;

  const parsed = readJson(responseFile, null);
  if (typeof parsed === 'string') return parsed;
  if (parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
    return parsed.choices[0].message.content || '';
  }
  if (parsed && typeof parsed.content === 'string') return parsed.content;

  return JSON.stringify(parsed || '');
}

function buildRecord() {
  const date = getArg('date', getToday());
  const model = getArg('model', 'unknown-model');
  const provider = getArg('provider', 'unknown-provider');
  const requestId = getArg('request-id', crypto.randomUUID());
  const user = getArg('user', 'default');
  const messages = parseMessages();
  const completionText = parseResponseText();
  const promptTokens = Number(getArg('prompt-tokens', estimateMessagesTokens(messages)));
  const completionTokens = Number(getArg('completion-tokens', estimateTextTokens(completionText)));
  const totalTokens = Number(getArg('total-tokens', promptTokens + completionTokens));

  return {
    timestamp: new Date().toISOString(),
    date,
    requestId,
    user,
    provider,
    model,
    tokenUsage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
    request: {
      messageCount: messages.length,
      priority: getArg('priority', 'normal'),
    },
    meta: {
      source: getArg('source', 'manual'),
      note: getArg('note', ''),
    },
  };
}

function appendRecord() {
  const record = buildRecord();
  const logFile = resolveLogFile(record.date);
  fs.appendFileSync(logFile, `${JSON.stringify(record)}\n`, 'utf8');

  console.log('Token usage recorded.');
  console.log(`Log file: ${logFile}`);
  console.log(`Request: ${record.requestId}`);
  console.log(`Prompt tokens: ${record.tokenUsage.promptTokens}`);
  console.log(`Completion tokens: ${record.tokenUsage.completionTokens}`);
  console.log(`Total tokens: ${record.tokenUsage.totalTokens}`);
}

function readRecords(date) {
  const logFile = resolveLogFile(date);
  if (!fs.existsSync(logFile)) return [];

  return fs
    .readFileSync(logFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function summarize(records) {
  const summary = {
    requestCount: records.length,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    byModel: {},
    byProvider: {},
    byUser: {},
    requests: [],
  };

  for (const record of records) {
    const usage = record.tokenUsage || {};
    const promptTokens = Number(usage.promptTokens || 0);
    const completionTokens = Number(usage.completionTokens || 0);
    const totalTokens = Number(usage.totalTokens || promptTokens + completionTokens);

    summary.promptTokens += promptTokens;
    summary.completionTokens += completionTokens;
    summary.totalTokens += totalTokens;

    addGroup(summary.byModel, record.model, promptTokens, completionTokens, totalTokens);
    addGroup(summary.byProvider, record.provider, promptTokens, completionTokens, totalTokens);
    addGroup(summary.byUser, record.user, promptTokens, completionTokens, totalTokens);

    summary.requests.push({
      timestamp: record.timestamp,
      requestId: record.requestId,
      provider: record.provider,
      model: record.model,
      user: record.user,
      promptTokens,
      completionTokens,
      totalTokens,
    });
  }

  return summary;
}

function addGroup(groups, key, promptTokens, completionTokens, totalTokens) {
  const name = key || 'unknown';
  if (!groups[name]) {
    groups[name] = { requestCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  groups[name].requestCount += 1;
  groups[name].promptTokens += promptTokens;
  groups[name].completionTokens += completionTokens;
  groups[name].totalTokens += totalTokens;
}

function writeReport() {
  const date = getArg('date', getToday());
  const records = readRecords(date);
  const summary = summarize(records);
  const logDir = path.resolve(getArg('log-dir', DEFAULT_LOG_DIR));
  const reportFile = path.join(logDir, `${date}-summary.json`);

  ensureDir(logDir);
  fs.writeFileSync(reportFile, JSON.stringify({ date, ...summary }, null, 2), 'utf8');

  console.log(`Token usage report for ${date}`);
  console.log(`Requests: ${summary.requestCount}`);
  console.log(`Prompt tokens: ${summary.promptTokens}`);
  console.log(`Completion tokens: ${summary.completionTokens}`);
  console.log(`Total tokens: ${summary.totalTokens}`);
  console.log(`Report file: ${reportFile}`);

  if (hasFlag('details')) {
    console.table(summary.requests);
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/token-usage-logger.js record --model gpt-4o --prompt "hello" --completion "hi"
  node scripts/token-usage-logger.js record --provider openai --model gpt-4o --messages-file request.json --response-file response.json
  node scripts/token-usage-logger.js report --date 2026-06-13 --details

Commands:
  record   Record one request token usage into logs/token-usage/YYYY-MM-DD.jsonl
  report   Generate logs/token-usage/YYYY-MM-DD-summary.json

Useful options:
  --date YYYY-MM-DD
  --provider NAME
  --model NAME
  --request-id ID
  --user NAME
  --prompt TEXT
  --completion TEXT
  --messages JSON_ARRAY
  --messages-file FILE
  --response-file FILE
  --prompt-tokens NUMBER
  --completion-tokens NUMBER
  --total-tokens NUMBER
  --log-dir DIR
  --details
`);
}

function main() {
  const command = process.argv[2];

  if (command === 'record') {
    appendRecord();
    return;
  }

  if (command === 'report') {
    writeReport();
    return;
  }

  printHelp();
}

main();
