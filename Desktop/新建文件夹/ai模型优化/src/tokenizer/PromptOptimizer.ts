import { ChatMessage, LLMRequest } from '../types';
import { TokenEstimator } from './TokenEstimator';

export interface PromptOptimizationOptions {
  bucket?: string;
  templateId?: string;
  enableDelta?: boolean;
}

export interface PromptOptimizationResult {
  messages: ChatMessage[];
  bucket: string;
  originalTokens: number;
  normalizedTokens: number;
  templateCachedTokens: number;
  prefixCachedTokens: number;
  deltaTokens: number;
  estimatedSavedTokens: number;
  estimatedSavingRate: string;
  deltaMessages?: ChatMessage[];
}

interface TemplateEntry {
  id: string;
  bucket: string;
  messages: ChatMessage[];
  tokenCount: number;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  tokenCount: number;
  accessHistory: number[];
  isEnd: boolean;
}

export class PromptOptimizer {
  private readonly tokenEstimator = new TokenEstimator();
  private readonly templates = new Map<string, TemplateEntry>();
  private readonly roots = new Map<string, TrieNode>();
  private readonly lastPromptByBucket = new Map<string, ChatMessage[]>();
  private readonly maxTrieNodesPerBucket = 5000;
  private nodeCountByBucket = new Map<string, number>();

  optimize(request: LLMRequest, options: PromptOptimizationOptions = {}): PromptOptimizationResult {
    const bucket = options.bucket || this.getBucket(request);
    const originalTokens = this.tokenEstimator.estimateMessagesTokenCount(request.messages);
    const messages = this.normalizeMessages(request.messages);
    const normalizedTokens = this.tokenEstimator.estimateMessagesTokenCount(messages);
    const templateCachedTokens = this.getTemplateCachedTokens(bucket, messages, options.templateId);
    const prefixCachedTokens = this.getOrInsertPrefixCachedTokens(bucket, messages);
    const deltaMessages = this.buildDeltaMessages(bucket, messages);
    const deltaTokens = this.tokenEstimator.estimateMessagesTokenCount(deltaMessages);
    const previous = this.lastPromptByBucket.get(bucket);

    this.lastPromptByBucket.set(bucket, messages);

    const reusableTokens = Math.max(templateCachedTokens, prefixCachedTokens);
    const deltaSavedTokens = previous ? Math.max(0, normalizedTokens - deltaTokens) : 0;
    const estimatedSavedTokens = Math.max(0, originalTokens - normalizedTokens) + reusableTokens + deltaSavedTokens;

    return {
      messages,
      bucket,
      originalTokens,
      normalizedTokens,
      templateCachedTokens,
      prefixCachedTokens,
      deltaTokens,
      estimatedSavedTokens,
      estimatedSavingRate: originalTokens > 0 ? `${((estimatedSavedTokens / originalTokens) * 100).toFixed(2)}%` : '0.00%',
      deltaMessages: options.enableDelta ? deltaMessages : undefined,
    };
  }

  registerTemplate(bucket: string, id: string, messages: ChatMessage[]): void {
    const normalized = this.normalizeMessages(messages);
    this.templates.set(this.templateKey(bucket, id), {
      id,
      bucket,
      messages: normalized,
      tokenCount: this.tokenEstimator.estimateMessagesTokenCount(normalized),
    });
  }

  normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((message) => ({
      ...message,
      content: this.normalizeContent(message.content),
    }));
  }

  normalizeContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+([,.;:!?，。；：！？])/g, '$1')
      .replace(/([([{（【])\s+/g, '$1')
      .replace(/\s+([)\]}）】])/g, '$1')
      .trim();
  }

  buildDeltaMessages(bucket: string, messages: ChatMessage[]): ChatMessage[] {
    const previous = this.lastPromptByBucket.get(bucket);
    if (!previous) return messages;

    let commonPrefixLength = 0;
    while (
      commonPrefixLength < previous.length &&
      commonPrefixLength < messages.length &&
      previous[commonPrefixLength].role === messages[commonPrefixLength].role &&
      previous[commonPrefixLength].content === messages[commonPrefixLength].content
    ) {
      commonPrefixLength++;
    }

    const delta = messages.slice(commonPrefixLength);
    if (delta.length === 0) {
      return [{ role: 'user', content: '[DELTA_PROMPT] No new prompt content. Reuse previous context.' }];
    }

    return [
      { role: 'system', content: `[DELTA_PROMPT] Reuse the first ${commonPrefixLength} messages from the previous prompt context.` },
      ...delta,
    ];
  }

  getStats() {
    return {
      templateCount: this.templates.size,
      buckets: Array.from(this.roots.keys()).map((bucket) => ({
        bucket,
        trieNodes: this.nodeCountByBucket.get(bucket) || 0,
      })),
    };
  }

  private getBucket(request: LLMRequest): string {
    const temp = request.temperature === undefined ? 'default' : request.temperature;
    const topP = request.topP === undefined ? 'default' : request.topP;
    const maxTokens = request.maxTokens === undefined ? 'default' : request.maxTokens;
    return `${request.model}|temp:${temp}|topP:${topP}|max:${maxTokens}`;
  }

  private getTemplateCachedTokens(bucket: string, messages: ChatMessage[], templateId?: string): number {
    const candidates = templateId
      ? [this.templates.get(this.templateKey(bucket, templateId))].filter(Boolean) as TemplateEntry[]
      : Array.from(this.templates.values()).filter((template) => template.bucket === bucket);

    let best = 0;
    for (const template of candidates) {
      if (this.startsWithMessages(messages, template.messages)) {
        best = Math.max(best, template.tokenCount);
      }
    }
    return best;
  }

  private startsWithMessages(messages: ChatMessage[], prefix: ChatMessage[]): boolean {
    if (prefix.length > messages.length) return false;
    return prefix.every((message, index) => (
      message.role === messages[index].role && message.content === messages[index].content
    ));
  }

  private getOrInsertPrefixCachedTokens(bucket: string, messages: ChatMessage[]): number {
    const root = this.getRoot(bucket);
    const segments = this.toSegments(messages);
    let node = root;
    let cachedTokens = 0;
    const now = Date.now();

    for (const segment of segments) {
      const next = node.children.get(segment.key);
      if (!next) break;
      node = next;
      cachedTokens = node.tokenCount;
      this.recordAccess(node, now);
    }

    node = root;
    let tokenCount = 0;
    for (const segment of segments) {
      tokenCount += segment.tokens;
      let next = node.children.get(segment.key);
      if (!next) {
        next = { children: new Map(), tokenCount, accessHistory: [], isEnd: false };
        node.children.set(segment.key, next);
        this.nodeCountByBucket.set(bucket, (this.nodeCountByBucket.get(bucket) || 0) + 1);
      }
      this.recordAccess(next, now);
      node = next;
    }
    node.isEnd = true;
    this.evictByLruK(bucket);

    return cachedTokens;
  }

  private getRoot(bucket: string): TrieNode {
    let root = this.roots.get(bucket);
    if (!root) {
      root = { children: new Map(), tokenCount: 0, accessHistory: [], isEnd: false };
      this.roots.set(bucket, root);
      this.nodeCountByBucket.set(bucket, 1);
    }
    return root;
  }

  private toSegments(messages: ChatMessage[]): Array<{ key: string; tokens: number }> {
    return messages.map((message) => ({
      key: `${message.role}:${message.content}`,
      tokens: this.tokenEstimator.estimateMessageTokenCount(message),
    }));
  }

  private recordAccess(node: TrieNode, timestamp: number): void {
    node.accessHistory.push(timestamp);
    if (node.accessHistory.length > 2) {
      node.accessHistory.shift();
    }
  }

  private evictByLruK(bucket: string): void {
    const count = this.nodeCountByBucket.get(bucket) || 0;
    if (count <= this.maxTrieNodesPerBucket) return;

    const root = this.roots.get(bucket);
    if (!root) return;

    while ((this.nodeCountByBucket.get(bucket) || 0) > this.maxTrieNodesPerBucket) {
      const removed = this.removeColdestLeaf(root);
      if (!removed) break;
      this.nodeCountByBucket.set(bucket, (this.nodeCountByBucket.get(bucket) || 0) - 1);
    }
  }

  private removeColdestLeaf(root: TrieNode): boolean {
    let coldestPath: string[] = [];
    let coldestScore = Number.POSITIVE_INFINITY;

    const visit = (node: TrieNode, path: string[]) => {
      if (node.children.size === 0 && path.length > 0) {
        const score = node.accessHistory[0] || 0;
        if (score < coldestScore) {
          coldestScore = score;
          coldestPath = path;
        }
        return;
      }
      for (const [key, child] of node.children) {
        visit(child, [...path, key]);
      }
    };

    visit(root, []);
    if (coldestPath.length === 0) return false;

    let parent = root;
    for (const key of coldestPath.slice(0, -1)) {
      const next = parent.children.get(key);
      if (!next) return false;
      parent = next;
    }

    return parent.children.delete(coldestPath[coldestPath.length - 1]);
  }

  private templateKey(bucket: string, id: string): string {
    return `${bucket}:${id}`;
  }
}
