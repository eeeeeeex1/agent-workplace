import { RedisCache } from './RedisCache';
import { LLMRequest, LLMResponse } from '../types';
import { config } from '../config';

export class CacheManager {
  private redisCache: RedisCache;
  private readonly ENABLED = config.cache.enabled;

  constructor() {
    this.redisCache = new RedisCache();
  }

  async get(request: LLMRequest): Promise<LLMResponse | null> {
    if (!this.ENABLED) return null;

    try {
      return await this.redisCache.get(request);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(request: LLMRequest, response: LLMResponse, ttl?: number): Promise<void> {
    if (!this.ENABLED) return;

    try {
      const dynamicTtl = this.calculateDynamicTTL(response);
      await this.redisCache.set(request, response, ttl || dynamicTtl);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async invalidate(request: LLMRequest): Promise<void> {
    try {
      await this.redisCache.invalidate(request);
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }

  async warmUp(requests: LLMRequest[]): Promise<void> {
    if (!this.ENABLED) return;

    console.log('Starting cache warm-up for', requests.length, 'requests');
    for (const request of requests) {
      const cached = await this.get(request);
      if (!cached) {
        console.log('Pre-caching request for model:', request.model);
      }
    }
  }

  getStats() {
    return this.redisCache.getStats();
  }

  async getMemoryUsage(): Promise<number> {
    return this.redisCache.getMemoryUsage();
  }

  private calculateDynamicTTL(response: LLMResponse): number {
    const { prompt_tokens, completion_tokens } = response.usage;
    const totalTokens = prompt_tokens + completion_tokens;

    if (totalTokens > 6000) {
      return 7200;
    } else if (totalTokens > 3000) {
      return 3600;
    } else {
      return 1800;
    }
  }

  async shutdown(): Promise<void> {
    await this.redisCache.disconnect();
  }
}