import { OptimizedLLMClient } from '../src/client/OptimizedLLMClient';

async function startMonitoring(client: OptimizedLLMClient, interval: number) {
  setInterval(() => {
    const stats = client.getPerformanceStats();
    
    console.clear();
    console.log('=== LLM Service Monitoring Dashboard ===');
    console.log('');
    console.log('Performance Metrics:');
    console.log(`  Total Requests: ${stats.totalRequests}`);
    console.log(`  Cache Hits: ${stats.cacheHits}`);
    console.log(`  Cache Hit Rate: ${stats.cacheHitRate}`);
    console.log(`  Average Processing Time: ${stats.averageProcessingTime}`);
    console.log(`  Total Processing Time: ${stats.totalProcessingTime}`);
    console.log('');
    console.log('Queue Status:');
    console.log(`  High Priority: ${stats.queueStats.queue.high}`);
    console.log(`  Normal Priority: ${stats.queueStats.queue.normal}`);
    console.log(`  Low Priority: ${stats.queueStats.queue.low}`);
    console.log(`  Processing: ${stats.queueStats.processing}`);
    console.log('');
    console.log('Press Ctrl+C to exit');
  }, interval);
}

async function main() {
  const client = new OptimizedLLMClient();
  
  console.log('Starting monitoring dashboard...');
  console.log('Monitoring interval: 5 seconds');
  console.log('');
  
  startMonitoring(client, 5000);

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await client.shutdown();
    process.exit(0);
  });
}

main().catch(console.error);