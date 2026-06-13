import Redis, { Redis as RedisType } from 'ioredis';
import { config } from '../config';
import { CacheEntry, LLMRequest, LLMResponse } from '../types';

export class RedisCache {
  private client: RedisType;
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly DEFAULT_TTL = config.cache.ttlSeconds;

  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  private generateCacheKey(request: LLMRequest): string {
    const keyComponents: string[] = [];
    
    keyComponents.push(`model:${request.model}`);
    
    if (request.temperature !== undefined) {
      keyComponents.push(`temp:${request.temperature}`);
    }
    if (request.topP !== undefined) {
      keyComponents.push(`topP:${request.topP}`);
    }
    if (request.maxTokens !== undefined) {
      keyComponents.push(`maxTokens:${request.maxTokens}`);
    }

    const messagesHash = this.hashMessages(request.messages);
    keyComponents.push(`msgHash:${messagesHash}`);

    return `llm:cache:${keyComponents.join(':')}`;
  }

  private hashMessages(messages: LLMRequest['messages']): string {
    const serialized = JSON.stringify(messages);
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async get(request: LLMRequest): Promise<LLMResponse | null> {
    if (!config.cache.enabled) {
      this.cacheMisses++;
      return null;
    }

    const key = this.generateCacheKey(request);
    const cached = await this.client.get(key);

    if (cached) {
      try {
        const entry: CacheEntry = JSON.parse(cached);
        if (this.isEntryValid(entry)) {
          this.cacheHits++;
          return entry.response;
        }
      } catch {
        console.warn('Failed to parse cached entry');
      }
    }

    this.cacheMisses++;
    return null;
  }

  async set(request: LLMRequest, response: LLMResponse, ttl?: number): Promise<void> {
    if (!config.cache.enabled) return;

    const key = this.generateCacheKey(request);
    const entry: CacheEntry = {
      response,
      timestamp: Date.now(),
      usage: response.usage,
    };

    const ttlSeconds = ttl || this.DEFAULT_TTL;
    await this.client.setex(key, ttlSeconds, JSON.stringify(entry));
  }

  async invalidate(request: LLMRequest): Promise<void> {
    const key = this.generateCacheKey(request);
    await this.client.del(key);
  }

  async invalidateModel(model: string): Promise<void> {
    const pattern = `llm:cache:model:${model}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async clearAll(): Promise<void> {
    const pattern = 'llm:cache:*';
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  private isEntryValid(entry: CacheEntry): boolean {
    const ageMs = Date.now() - entry.timestamp;
    const ttlMs = this.DEFAULT_TTL * 1000;
    return ageMs < ttlMs;
  }

  getStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: hitRate.toFixed(2),
      totalRequests: total,
    };
  }

  async getMemoryUsage(): Promise<number> {
    const info = await this.client.info('memory');
    const match = info.match(/used_memory:\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}