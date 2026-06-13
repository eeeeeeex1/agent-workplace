import { LLMRequest, LLMResponse } from '../types';
import { LLMAdapter } from '../adapters/LLMAdapter';
import { AdapterFactory, ProviderType, AdapterConfig } from '../adapters/AdapterFactory';
import { CacheManager } from '../cache/CacheManager';
import { TokenTrimmer } from '../tokenizer/TokenTrimmer';
import { PromptOptimizer } from '../tokenizer/PromptOptimizer';
import { RequestQueue } from '../queue/RequestQueue';

export class OptimizedLLMClient extends RequestQueue {
  private adapter: LLMAdapter;
  private cacheManager: CacheManager;
  private tokenTrimmer: TokenTrimmer;
  private promptOptimizer: PromptOptimizer;
  private requestCount = 0;
  private cacheHitCount = 0;
  private totalProcessingTime = 0;

  constructor(config: AdapterConfig) {
    super();
    this.adapter = AdapterFactory.create(config);
    this.cacheManager = new CacheManager();
    this.tokenTrimmer = new TokenTrimmer();
    this.promptOptimizer = new PromptOptimizer();
  }

  static create(provider: ProviderType, apiKey: string, secretKey?: string, baseUrl?: string): OptimizedLLMClient {
    return new OptimizedLLMClient({ provider, apiKey, secretKey, baseUrl });
  }

  async chat(request: LLMRequest, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<LLMResponse> {
    this.requestCount++;

    const promptOptimization = this.promptOptimizer.optimize(request);
    const trimmedMessages = this.tokenTrimmer.trimMessages(promptOptimization.messages, request.model);
    const trimmedRequest: LLMRequest = { ...request, messages: trimmedMessages };

    const cachedResponse = await this.cacheManager.get(trimmedRequest);
    if (cachedResponse) {
      this.cacheHitCount++;
      return cachedResponse;
    }

    return this.enqueue(trimmedRequest, priority);
  }

  protected async executeRequest(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.adapter.chatCompletion(request);
      
      await this.cacheManager.set(request, response);
      
      return response;
    } finally {
      const processingTime = Date.now() - startTime;
      this.totalProcessingTime += processingTime;
    }
  }

  async batchProcess(requests: LLMRequest[]): Promise<LLMResponse[]> {
    const results: LLMResponse[] = [];

    for (const request of requests) {
      try {
        const result = await this.chat(request);
        results.push(result);
      } catch (error) {
        console.error('Batch request failed:', error);
        results.push({} as LLMResponse);
      }
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    return this.adapter.healthCheck();
  }

  getProviderName(): string {
    return this.adapter.getProviderName();
  }

  getPerformanceStats() {
    const avgProcessingTime = this.requestCount > 0 
      ? (this.totalProcessingTime / this.requestCount).toFixed(2)
      : '0';
    const cacheHitRate = this.requestCount > 0 
      ? ((this.cacheHitCount / this.requestCount) * 100).toFixed(2)
      : '0';

    return {
      provider: this.getProviderName(),
      totalRequests: this.requestCount,
      cacheHits: this.cacheHitCount,
      cacheHitRate: `${cacheHitRate}%`,
      averageProcessingTime: `${avgProcessingTime}ms`,
      totalProcessingTime: `${this.totalProcessingTime}ms`,
      queueStats: this.getStats(),
      cacheStats: this.cacheManager.getStats(),
    };
  }

  warmUpPromptTemplate(id: string, request: LLMRequest): void {
    const bucket = `${request.model}|temp:${request.temperature === undefined ? 'default' : request.temperature}|topP:${request.topP === undefined ? 'default' : request.topP}|max:${request.maxTokens === undefined ? 'default' : request.maxTokens}`;
    this.promptOptimizer.registerTemplate(bucket, id, request.messages);
  }

  getPromptOptimizationStats() {
    return this.promptOptimizer.getStats();
  }

  async warmUpCache(requests: LLMRequest[]): Promise<void> {
    await this.cacheManager.warmUp(requests);
  }

  async shutdown(): Promise<void> {
    await this.cacheManager.shutdown();
    this.clear();
  }
}