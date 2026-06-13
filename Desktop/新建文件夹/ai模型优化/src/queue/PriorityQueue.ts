import { QueuedRequest } from '../types';

export class PriorityQueue {
  private highPriority: QueuedRequest[] = [];
  private normalPriority: QueuedRequest[] = [];
  private lowPriority: QueuedRequest[] = [];

  enqueue(request: QueuedRequest): void {
    switch (request.priority) {
      case 'high':
        this.highPriority.push(request);
        break;
      case 'normal':
        this.normalPriority.push(request);
        break;
      case 'low':
        this.lowPriority.push(request);
        break;
    }
  }

  dequeue(): QueuedRequest | undefined {
    if (this.highPriority.length > 0) {
      return this.highPriority.shift();
    }
    if (this.normalPriority.length > 0) {
      return this.normalPriority.shift();
    }
    if (this.lowPriority.length > 0) {
      return this.lowPriority.shift();
    }
    return undefined;
  }

  peek(): QueuedRequest | undefined {
    if (this.highPriority.length > 0) {
      return this.highPriority[0];
    }
    if (this.normalPriority.length > 0) {
      return this.normalPriority[0];
    }
    if (this.lowPriority.length > 0) {
      return this.lowPriority[0];
    }
    return undefined;
  }

  size(): number {
    return this.highPriority.length + this.normalPriority.length + this.lowPriority.length;
  }

  isEmpty(): boolean {
    return this.size() === 0;
  }

  getStats() {
    return {
      high: this.highPriority.length,
      normal: this.normalPriority.length,
      low: this.lowPriority.length,
      total: this.size(),
    };
  }

  clear(): void {
    this.highPriority = [];
    this.normalPriority = [];
    this.lowPriority = [];
  }
}