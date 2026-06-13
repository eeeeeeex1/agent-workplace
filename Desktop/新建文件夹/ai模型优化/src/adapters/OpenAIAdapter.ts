import axios, { AxiosInstance } from 'axios';
import { LLMAdapter } from './LLMAdapter';
import { LLMRequest, LLMResponse } from '../types';

export class OpenAIAdapter implements LLMAdapter {
  private axiosInstance: AxiosInstance;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.axiosInstance.post('/chat/completions', request);
    return response.data;
  }

  async batchChatCompletions(requests: LLMRequest[]): Promise<LLMResponse[]> {
    const results: LLMResponse[] = [];
    for (const req of requests) {
      try {
        results.push(await this.chatCompletion(req));
      } catch {
        results.push({} as LLMResponse);
      }
    }
    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/models');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  getProviderName(): string {
    return 'openai';
  }
}