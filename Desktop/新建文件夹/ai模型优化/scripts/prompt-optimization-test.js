const CHARS_PER_TOKEN = 3.5;
const MESSAGE_OVERHEAD = 4;
const ROLE_OVERHEAD = 2;

class TokenEstimator {
  estimateTokenCount(text) {
    return Math.ceil(String(text || '').length / CHARS_PER_TOKEN);
  }

  estimateMessageTokenCount(message) {
    return this.estimateTokenCount(message.content) + MESSAGE_OVERHEAD + ROLE_OVERHEAD;
  }

  estimateMessagesTokenCount(messages) {
    return messages.reduce((total, message) => total + this.estimateMessageTokenCount(message), 0);
  }
}

class PromptOptimizer {
  constructor() {
    this.estimator = new TokenEstimator();
    this.templates = new Map();
    this.prefixCache = new Map();
    this.lastPromptByBucket = new Map();
  }

  optimize(request) {
    const bucket = this.getBucket(request);
    const originalTokens = this.estimator.estimateMessagesTokenCount(request.messages);
    const messages = this.normalizeMessages(request.messages);
    const normalizedTokens = this.estimator.estimateMessagesTokenCount(messages);
    const templateCachedTokens = this.getTemplateCachedTokens(bucket, messages);
    const prefixCachedTokens = this.getPrefixCachedTokens(bucket, messages);
    const deltaMessages = this.buildDeltaMessages(bucket, messages);
    const deltaTokens = this.estimator.estimateMessagesTokenCount(deltaMessages);
    const previous = this.lastPromptByBucket.get(bucket);

    this.insertPrefix(bucket, messages);
    this.lastPromptByBucket.set(bucket, messages);

    const reusableTokens = Math.max(templateCachedTokens, prefixCachedTokens);
    const deltaSavedTokens = previous ? Math.max(0, normalizedTokens - deltaTokens) : 0;
    const estimatedSavedTokens = Math.max(0, originalTokens - normalizedTokens) + reusableTokens + deltaSavedTokens;

    return {
      bucket,
      originalTokens,
      normalizedTokens,
      templateCachedTokens,
      prefixCachedTokens,
      deltaTokens,
      estimatedSavedTokens,
      estimatedSavingRate: originalTokens > 0 ? `${((estimatedSavedTokens / originalTokens) * 100).toFixed(2)}%` : '0.00%',
    };
  }

  registerTemplate(bucket, id, messages) {
    const normalized = this.normalizeMessages(messages);
    this.templates.set(`${bucket}:${id}`, {
      bucket,
      messages: normalized,
      tokenCount: this.estimator.estimateMessagesTokenCount(normalized),
    });
  }

  normalizeMessages(messages) {
    return messages.map((message) => ({ ...message, content: this.normalizeContent(message.content) }));
  }

  normalizeContent(content) {
    return String(content || '')
      .replace(/\r\n/g, '\n')
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+([,.;:!?，。；：！？])/g, '$1')
      .replace(/([([{（【])\s+/g, '$1')
      .replace(/\s+([)\]}）】])/g, '$1')
      .trim();
  }

  getTemplateCachedTokens(bucket, messages) {
    let best = 0;
    for (const template of this.templates.values()) {
      if (template.bucket === bucket && this.startsWith(messages, template.messages)) {
        best = Math.max(best, template.tokenCount);
      }
    }
    return best;
  }

  getPrefixCachedTokens(bucket, messages) {
    const cached = this.prefixCache.get(bucket) || [];
    let best = 0;
    for (const prefix of cached) {
      if (this.startsWith(messages, prefix.messages)) {
        best = Math.max(best, prefix.tokenCount);
      }
    }
    return best;
  }

  insertPrefix(bucket, messages) {
    const cached = this.prefixCache.get(bucket) || [];
    for (let i = 1; i <= messages.length; i++) {
      const prefix = messages.slice(0, i);
      cached.push({
        messages: prefix,
        tokenCount: this.estimator.estimateMessagesTokenCount(prefix),
        lastUsed: Date.now(),
        hits: 1,
      });
    }
    cached.sort((a, b) => (b.hits - a.hits) || (b.lastUsed - a.lastUsed));
    this.prefixCache.set(bucket, cached.slice(0, 256));
  }

  buildDeltaMessages(bucket, messages) {
    const previous = this.lastPromptByBucket.get(bucket);
    if (!previous) return messages;

    let commonPrefixLength = 0;
    while (
      commonPrefixLength < previous.length &&
      commonPrefixLength < messages.length &&
      previous[commonPrefixLength].role === messages[commonPrefixLength].role &&
      previous[commonPrefixLength].content === messages[commonPrefixLength].content
    ) {
      commonPrefixLength++;
    }

    const delta = messages.slice(commonPrefixLength);
    if (delta.length === 0) {
      return [{ role: 'user', content: '[DELTA_PROMPT] No new prompt content. Reuse previous context.' }];
    }
    return [{ role: 'system', content: `[DELTA_PROMPT] Reuse the first ${commonPrefixLength} messages from the previous prompt context.` }, ...delta];
  }

  startsWith(messages, prefix) {
    if (prefix.length > messages.length) return false;
    return prefix.every((message, index) => message.role === messages[index].role && message.content === messages[index].content);
  }

  getBucket(request) {
    const temp = request.temperature === undefined ? 'default' : request.temperature;
    const topP = request.topP === undefined ? 'default' : request.topP;
    const maxTokens = request.maxTokens === undefined ? 'default' : request.maxTokens;
    return `${request.model}|temp:${temp}|topP:${topP}|max:${maxTokens}`;
  }
}

function createBaseMessages(extraWhitespace = false) {
  const gap = extraWhitespace ? '     ' : ' ';
  return [
    {
      role: 'system',
      content: `你是一个${gap}专业的代码审查助手。\n\n\n请保持输出结构清晰，指出风险、原因和修复建议。`,
    },
    {
      role: 'user',
      content: `请审查以下 TypeScript 代码：\n\nfunction add(a:number,b:number){${gap}return a+b${gap}; }`,
    },
  ];
}

function createRequests() {
  const requests = [];
  const baseTemplate = createBaseMessages(true);

  for (let i = 0; i < 20; i++) {
    requests.push({
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 1024,
      messages: [
        ...baseTemplate,
        {
          role: 'user',
          content: `补充审查点：第 ${i + 1} 个文件需要关注异常处理、日志脱敏和边界条件。`,
        },
      ],
    });
  }

  for (let i = 0; i < 10; i++) {
    requests.push({
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1024,
      messages: [
        { role: 'system', content: '你是一个需求分析助手。' },
        { role: 'user', content: `请把这个需求拆成任务：模块 ${i + 1} 需要支持缓存、限流、审计日志。` },
      ],
    });
  }

  return requests;
}

function getBucket(request) {
  const temp = request.temperature === undefined ? 'default' : request.temperature;
  const topP = request.topP === undefined ? 'default' : request.topP;
  const maxTokens = request.maxTokens === undefined ? 'default' : request.maxTokens;
  return `${request.model}|temp:${temp}|topP:${topP}|max:${maxTokens}`;
}

function run() {
  const optimizer = new PromptOptimizer();
  const requests = createRequests();
  const templateRequest = {
    model: 'gpt-4o',
    temperature: 0.2,
    maxTokens: 1024,
    messages: createBaseMessages(true),
  };

  optimizer.registerTemplate(getBucket(templateRequest), 'code-review', templateRequest.messages);

  const totals = {
    originalTokens: 0,
    normalizedTokens: 0,
    templateCachedTokens: 0,
    prefixCachedTokens: 0,
    deltaTokens: 0,
    estimatedSavedTokens: 0,
  };

  const rows = requests.map((request, index) => {
    const result = optimizer.optimize(request);
    totals.originalTokens += result.originalTokens;
    totals.normalizedTokens += result.normalizedTokens;
    totals.templateCachedTokens += result.templateCachedTokens;
    totals.prefixCachedTokens += result.prefixCachedTokens;
    totals.deltaTokens += result.deltaTokens;
    totals.estimatedSavedTokens += result.estimatedSavedTokens;

    return {
      index: index + 1,
      original: result.originalTokens,
      normalized: result.normalizedTokens,
      templateCached: result.templateCachedTokens,
      prefixCached: result.prefixCachedTokens,
      delta: result.deltaTokens,
      saved: result.estimatedSavedTokens,
      savingRate: result.estimatedSavingRate,
    };
  });

  const normalizedSaved = totals.originalTokens - totals.normalizedTokens;
  const reuseSaved = Math.max(totals.templateCachedTokens, totals.prefixCachedTokens);
  const deltaSaved = totals.normalizedTokens - totals.deltaTokens;
  const totalEffectiveSaved = normalizedSaved + reuseSaved + deltaSaved;
  const savingRate = totals.originalTokens > 0 ? ((totalEffectiveSaved / totals.originalTokens) * 100).toFixed(2) : '0.00';

  console.log('=== Prompt Token Optimization Test ===');
  console.log(`Requests: ${requests.length}`);
  console.log(`Original tokens: ${totals.originalTokens}`);
  console.log(`After normalization tokens: ${totals.normalizedTokens}`);
  console.log(`Normalization saved: ${normalizedSaved}`);
  console.log(`Template cached tokens: ${totals.templateCachedTokens}`);
  console.log(`Trie/LRU-K prefix cached tokens: ${totals.prefixCachedTokens}`);
  console.log(`Delta prompt tokens: ${totals.deltaTokens}`);
  console.log(`Delta saved tokens: ${deltaSaved}`);
  console.log(`Estimated effective saved tokens: ${totalEffectiveSaved}`);
  console.log(`Estimated saving rate: ${savingRate}%`);
  console.log('\nDetails:');
  console.table(rows);
}

run();
