import axios, { AxiosInstance } from 'axios';
import { LLMAdapter } from './LLMAdapter';
import { LLMRequest, LLMResponse, ChatMessage } from '../types';

export class VivaClaudeAdapter implements LLMAdapter {
  private axiosInstance: AxiosInstance;

  constructor(apiKey: string, baseUrl: string = 'https://api.viva.example.com/v1') {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
    });
  }

  private convertToClaudeFormat(request: LLMRequest): Record<string, unknown> {
    const claudeMessages: Array<{ role: string; content: string }> = [];
    
    request.messages.forEach(msg => {
      const role = msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user';
      claudeMessages.push({
        role,
        content: msg.content,
      });
    });

    return {
      model: request.model,
      messages: claudeMessages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature !== undefined ? request.temperature : 0.7,
      top_p: request.topP,
    };
  }

  private convertFromClaudeFormat(response: Record<string, unknown>): LLMResponse {
    const content = response['content'] as Array<{ type: string; text?: string }>;
    const textContent = content?.find(c => c.type === 'text')?.text || '';
    
    return {
      id: response['id'] as string,
      object: 'chat.completion',
      created: Date.now(),
      model: response['model'] as string,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: textContent,
          },
          finish_reason: (response['stop_reason'] as string) || 'stop',
        },
      ],
      usage: {
        prompt_tokens: (response['usage'] as Record<string, number>)?.input_tokens || 0,
        completion_tokens: (response['usage'] as Record<string, number>)?.output_tokens || 0,
        total_tokens: (response['usage'] as Record<string, number>)?.total_tokens || 0,
      },
    };
  }

  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    const claudeRequest = this.convertToClaudeFormat(request);
    const response = await this.axiosInstance.post('/messages', claudeRequest);
    return this.convertFromClaudeFormat(response.data);
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
    return 'viva-claude';
  }
}