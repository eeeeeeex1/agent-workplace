const https = require('https');
const crypto = require('crypto');

const apiKey = 'sk-KaiJT0Mf6JjRGGYUoXUYdFgLW6cTT6ZvZUlLwNXy0gbGkP9X';
const apiUrl = 'https://www.vivaapi.cn/v1/messages';
const model = 'claude-opus-4-8';

const cache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

function generateCacheKey(requestData) {
  return crypto.createHash('md5').update(requestData).digest('hex');
}

async function callAPI(requestData, useCache = true) {
  const cacheKey = generateCacheKey(requestData);
  
  if (useCache && cache.has(cacheKey)) {
    cacheHits++;
    return { ...cache.get(cacheKey), fromCache: true };
  }
  
  cacheMisses++;
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.vivaapi.cn',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          cache.set(cacheKey, response);
          resolve({ ...response, fromCache: false });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

function estimateTokenCount(text) {
  return Math.ceil(text.length / 3.5);
}

function generateLongText(length) {
  const words = ['Hello', 'world', 'this', 'is', 'a', 'test', 'message', 'for', 'token', 'trimming', 
                 'optimization', 'performance', 'testing', 'cache', 'hit', 'rate', 'memory', 'usage'];
  let result = '';
  for (let i = 0; i < length; i += 10) {
    result += words[i % words.length] + ' ';
  }
  return result.trim();
}

async function testTokenTrimming() {
  console.log('=== Token Trimming Test ===\n');
  
  const testCases = [
    { name: 'Short message', tokens: 50 },
    { name: 'Medium message', tokens: 500 },
    { name: 'Long message', tokens: 2000 },
    { name: 'Very long message', tokens: 5000 },
  ];

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log(`  Target tokens: ${testCase.name}`);
    
    const longText = generateLongText(testCase.tokens * 3.5);
    const estimatedTokens = estimateTokenCount(longText);
    
    console.log(`  Generated text length: ${longText.length} chars`);
    console.log(`  Estimated tokens: ${estimatedTokens}`);
    
    const requestData = JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: longText }],
      max_tokens: 500,
      temperature: 0.7
    });
    
    const startTime = Date.now();
    const response = await callAPI(requestData, false);
    const responseTime = Date.now() - startTime;
    
    const content = response.content?.find(c => c.type === 'text')?.text || '';
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    
    console.log(`  Actual input tokens: ${inputTokens}`);
    console.log(`  Output tokens: ${outputTokens}`);
    console.log(`  Response time: ${responseTime}ms`);
    console.log(`  Response length: ${content.length} chars`);
    console.log('');
  }
}

async function testCacheHitRate() {
  console.log('=== Cache Hit Rate Test ===\n');
  
  cacheHits = 0;
  cacheMisses = 0;
  cache.clear();
  
  const testMessages = [
    'Hello, how are you?',
    'What is machine learning?',
    'Explain quantum computing',
    'Hello, how are you?',
    'What is machine learning?',
    'Write a short poem',
    'Hello, how are you?',
    'Explain quantum computing',
  ];
  
  console.log(`Total requests: ${testMessages.length}`);
  console.log('');
  
  for (let i = 0; i < testMessages.length; i++) {
    const requestData = JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: testMessages[i] }],
      max_tokens: 200,
      temperature: 0.7
    });
    
    const startTime = Date.now();
    const response = await callAPI(requestData, true);
    const responseTime = Date.now() - startTime;
    
    console.log(`Request ${i + 1}: "${testMessages[i].substring(0, 30)}${testMessages[i].length > 30 ? '...' : ''}"`);
    console.log(`  From cache: ${response.fromCache ? 'YES' : 'NO'}`);
    console.log(`  Response time: ${responseTime}ms`);
    console.log('');
  }
  
  const totalRequests = cacheHits + cacheMisses;
  const hitRate = totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(2) : '0';
  
  console.log('=== Cache Statistics ===');
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Cache hits: ${cacheHits}`);
  console.log(`Cache misses: ${cacheMisses}`);
  console.log(`Cache hit rate: ${hitRate}%`);
  console.log(`Cache entries: ${cache.size}`);
  console.log('');
}

async function testConversationHistory() {
  console.log('=== Conversation History Trimming Test ===\n');
  
  const baseMessage = 'This is message ';
  const messages = [];
  
  for (let i = 1; i <= 20; i++) {
    messages.push({ role: 'user', content: baseMessage + i });
    messages.push({ role: 'assistant', content: `Response to message ${i}` });
  }
  
  console.log(`Total messages: ${messages.length}`);
  console.log(`Estimated total tokens: ${estimateTokenCount(JSON.stringify(messages))}`);
  
  const requestData = JSON.stringify({
    model: model,
    messages: messages,
    max_tokens: 100,
    temperature: 0.7
  });
  
  const response = await callAPI(requestData, false);
  const inputTokens = response.usage?.input_tokens || 0;
  
  console.log(`Actual input tokens sent: ${inputTokens}`);
  console.log('');
  
  const content = response.content?.find(c => c.type === 'text')?.text || '';
  console.log('Response:', content.substring(0, 150) + (content.length > 150 ? '...' : ''));
  console.log('');
}

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('COMPREHENSIVE LLM OPTIMIZATION TEST SUITE');
  console.log('='.repeat(60));
  console.log('\n');
  
  await testTokenTrimming();
  await testCacheHitRate();
  await testConversationHistory();
  
  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

runAllTests().catch(error => {
  console.error('Test failed:', error.message);
  process.exit(1);
});