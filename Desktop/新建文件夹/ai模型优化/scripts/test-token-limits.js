const { TokenTrimmer, modelTokenLimits } = require('../dist');

function generateLongConversation(messageCount) {
  const messages = [];
  for (let i = 1; i <= messageCount; i++) {
    messages.push({ role: 'user', content: 'Question ' + i + ': What is AI?' });
    messages.push({ role: 'assistant', content: 'Answer ' + i + ': AI stands for Artificial Intelligence. It refers to the simulation of human intelligence in machines that are programmed to think like humans and mimic their actions.' });
  }
  return messages;
}

function estimateTokens(text) {
  return Math.ceil(text.length / 3.5);
}

async function runTest() {
  console.log('=== Multi-Model Token Limit Test ===\n');
  
  const tokenTrimmer = new TokenTrimmer();
  
  console.log('Model Token Limits Configuration:');
  console.log('─────────────────────────────────');
  for (const [model, config] of Object.entries(modelTokenLimits)) {
    console.log(`${model}: ${config.maxTokens.toLocaleString()} tokens (reserve: ${config.reserveTokens})`);
  }
  console.log('');
  
  const testMessages = generateLongConversation(30);
  const totalChars = JSON.stringify(testMessages).length;
  const estimatedTokens = estimateTokens(JSON.stringify(testMessages));
  
  console.log('Test Conversation:');
  console.log(`  Total messages: ${testMessages.length}`);
  console.log(`  Estimated tokens: ${estimatedTokens.toLocaleString()}`);
  console.log('');
  
  console.log('Token Trimming Results:');
  console.log('──────────────────────');
  
  const models = ['gpt-5.5', 'claude-opus-4-8', 'gpt-3.5-turbo'];
  
  for (const model of models) {
    const stats = tokenTrimmer.getTrimStats(testMessages, model);
    console.log(`\nModel: ${model}`);
    console.log(`  Max tokens: ${stats.modelMaxTokens.toLocaleString()}`);
    console.log(`  Original tokens: ${stats.originalTokens.toLocaleString()}`);
    console.log(`  Trimmed tokens: ${stats.trimmedTokens.toLocaleString()}`);
    console.log(`  Reduction: ${stats.reductionPercent}%`);
    console.log(`  Messages trimmed: ${stats.messagesTrimmed}`);
    
    const trimmedMessages = tokenTrimmer.trimMessages(testMessages, model);
    console.log(`  Remaining messages: ${trimmedMessages.length}`);
  }
  
  console.log('');
  console.log('=== Test Complete ===');
}

runTest().catch(console.error);