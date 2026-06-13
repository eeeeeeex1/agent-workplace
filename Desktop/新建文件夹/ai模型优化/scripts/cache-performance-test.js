const https = require('https');
const crypto = require('crypto');

const apiKey = 'sk-KaiJT0Mf6JjRGGYUoXUYdFgLW6cTT6ZvZUlLwNXy0gbGkP9X';
const model = 'claude-opus-4-8';

const cache = new Map();
let cacheHits = 0;
let cacheMisses = 0;
const cacheTimes = [];
const apiTimes = [];

function generateCacheKey(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function callClaude(messages, maxTokens = 100, useCache = true) {
  const requestData = {
    model: model,
    messages: messages,
    max_tokens: maxTokens,
    temperature: 0.7
  };
  
  const cacheKey = generateCacheKey(requestData);
  
  if (useCache && cache.has(cacheKey)) {
    cacheHits++;
    const start = Date.now();
    const result = cache.get(cacheKey);
    cacheTimes.push(Date.now() - start);
    return { ...result, fromCache: true };
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
        'Content-Length': Buffer.byteLength(JSON.stringify(requestData))
      }
    };

    const start = Date.now();
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const time = Date.now() - start;
        apiTimes.push(time);
        try {
          const response = JSON.parse(data);
          cache.set(cacheKey, response);
          resolve({ ...response, fromCache: false, responseTime: time });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(requestData));
    req.end();
  });
}

async function runCacheTest() {
  console.log('=== Cache Performance Test ===\n');
  
  const testQueries = [
    'What is artificial intelligence?',
    'Explain machine learning in simple terms.',
    'What is the difference between AI and ML?',
    'What is deep learning?',
    'What is artificial intelligence?',
    'Explain machine learning in simple terms.',
    'How does neural network work?',
    'What is artificial intelligence?',
    'What is the difference between AI and ML?',
    'Explain machine learning in simple terms.',
  ];
  
  console.log(`Total queries: ${testQueries.length}`);
  console.log('');
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`Query ${i + 1}: "${query}"`);
    
    const response = await callClaude([{ role: 'user', content: query }], 150, true);
    
    console.log(`  Cache: ${response.fromCache ? 'HIT' : 'MISS'}`);
    console.log(`  Time: ${response.responseTime || '<1'}ms`);
    console.log('');
  }
  
  const total = cacheHits + cacheMisses;
  const hitRate = ((cacheHits / total) * 100).toFixed(2);
  const avgCacheTime = cacheTimes.length > 0 ? (cacheTimes.reduce((a, b) => a + b, 0) / cacheTimes.length).toFixed(2) : 0;
  const avgApiTime = apiTimes.length > 0 ? (apiTimes.reduce((a, b) => a + b, 0) / apiTimes.length).toFixed(2) : 0;
  const speedup = avgApiTime > 0 ? (avgApiTime / avgCacheTime).toFixed(2) : 'N/A';
  
  console.log('=== Results ===');
  console.log(`Total requests:     ${total}`);
  console.log(`Cache hits:         ${cacheHits}`);
  console.log(`Cache misses:       ${cacheMisses}`);
  console.log(`Hit rate:           ${hitRate}%`);
  console.log('');
  console.log(`Avg cache time:     ${avgCacheTime}ms`);
  console.log(`Avg API time:       ${avgApiTime}ms`);
  console.log(`Speed improvement:  ${speedup}x faster`);
}

runCacheTest().catch(e => console.error('Error:', e.message));