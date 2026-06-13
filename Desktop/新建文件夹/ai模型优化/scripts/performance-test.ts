import { OptimizedLLMClient } from '../src/client/OptimizedLLMClient';
import { LLMRequest } from '../src/types';

async function runPerformanceTest() {
  const client = new OptimizedLLMClient();
  const testIterations = 100;
  const concurrentRequests = 10;

  console.log('=== LLM Performance Test ===');
  console.log(`Test Configuration:`);
  console.log(`  - Total iterations: ${testIterations}`);
  console.log(`  - Concurrent requests: ${concurrentRequests}`);
  console.log('');

  const testRequests: LLMRequest[] = [
    {
      model: 'viva-llm',
      messages: [{ role: 'user', content: 'What is the weather today?' }],
      temperature: 0.7,
    },
    {
      model: 'viva-llm',
      messages: [{ role: 'user', content: 'Explain quantum computing in simple terms.' }],
      temperature: 0.5,
    },
    {
      model: 'viva-llm',
      messages: [{ role: 'user', content: 'Write a short poem about nature.' }],
      temperature: 0.9,
    },
    {
      model: 'viva-llm',
      messages: [{ role: 'user', content: 'How does machine learning work?' }],
      temperature: 0.7,
    },
    {
      model: 'viva-llm',
      messages: [{ role: 'user', content: 'What is artificial intelligence?' }],
      temperature: 0.6,
    },
  ];

  console.log('1. Testing Cache Performance...');
  const cacheStart = Date.now();
  for (let i = 0; i < 50; i++) {
    const request = testRequests[i % testRequests.length];
    await client.chat(request);
  }
  const cacheTime = Date.now() - cacheStart;
  console.log(`   Completed 50 requests in ${cacheTime}ms`);

  console.log('');
  console.log('2. Testing Concurrent Requests...');
  const concurrentStart = Date.now();
  const promises = [];
  for (let i = 0; i < concurrentRequests; i++) {
    const request = testRequests[i % testRequests.length];
    promises.push(client.chat(request, i < 3 ? 'high' : i < 7 ? 'normal' : 'low'));
  }
  await Promise.all(promises);
  const concurrentTime = Date.now() - concurrentStart;
  console.log(`   Completed ${concurrentRequests} concurrent requests in ${concurrentTime}ms`);

  console.log('');
  console.log('3. Testing Batch Processing...');
  const batchStart = Date.now();
  await client.batchProcess(testRequests);
  const batchTime = Date.now() - batchStart;
  console.log(`   Completed batch of ${testRequests.length} requests in ${batchTime}ms`);

  console.log('');
  console.log('=== Performance Results ===');
  const stats = client.getPerformanceStats();
  console.log(JSON.stringify(stats, null, 2));

  await client.shutdown();
}

runPerformanceTest().catch(console.error);