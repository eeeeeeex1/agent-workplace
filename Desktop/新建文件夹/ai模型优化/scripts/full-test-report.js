const https = require('https');
const crypto = require('crypto');

const apiKey = process.env.VIVA_API_KEY || process.env.VIVA_CLAUDE_API_KEY || '';
const apiUrl = 'https://www.vivaapi.cn/v1/messages';
const model = 'claude-opus-4-8';

const cache = new Map();
let cacheHits = 0;
let cacheMisses = 0;
const results = {
  tokenTests: [],
  cacheTests: [],
  historyTests: []
};

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

function generateLongText(targetTokens) {
  const sentences = [
    'Artificial intelligence is transforming the way we live and work.',
    'Machine learning algorithms can analyze vast amounts of data quickly.',
    'Natural language processing enables computers to understand human language.',
    'Deep learning models have achieved remarkable results in image recognition.',
    'Neural networks are inspired by the structure of the human brain.',
    'Computer vision technology allows machines to see and interpret visual information.',
    'Big data analytics provides valuable insights from large datasets.',
    'Cloud computing offers scalable resources for running AI models.',
    'Edge computing brings AI processing closer to the source of data.',
    'Reinforcement learning trains agents through trial and error.'
  ];
  
  let result = '';
  const targetLength = targetTokens * 3.5;
  while (result.length < targetLength) {
    result += sentences[Math.floor(Math.random() * sentences.length)] + ' ';
  }
  return result.trim();
}

async function testTokenTrimming() {
  console.log('\n' + '='.repeat(60));
  console.log('TOKEN TRIMMING TEST');
  console.log('='.repeat(60) + '\n');
  
  const testCases = [
    { name: 'Small (50 tokens)', targetTokens: 50, maxResponseTokens: 100 },
    { name: 'Medium (500 tokens)', targetTokens: 500, maxResponseTokens: 200 },
    { name: 'Large (1500 tokens)', targetTokens: 1500, maxResponseTokens: 300 },
    { name: 'Extra Large (3000 tokens)', targetTokens: 3000, maxResponseTokens: 400 },
  ];

  for (const testCase of testCases) {
    console.log(`Test Case: ${testCase.name}`);
    console.log('─'.repeat(40));
    
    const longText = generateLongText(testCase.targetTokens);
    const estimatedTokens = estimateTokenCount(longText);
    
    console.log(`Input text length: ${longText.length} characters`);
    console.log(`Estimated input tokens: ${estimatedTokens}`);
    
    const requestData = JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: longText }],
      max_tokens: testCase.maxResponseTokens,
      temperature: 0.7
    });
    
    const startTime = Date.now();
    try {
      const response = await callAPI(requestData, false);
      const responseTime = Date.now() - startTime;
      
      const content = response.content?.find(c => c.type === 'text')?.text || '';
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      
      results.tokenTests.push({
        name: testCase.name,
        estimatedTokens,
        actualInputTokens: inputTokens,
        outputTokens,
        responseTime,
        responseLength: content.length
      });
      
      console.log(`Actual input tokens: ${inputTokens}`);
      console.log(`Output tokens: ${outputTokens}`);
      console.log(`Response time: ${responseTime}ms`);
      console.log(`Response length: ${content.length} characters`);
      console.log('Sample response:', content.substring(0, 80) + '...');
      
    } catch (error) {
      console.log(`ERROR: ${error.message}`);
      results.tokenTests.push({
        name: testCase.name,
        error: error.message
      });
    }
    
    console.log('');
  }
}

async function testCacheHitRate() {
  console.log('='.repeat(60));
  console.log('CACHE HIT RATE TEST');
  console.log('='.repeat(60) + '\n');
  
  cacheHits = 0;
  cacheMisses = 0;
  cache.clear();
  
  const testMessages = [
    { text: 'Explain what artificial intelligence is.', category: 'AI' },
    { text: 'What is machine learning?', category: 'AI' },
    { text: 'How does deep learning work?', category: 'AI' },
    { text: 'Explain what artificial intelligence is.', category: 'AI (repeat)' },
    { text: 'What is machine learning?', category: 'AI (repeat)' },
    { text: 'Write a Python function for factorial.', category: 'Code' },
    { text: 'Explain what artificial intelligence is.', category: 'AI (repeat x2)' },
    { text: 'How does quantum computing differ from classical computing?', category: 'Quantum' },
    { text: 'What is machine learning?', category: 'AI (repeat x2)' },
    { text: 'Write a Python function for factorial.', category: 'Code (repeat)' },
  ];
  
  console.log(`Total requests: ${testMessages.length}`);
  console.log('');
  
  let totalTimeWithCache = 0;
  let totalTimeWithoutCache = 0;
  
  for (let i = 0; i < testMessages.length; i++) {
    const requestData = JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: testMessages[i].text }],
      max_tokens: 200,
      temperature: 0.7
    });
    
    const startTime = Date.now();
    try {
      const response = await callAPI(requestData, true);
      const responseTime = Date.now() - startTime;
      
      if (response.fromCache) {
        totalTimeWithCache += responseTime;
      } else {
        totalTimeWithoutCache += responseTime;
      }
      
      results.cacheTests.push({
        request: testMessages[i].text.substring(0, 40) + '...',
        category: testMessages[i].category,
        fromCache: response.fromCache,
        responseTime
      });
      
      console.log(`Request ${i + 1}: ${testMessages[i].category}`);
      console.log(`  Text: "${testMessages[i].text.substring(0, 45)}${testMessages[i].text.length > 45 ? '...' : ''}"`);
      console.log(`  From cache: ${response.fromCache ? '✓ YES' : '✗ NO'}`);
      console.log(`  Response time: ${responseTime}ms`);
      
    } catch (error) {
      console.log(`Request ${i + 1}: ERROR - ${error.message}`);
    }
    
    console.log('');
  }
  
  const totalRequests = cacheHits + cacheMisses;
  const hitRate = totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(2) : '0';
  const avgCacheTime = cacheHits > 0 ? (totalTimeWithCache / cacheHits).toFixed(2) : '0';
  const avgNonCacheTime = cacheMisses > 0 ? (totalTimeWithoutCache / cacheMisses).toFixed(2) : '0';
  const speedup = parseFloat(avgNonCacheTime) > 0 ? (parseFloat(avgNonCacheTime) / parseFloat(avgCacheTime)).toFixed(2) : 'N/A';
  
  console.log('='.repeat(40));
  console.log('CACHE STATISTICS');
  console.log('='.repeat(40));
  console.log(`Total requests:         ${totalRequests}`);
  console.log(`Cache hits:            ${cacheHits}`);
  console.log(`Cache misses:          ${cacheMisses}`);
  console.log(`Cache hit rate:        ${hitRate}%`);
  console.log(`Cache entries:         ${cache.size}`);
  console.log('');
  console.log(`Avg time (cache hit):  ${avgCacheTime}ms`);
  console.log(`Avg time (no cache):   ${avgNonCacheTime}ms`);
  console.log(`Speedup factor:        ${speedup}x faster`);
  console.log('');
}

async function testConversationHistory() {
  console.log('='.repeat(60));
  console.log('CONVERSATION HISTORY TRIMMING TEST');
  console.log('='.repeat(60) + '\n');
  
  const testCases = [
    { name: '5 message pairs', count: 5 },
    { name: '10 message pairs', count: 10 },
    { name: '15 message pairs', count: 15 },
    { name: '20 message pairs', count: 20 },
  ];
  
  for (const testCase of testCases) {
    console.log(`Test Case: ${testCase.name}`);
    console.log('─'.repeat(40));
    
    const messages = [];
    for (let i = 1; i <= testCase.count; i++) {
      messages.push({ role: 'user', content: `User question ${i}: What is AI ${i}?` });
      messages.push({ role: 'assistant', content: `Assistant answer ${i}: AI ${i} stands for Artificial Intelligence ${i}.` });
    }
    
    const totalChars = JSON.stringify(messages).length;
    const estimatedTokens = estimateTokenCount(JSON.stringify(messages));
    
    console.log(`Total messages: ${messages.length}`);
    console.log(`Total characters: ${totalChars}`);
    console.log(`Estimated tokens: ${estimatedTokens}`);
    
    const requestData = JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 150,
      temperature: 0.7
    });
    
    const startTime = Date.now();
    try {
      const response = await callAPI(requestData, false);
      const responseTime = Date.now() - startTime;
      
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      const content = response.content?.find(c => c.type === 'text')?.text || '';
      
      results.historyTests.push({
        name: testCase.name,
        messageCount: messages.length,
        estimatedTokens,
        actualInputTokens: inputTokens,
        outputTokens,
        responseTime
      });
      
      console.log(`Actual input tokens: ${inputTokens}`);
      console.log(`Output tokens: ${outputTokens}`);
      console.log(`Response time: ${responseTime}ms`);
      console.log(`Response preview: ${content.substring(0, 80)}...`);
      
    } catch (error) {
      console.log(`ERROR: ${error.message}`);
    }
    
    console.log('');
  }
}

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST REPORT SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  console.log('1. TOKEN TRIMMING RESULTS');
  console.log('─'.repeat(40));
  console.log('| Test Case           | Estimated | Actual Input | Output | Time(ms) |');
  console.log('|---------------------|-----------|--------------|--------|----------|');
  results.tokenTests.forEach(test => {
    if (!test.error) {
      console.log(`| ${test.name.padEnd(19)} | ${test.estimatedTokens.toString().padStart(9)} | ${test.actualInputTokens.toString().padStart(12)} | ${test.outputTokens.toString().padStart(6)} | ${test.responseTime.toString().padStart(8)} |`);
    }
  });
  console.log('');
  
  console.log('2. CACHE PERFORMANCE');
  console.log('─'.repeat(40));
  const totalRequests = cacheHits + cacheMisses;
  const hitRate = totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(2) : '0';
  console.log(`Cache Hit Rate: ${hitRate}% (${cacheHits}/${totalRequests})`);
  console.log(`Cache Efficiency: ${hitRate >= 50 ? '✓ GOOD' : hitRate >= 30 ? '~ FAIR' : '✗ POOR'}`);
  console.log('');
  
  console.log('3. CONVERSATION HISTORY');
  console.log('─'.repeat(40));
  console.log('| Messages | Estimated Tokens | Actual Tokens |');
  console.log('|----------|------------------|---------------|');
  results.historyTests.forEach(test => {
    console.log(`| ${test.messageCount.toString().padStart(8)} | ${test.estimatedTokens.toString().padStart(16)} | ${test.actualInputTokens.toString().padStart(13)} |`);
  });
  console.log('');
  
  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('COMPREHENSIVE LLM OPTIMIZATION TEST SUITE');
  console.log('='.repeat(60));
  console.log('Model: Claude Opus 4.8');
  console.log('API: Viva API');
  console.log('='.repeat(60));
  
  await testTokenTrimming();
  await testCacheHitRate();
  await testConversationHistory();
  generateReport();
}

runAllTests().catch(error => {
  console.error('\nTEST FAILED:', error.message);
  process.exit(1);
});