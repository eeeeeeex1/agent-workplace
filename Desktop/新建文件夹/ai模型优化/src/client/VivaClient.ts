import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config';
import { LLMRequest, LLMResponse } from '../types';

export class VivaClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.viva.apiUrl,
      timeout: config.viva.timeout,
      headers: {
        'Authorization': `Bearer ${config.viva.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          console.error('Viva API Error:', error.response.status, error.response.data);
        } else if (error.request) {
          console.error('Viva API Request Error:', error.request);
        } else {
          console.error('Viva API Setup Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    const response: AxiosResponse<LLMResponse> = await this.axiosInstance.post(
      '/chat/completions',
      request
    );
    return response.data;
  }

  async batchChatCompletions(requests: LLMRequest[]): Promise<LLMResponse[]> {
    const results: LLMResponse[] = [];
    
    for (const request of requests) {
      try {
        const response = await this.chatCompletion(request);
        results.push(response);
      } catch {
        results.push({} as LLMResponse);
      }
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}