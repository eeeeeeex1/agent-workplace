import { CacheManager } from '../src/cache/CacheManager';
import { LLMRequest, LLMResponse } from '../src/types';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  afterEach(async () => {
    await cacheManager.shutdown();
  });

  test('should store and retrieve cached responses', async () => {
    const request: LLMRequest = {
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hello' }],
    };

    const response: LLMResponse = {
      id: 'test-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'test-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Hi!' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    };

    await cacheManager.set(request, response);
    const cached = await cacheManager.get(request);

    expect(cached).not.toBeNull();
    expect(cached?.choices[0].message.content).toBe('Hi!');
  });

  test('should return null for non-existent cache', async () => {
    const request: LLMRequest = {
      model: 'test-model',
      messages: [{ role: 'user', content: 'Non-existent' }],
    };

    const cached = await cacheManager.get(request);
    expect(cached).toBeNull();
  });

  test('should track cache statistics', () => {
    const stats = cacheManager.getStats();
    expect(stats.hits).toBeDefined();
    expect(stats.misses).toBeDefined();
    expect(stats.hitRate).toBeDefined();
  });
});