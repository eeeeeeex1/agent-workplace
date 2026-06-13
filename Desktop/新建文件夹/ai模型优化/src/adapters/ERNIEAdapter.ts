import axios, { AxiosInstance } from 'axios';
import { LLMAdapter } from './LLMAdapter';
import { LLMRequest, LLMResponse, ChatMessage } from '../types';

export class ERNIEAdapter implements LLMAdapter {
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

  private convertToERNIEFormat(request: LLMRequest): Record<string, unknown> {
    return {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
    };
  }

  private convertFromERNIEFormat(response: Record<string, unknown>): LLMResponse {
    const result = response['result'] as string;
    return {
      id: response['id'] as string,
      object: 'chat.completion',
      created: Date.now(),
      model: response['model'] as string,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: result },
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
    const ernieRequest = this.convertToERNIEFormat(request);
    
    const response = await this.axiosInstance.post(
      '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie_completions',
      ernieRequest,
      { params: { access_token: token } }
    );

    return this.convertFromERNIEFormat(response.data);
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
    return 'ernie';
  }
}