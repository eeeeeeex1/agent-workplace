const https = require('https');

const apiKey = 'sk-KaiJT0Mf6JjRGGYUoXUYdFgLW6cTT6ZvZUlLwNXy0gbGkP9X';

async function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7
    });

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
        const response = JSON.parse(data);
        const text = response.content?.find(c => c.type === 'text')?.text || '';
        resolve({ model: 'Claude Opus 4.8', response: text, usage: response.usage });
      });
    });

    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

async function callGPT(prompt) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7
    });

    const options = {
      hostname: 'www.vivaapi.cn',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const response = JSON.parse(data);
        const text = response.choices?.[0]?.message?.content || '';
        resolve({ model: 'GPT-5.5', response: text, usage: response.usage });
      });
    });

    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

async function runTest() {
  console.log('=== Multi-Model Compatibility Test ===\n');
  
  const prompt = 'Hello! Please introduce yourself briefly.';
  
  console.log('Test Prompt:', prompt);
  console.log('');
  
  console.log('1. Testing Claude Opus 4.8');
  console.log('──────────────────────────');
  try {
    const claudeResult = await callClaude(prompt);
    console.log('Model:', claudeResult.model);
    console.log('Response:', claudeResult.response.substring(0, 150) + '...');
    console.log('Tokens Used:', claudeResult.usage?.total_tokens || 'N/A');
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('');
  console.log('2. Testing GPT-5.5');
  console.log('──────────────────');
  try {
    const gptResult = await callGPT(prompt);
    console.log('Model:', gptResult.model);
    console.log('Response:', gptResult.response.substring(0, 150) + '...');
    console.log('Tokens Used:', gptResult.usage?.total_tokens || 'N/A');
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('');
  console.log('=== Test Complete ===');
}

runTest().catch(console.error);