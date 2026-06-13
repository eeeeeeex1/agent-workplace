import { v4 as uuidv4 } from 'uuid';
import { PriorityQueue } from './PriorityQueue';
import { LLMRequest, LLMResponse, QueuedRequest } from '../types';

export class RequestQueue {
  private queue: PriorityQueue;
  private processing = false;
  private maxConcurrent = 3;
  private processingCount = 0;

  constructor() {
    this.queue = new PriorityQueue();
  }

  async enqueue(request: LLMRequest, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: uuidv4(),
        request,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      this.queue.enqueue(queuedRequest);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (!this.queue.isEmpty() && this.processingCount < this.maxConcurrent) {
        const queuedRequest = this.queue.dequeue();
        if (!queuedRequest) break;

        this.processingCount++;
        this.processRequest(queuedRequest);
      }
    } finally {
      this.processing = false;
    }
  }

  private async processRequest(queuedRequest: QueuedRequest): Promise<void> {
    try {
      const response = await this.executeRequest(queuedRequest.request);
      queuedRequest.resolve(response);
    } catch (error) {
      queuedRequest.reject(error as Error);
    } finally {
      this.processingCount--;
      this.processQueue();
    }
  }

  private async executeRequest(request: LLMRequest): Promise<LLMResponse> {
    throw new Error('executeRequest must be implemented by subclass');
  }

  getStats() {
    return {
      queue: this.queue.getStats(),
      processing: this.processingCount,
      maxConcurrent: this.maxConcurrent,
    };
  }

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
  }

  clear(): void {
    this.queue.clear();
  }
}