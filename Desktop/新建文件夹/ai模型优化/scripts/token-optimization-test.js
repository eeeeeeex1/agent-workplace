const modelTokenLimits = {
  'claude-opus-4-8': { maxTokens: 200000, reserveTokens: 4096 },
  'claude-3-opus': { maxTokens: 200000, reserveTokens: 4096 },
  'gpt-5.5': { maxTokens: 272000, reserveTokens: 8192 },
  'gpt-4o': { maxTokens: 128000, reserveTokens: 4096 },
  'gpt-3.5-turbo': { maxTokens: 16384, reserveTokens: 2048 },
};

function getModelTokenConfig(modelName) {
  const lowerModelName = modelName.toLowerCase();
  for (const [pattern, config] of Object.entries(modelTokenLimits)) {
    if (lowerModelName.includes(pattern)) {
      return config;
    }
  }
  return { maxTokens: 8192, reserveTokens: 1024 };
}

function estimateTokens(text) {
  return Math.ceil(text.length / 3.5);
}

function estimateMessagesTokenCount(messages) {
  return messages.reduce((total, msg) => total + estimateTokens(msg.content), 0);
}

function generateLongConversation(messageCount) {
  const messages = [];
  for (let i = 1; i <= messageCount; i++) {
    messages.push({ role: 'user', content: 'Question ' + i + ': What is artificial intelligence and machine learning?' });
    messages.push({ role: 'assistant', content: 'Answer ' + i + ': Artificial Intelligence (AI) refers to the simulation of human intelligence in machines. Machine learning is a subset of AI that enables systems to learn from data.' });
  }
  return messages;
}

function smartTruncate(content, maxLength) {
  if (content.length <= maxLength) return content;
  const sentences = content.split(/(?<=[.!?])\s+/);
  let result = '';
  let length = 0;
  for (const sentence of sentences) {
    if (length + sentence.length <= maxLength) {
      result += (result ? ' ' : '') + sentence;
      length += sentence.length + (result ? 1 : 0);
    } else {
      const remaining = maxLength - length;
      if (remaining > 10) {
        result += (result ? ' ' : '') + sentence.substring(0, remaining - 3) + '...';
      }
      break;
    }
  }
  return result || content.substring(0, maxLength - 3) + '...';
}

function trimMessages(messages, modelName) {
  const tokenConfig = getModelTokenConfig(modelName);
  const totalTokens = estimateMessagesTokenCount(messages);
  const availableTokens = tokenConfig.maxTokens - tokenConfig.reserveTokens;

  if (totalTokens <= availableTokens) {
    return messages;
  }

  const trimmedMessages = [];
  let usedTokens = 0;

  const systemMessages = messages.filter(m => m.role === 'system');
  const userAssistantMessages = messages.filter(m => m.role !== 'system');

  for (const sysMsg of systemMessages) {
    const msgTokens = estimateTokens(sysMsg.content);
    if (usedTokens + msgTokens <= availableTokens) {
      trimmedMessages.push(sysMsg);
      usedTokens += msgTokens;
    }
  }

  const remainingTokens = availableTokens - usedTokens;
  if (remainingTokens > 0) {
    const reversedMessages = [...userAssistantMessages].reverse();
    const trimmed = [];
    let used = 0;

    for (const msg of reversedMessages) {
      const msgTokens = estimateTokens(msg.content);
      if (used + msgTokens <= remainingTokens) {
        trimmed.push(msg);
        used += msgTokens;
      } else {
        const remaining = remainingTokens - used;
        if (remaining > 0) {
          const trimmedContent = smartTruncate(msg.content, Math.floor(remaining * 3.5));
          trimmed.push({ ...msg, content: '...' + trimmedContent });
        }
        break;
      }
    }
    trimmedMessages.push(...trimmed.reverse());
  }

  return trimmedMessages;
}

function getTrimStats(messages, modelName) {
  const tokenConfig = getModelTokenConfig(modelName);
  const originalTokens = estimateMessagesTokenCount(messages);
  const trimmed = trimMessages(messages, modelName);
  const trimmedTokens = estimateMessagesTokenCount(trimmed);

  return {
    originalTokens,
    trimmedTokens,
    reductionPercent: originalTokens > 0 ? ((1 - trimmedTokens / originalTokens) * 100).toFixed(2) : '0',
    messagesTrimmed: messages.length - trimmed.length,
    modelMaxTokens: tokenConfig.maxTokens,
    modelName,
  };
}

function runTest() {
  console.log('=== Multi-Model Token Optimization Test ===\n');
  
  console.log('Model Token Limits Configuration:');
  console.log('─────────────────────────────────');
  for (const [model, config] of Object.entries(modelTokenLimits)) {
    console.log(`${model}: ${config.maxTokens.toLocaleString()} tokens (reserve: ${config.reserveTokens})`);
  }
  console.log('');
  
  const testMessages = generateLongConversation(30);
  const estimatedTokens = estimateMessagesTokenCount(testMessages);
  
  console.log('Test Conversation:');
  console.log(`  Total messages: ${testMessages.length}`);
  console.log(`  Estimated tokens: ${estimatedTokens.toLocaleString()}`);
  console.log('');
  
  console.log('Token Trimming Results:');
  console.log('──────────────────────');
  
  const models = ['gpt-5.5', 'claude-opus-4-8', 'gpt-3.5-turbo'];
  
  for (const model of models) {
    const stats = getTrimStats(testMessages, model);
    console.log(`\nModel: ${model}`);
    console.log(`  Max tokens: ${stats.modelMaxTokens.toLocaleString()}`);
    console.log(`  Original tokens: ${stats.originalTokens.toLocaleString()}`);
    console.log(`  Trimmed tokens: ${stats.trimmedTokens.toLocaleString()}`);
    console.log(`  Reduction: ${stats.reductionPercent}%`);
    console.log(`  Messages trimmed: ${stats.messagesTrimmed}`);
  }
  
  console.log('');
  console.log('=== Test Complete ===');
}

runTest();