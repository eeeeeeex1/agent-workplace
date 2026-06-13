import axios, { AxiosInstance } from 'axios';
import { LLMAdapter } from './LLMAdapter';
import { LLMRequest, LLMResponse, ChatMessage } from '../types';

export class DoubaoAdapter implements LLMAdapter {
  private axiosInstance: AxiosInstance;

  constructor(apiKey: string, secretKey: string) {
    this.axiosInstance = axios.create({
      baseURL: 'https://aip.baidubce.com',
    });
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.accessToken = '';
    this.tokenExpireTime = 0;
  }

  private apiKey: string;
  private secretKey: string;
  private accessToken: string;
  private tokenExpireTime: number;

  private async getAccessToken(): Promise<string> {
    if (Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    const response = await this.axiosInstance.post('/oauth/2.0/token', null, {
      params: {
        grant_type: 'client_credentials',
        client_id: this.apiKey,
        client_secret: this.secretKey,
      },
    });

    this.accessToken = response.data.access_token;
    this.tokenExpireTime = Date.now() + (response.data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  private convertToDoubaoFormat(request: LLMRequest): Record<string, unknown> {
    return {
      model: request.model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    };
  }

  private convertFromDoubaoFormat(response: Record<string, unknown>): LLMResponse {
    return {
      id: response['id'] as string,
      object: 'chat.completion',
      created: Date.now(),
      model: response['model'] as string,
      choices: [
        {
          index: 0,
          message: response['result'] as ChatMessage,
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: (response['usage'] as Record<string, number>)?.prompt_tokens || 0,
        completion_tokens: (response['usage'] as Record<string, number>)?.completion_tokens || 0,
        total_tokens: (response['usage'] as Record<string, number>)?.total_tokens || 0,
      },
    };
  }

  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    const token = await this.getAccessToken();
    const doubaoRequest = this.convertToDoubaoFormat(request);
    
    const response = await this.axiosInstance.post(
      '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
      doubaoRequest,
      { params: { access_token: token } }
    );

    return this.convertFromDoubaoFormat(response.data);
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
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  getProviderName(): string {
    return 'doubao';
  }
}