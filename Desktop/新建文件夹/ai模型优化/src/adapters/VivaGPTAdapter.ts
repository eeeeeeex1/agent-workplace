import axios, { AxiosInstance } from 'axios';
import { LLMAdapter } from './LLMAdapter';
import { LLMRequest, LLMResponse, ChatMessage } from '../types';

export class VivaGPTAdapter implements LLMAdapter {
  private axiosInstance: AxiosInstance;

  constructor(apiKey: string, baseUrl: string = 'https://www.vivaapi.cn/v1') {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private convertToGPTFormat(request: LLMRequest): Record<string, unknown> {
    return {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature !== undefined ? request.temperature : 0.7,
      top_p: request.topP,
      stream: false,
    };
  }

  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    const gptRequest = this.convertToGPTFormat(request);
    const response = await this.axiosInstance.post('/chat/completions', gptRequest);
    return response.data as LLMResponse;
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
    return 'viva-gpt';
  }
}