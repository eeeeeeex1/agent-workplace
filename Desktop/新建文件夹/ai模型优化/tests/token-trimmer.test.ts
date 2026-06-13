import { TokenTrimmer } from '../src/tokenizer/TokenTrimmer';
import { ChatMessage } from '../src/types';

describe('TokenTrimmer', () => {
  let tokenTrimmer: TokenTrimmer;

  beforeEach(() => {
    tokenTrimmer = new TokenTrimmer();
  });

  test('should return messages as-is when within token limit', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello, how are you?' },
    ];

    const trimmed = tokenTrimmer.trimMessages(messages);
    expect(trimmed.length).toBe(1);
    expect(trimmed[0].content).toBe('Hello, how are you?');
  });

  test('should trim long conversation history', () => {
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 100; i++) {
      messages.push({ role: 'user', content: 'Message ' + i });
      messages.push({ role: 'assistant', content: 'Response ' + i });
    }

    const trimmed = tokenTrimmer.trimMessages(messages);
    expect(trimmed.length).toBeLessThan(200);
  });

  test('should preserve system messages', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ];

    const trimmed = tokenTrimmer.trimMessages(messages);
    const systemMessages = trimmed.filter(m => m.role === 'system');
    expect(systemMessages.length).toBe(1);
    expect(systemMessages[0].content).toBe('You are a helpful assistant.');
  });

  test('should provide trim stats', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello, how are you?' },
    ];

    const stats = tokenTrimmer.getTrimStats(messages);
    expect(stats.originalTokens).toBeDefined();
    expect(stats.trimmedTokens).toBeDefined();
    expect(stats.reductionPercent).toBeDefined();
  });
});