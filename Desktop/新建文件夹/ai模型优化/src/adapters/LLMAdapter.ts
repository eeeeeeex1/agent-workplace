import { LLMRequest, LLMResponse } from '../types';

export interface LLMAdapter {
  chatCompletion(request: LLMRequest): Promise<LLMResponse>;
  batchChatCompletions(requests: LLMRequest[]): Promise<LLMResponse[]>;
  healthCheck(): Promise<boolean>;
  getProviderName(): string;
}