import { LLMRequest, LLMResponse } from '../types';

export class BatchProcessor {
  private batchSize = 5;
  private batchTimeout = 500;
  private pendingRequests: Array<{
    request: LLMRequest;
    resolve: (value: LLMResponse) => void;
    reject: (reason: Error) => void;
  }> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  async process(request: LLMRequest): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({ request, resolve, reject });

      if (this.pendingRequests.length >= this.batchSize) {
        this.executeBatch();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.executeBatch(), this.batchTimeout);
      }
    });
  }

  private async executeBatch(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const batch = [...this.pendingRequests];
    this.pendingRequests = [];

    if (batch.length === 0) return;

    try {
      const responses = await this.executeBatchRequest(batch.map(item => item.request));

      batch.forEach((item, index) => {
        if (responses[index]) {
          item.resolve(responses[index]);
        } else {
          item.reject(new Error('Batch request failed'));
        }
      });
    } catch (error) {
      batch.forEach(item => {
        item.reject(error as Error);
      });
    }
  }

  private async executeBatchRequest(requests: LLMRequest[]): Promise<LLMResponse[]> {
    throw new Error('executeBatchRequest must be implemented by subclass');
  }

  setBatchSize(size: number): void {
    this.batchSize = size;
  }

  setBatchTimeout(timeout: number): void {
    this.batchTimeout = timeout;
  }

  getPendingCount(): number {
    return this.pendingRequests.length;
  }
}