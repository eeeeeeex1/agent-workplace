const https = require('https');

const apiKey = 'sk-KaiJT0Mf6JjRGGYUoXUYdFgLW6cTT6ZvZUlLwNXy0gbGkP9X';
const apiUrl = 'https://www.vivaapi.cn/v1/messages';
const model = 'claude-opus-4-8';

const requestData = JSON.stringify({
  model: model,
  messages: [
    { role: 'user', content: 'Hello Claude! Please introduce yourself briefly.' }
  ],
  max_tokens: 1024,
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

console.log('=== Testing Viva Claude Opus 4.8 ===');
console.log('');
console.log('Configuration:');
console.log('  API Key:', apiKey.substring(0, 10) + '...');
console.log('  API URL:', apiUrl);
console.log('  Model:', model);
console.log('');
console.log('Sending request...');

const req = https.request(options, (res) => {
  console.log('Response Status:', res.statusCode);
  console.log('');

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Response Result:');
      console.log('─────────────────────────────');
      
      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content.find(c => c.type === 'text');
        console.log(textContent?.text || 'No text content');
      } else if (response.choices && response.choices[0]) {
        console.log(response.choices[0].message?.content || 'No text content');
      } else {
        console.log(JSON.stringify(response, null, 2));
      }
      
      console.log('─────────────────────────────');
      console.log('');
      
      if (response.usage) {
        console.log('Usage Stats:');
        console.log('  Input tokens:', response.usage.input_tokens || response.usage.prompt_tokens || 0);
        console.log('  Output tokens:', response.usage.output_tokens || response.usage.completion_tokens || 0);
        console.log('  Total tokens:', response.usage.total_tokens || 0);
      }
      
      console.log('');
      console.log('=== Test Completed ===');
    } catch (error) {
      console.error('Failed to parse response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request failed:', error.message);
});

req.write(requestData);
req.end();