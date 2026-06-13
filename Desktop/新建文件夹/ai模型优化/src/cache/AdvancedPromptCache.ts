import { ChatMessage } from '../types';
import { TokenEstimator } from '../tokenizer/TokenEstimator';

export type KvPrecision = 'fp16' | 'int8' | 'fp8';

export interface BlockCacheAnalysis {
  sessionId: string;
  totalTokens: number;
  reusedTokens: number;
  newTokens: number;
  hitBlocks: number;
  newBlocks: number;
  reuseRate: string;
}

export interface SessionTreeAnalysis {
  sessionId: string;
  branchId: string;
  totalTokens: number;
  sharedPrefixTokens: number;
  branchOnlyTokens: number;
  reuseRate: string;
}

export interface KvQuantizationAnalysis {
  tokenCount: number;
  layers: number;
  hiddenSize: number;
  fp16MemoryMB: number;
  int8MemoryMB: number;
  fp8MemoryMB: number;
  int8SavedMB: number;
  fp8SavedMB: number;
  int8SavingRate: string;
  fp8SavingRate: string;
  recommendation: string;
}

interface CachedBlock {
  key: string;
  tokenCount: number;
  hits: number;
  lastUsed: number;
}

interface SessionNode {
  key: string;
  tokenCount: number;
  children: Map<string, SessionNode>;
  visits: number;
}

export class AdvancedPromptCache {
  private readonly tokenEstimator = new TokenEstimator();
  private readonly globalBlockPool = new Map<string, CachedBlock>();
  private readonly sessionRoots = new Map<string, SessionNode>();
  private readonly maxBlocks: number;
  private readonly blockSize: number;

  constructor(options: { maxBlocks?: number; blockSize?: number } = {}) {
    this.maxBlocks = options.maxBlocks || 4096;
    this.blockSize = options.blockSize || 2;
  }

  analyzeBlockCache(sessionId: string, messages: ChatMessage[]): BlockCacheAnalysis {
    const blocks = this.toBlocks(messages);
    let totalTokens = 0;
    let reusedTokens = 0;
    let hitBlocks = 0;
    let newBlocks = 0;
    const now = Date.now();

    for (const block of blocks) {
      totalTokens += block.tokenCount;
      const cached = this.globalBlockPool.get(block.key);
      if (cached) {
        cached.hits += 1;
        cached.lastUsed = now;
        reusedTokens += cached.tokenCount;
        hitBlocks += 1;
      } else {
        this.globalBlockPool.set(block.key, {
          key: block.key,
          tokenCount: block.tokenCount,
          hits: 1,
          lastUsed: now,
        });
        newBlocks += 1;
      }
    }

    this.evictBlocks();

    return {
      sessionId,
      totalTokens,
      reusedTokens,
      newTokens: Math.max(0, totalTokens - reusedTokens),
      hitBlocks,
      newBlocks,
      reuseRate: totalTokens > 0 ? `${((reusedTokens / totalTokens) * 100).toFixed(2)}%` : '0.00%',
    };
  }

  analyzeSessionTree(sessionId: string, branchId: string, messages: ChatMessage[]): SessionTreeAnalysis {
    const root = this.getSessionRoot(sessionId);
    const segments = this.toSegments(messages);
    let node = root;
    let sharedPrefixTokens = 0;
    let totalTokens = 0;

    for (const segment of segments) {
      totalTokens += segment.tokenCount;
      const child = node.children.get(segment.key);
      if (!child) break;
      sharedPrefixTokens += child.tokenCount;
      child.visits += 1;
      node = child;
    }

    node = root;
    for (const segment of segments) {
      let child = node.children.get(segment.key);
      if (!child) {
        child = {
          key: segment.key,
          tokenCount: segment.tokenCount,
          children: new Map(),
          visits: 0,
        };
        node.children.set(segment.key, child);
      }
      child.visits += 1;
      node = child;
    }

    return {
      sessionId,
      branchId,
      totalTokens,
      sharedPrefixTokens,
      branchOnlyTokens: Math.max(0, totalTokens - sharedPrefixTokens),
      reuseRate: totalTokens > 0 ? `${((sharedPrefixTokens / totalTokens) * 100).toFixed(2)}%` : '0.00%',
    };
  }

  analyzeKvQuantization(options: {
    tokenCount: number;
    layers?: number;
    hiddenSize?: number;
  }): KvQuantizationAnalysis {
    const tokenCount = options.tokenCount;
    const layers = options.layers || 32;
    const hiddenSize = options.hiddenSize || 4096;
    const elementCount = tokenCount * layers * hiddenSize * 2;
    const fp16MemoryMB = this.bytesToMB(elementCount * 2);
    const int8MemoryMB = this.bytesToMB(elementCount);
    const fp8MemoryMB = this.bytesToMB(elementCount);
    const int8SavedMB = fp16MemoryMB - int8MemoryMB;
    const fp8SavedMB = fp16MemoryMB - fp8MemoryMB;

    return {
      tokenCount,
      layers,
      hiddenSize,
      fp16MemoryMB: this.round(fp16MemoryMB),
      int8MemoryMB: this.round(int8MemoryMB),
      fp8MemoryMB: this.round(fp8MemoryMB),
      int8SavedMB: this.round(int8SavedMB),
      fp8SavedMB: this.round(fp8SavedMB),
      int8SavingRate: '50.00%',
      fp8SavingRate: '50.00%',
      recommendation: '仅在自托管推理引擎或可控 KV Cache 服务端生效；普通 API 客户端无法直接量化服务商内部 KV Cache。',
    };
  }

  getStats() {
    return {
      globalBlockCount: this.globalBlockPool.size,
      sessionCount: this.sessionRoots.size,
      maxBlocks: this.maxBlocks,
      blockSize: this.blockSize,
    };
  }

  private toBlocks(messages: ChatMessage[]): Array<{ key: string; tokenCount: number }> {
    const blocks: Array<{ key: string; tokenCount: number }> = [];
    for (let i = 0; i < messages.length; i += this.blockSize) {
      const blockMessages = messages.slice(i, i + this.blockSize);
      blocks.push({
        key: this.hashMessages(blockMessages),
        tokenCount: this.tokenEstimator.estimateMessagesTokenCount(blockMessages),
      });
    }
    return blocks;
  }

  private toSegments(messages: ChatMessage[]): Array<{ key: string; tokenCount: number }> {
    return messages.map((message) => ({
      key: this.hashMessages([message]),
      tokenCount: this.tokenEstimator.estimateMessageTokenCount(message),
    }));
  }

  private getSessionRoot(sessionId: string): SessionNode {
    let root = this.sessionRoots.get(sessionId);
    if (!root) {
      root = { key: sessionId, tokenCount: 0, children: new Map(), visits: 0 };
      this.sessionRoots.set(sessionId, root);
    }
    return root;
  }

  private evictBlocks(): void {
    if (this.globalBlockPool.size <= this.maxBlocks) return;

    const blocks = Array.from(this.globalBlockPool.values())
      .sort((a, b) => (a.hits - b.hits) || (a.lastUsed - b.lastUsed));

    const removeCount = this.globalBlockPool.size - this.maxBlocks;
    for (const block of blocks.slice(0, removeCount)) {
      this.globalBlockPool.delete(block.key);
    }
  }

  private hashMessages(messages: ChatMessage[]): string {
    const serialized = JSON.stringify(messages);
    let hash = 2166136261;
    for (let i = 0; i < serialized.length; i++) {
      hash ^= serialized.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
  }

  private bytesToMB(bytes: number): number {
    return bytes / 1024 / 1024;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
