const https = require('https');

const apiKey = 'sk-KaiJT0Mf6JjRGGYUoXUYdFgLW6cTT6ZvZUlLwNXy0gbGkP9X';

async function testClaude() {
  console.log('=== Testing Claude Opus 4.8 ===');
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.vivaapi.cn',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.content) {
            console.log('✓ Successfully connected to Claude');
            console.log('  Response: ' + response.content[0]?.text?.substring(0, 50) + '...');
          } else if (response.error) {
            console.log('✗ API Error: ' + response.error.message);
          } else {
            console.log('✗ Unknown response: ' + data.substring(0, 100));
          }
        } catch {
          console.log('✗ Parse failed: HTTP ' + res.statusCode);
          console.log('  Raw response: ' + data.substring(0, 100));
        }
        resolve();
      });
    }).on('error', (e) => {
      console.log('✗ Network error: ' + e.message);
      resolve();
    }).on('timeout', () => {
      console.log('✗ Request timeout');
      resolve();
    });

    req.write(JSON.stringify({
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 50
    }));
    req.end();
  });
}

async function testGPT() {
  console.log('\n=== Testing GPT-5.5 ===');
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.vivaapi.cn',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.choices) {
            console.log('✓ Successfully connected to GPT-5.5');
            console.log('  Response: ' + response.choices[0]?.message?.content?.substring(0, 50) + '...');
          } else if (response.error) {
            console.log('✗ API Error: ' + response.error.message);
          } else {
            console.log('✗ Unknown response: ' + data.substring(0, 100));
          }
        } catch {
          console.log('✗ Parse failed: HTTP ' + res.statusCode);
          console.log('  Raw response: ' + data.substring(0, 100));
        }
        resolve();
      });
    }).on('error', (e) => {
      console.log('✗ Network error: ' + e.message);
      resolve();
    }).on('timeout', () => {
      console.log('✗ Request timeout');
      resolve();
    });

    req.write(JSON.stringify({
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 50
    }));
    req.end();
  });
}

async function runDiagnostic() {
  console.log('=== API Connection Diagnostic ===\n');
  console.log('Test Date:', new Date().toLocaleString());
  console.log('API Key:', apiKey.substring(0, 10) + '...');
  console.log('');

  await testClaude();
  await testGPT();

  console.log('\n=== Diagnostic Complete ===');
}

runDiagnostic();