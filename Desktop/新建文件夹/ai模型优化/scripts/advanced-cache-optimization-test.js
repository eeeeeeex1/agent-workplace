const CHARS_PER_TOKEN = 3.5;
const MESSAGE_OVERHEAD = 4;
const ROLE_OVERHEAD = 2;

class TokenEstimator {
  estimateText(text) {
    return Math.ceil(String(text || '').length / CHARS_PER_TOKEN);
  }

  estimateMessage(message) {
    return this.estimateText(message.content) + MESSAGE_OVERHEAD + ROLE_OVERHEAD;
  }

  estimateMessages(messages) {
    return messages.reduce((total, message) => total + this.estimateMessage(message), 0);
  }
}

class AdvancedPromptCache {
  constructor({ blockSize = 2, maxBlocks = 256 } = {}) {
    this.estimator = new TokenEstimator();
    this.blockSize = blockSize;
    this.maxBlocks = maxBlocks;
    this.globalBlockPool = new Map();
    this.sessionRoots = new Map();
  }

  analyzeBlockCache(sessionId, messages) {
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
        reusedTokens += block.tokenCount;
        hitBlocks += 1;
      } else {
        this.globalBlockPool.set(block.key, { ...block, hits: 1, lastUsed: now });
        newBlocks += 1;
      }
    }

    this.evictBlocks();

    return {
      sessionId,
      totalTokens,
      reusedTokens,
      newTokens: totalTokens - reusedTokens,
      hitBlocks,
      newBlocks,
      reuseRate: totalTokens > 0 ? `${((reusedTokens / totalTokens) * 100).toFixed(2)}%` : '0.00%',
    };
  }

  analyzeSessionTree(sessionId, branchId, messages) {
    const root = this.getRoot(sessionId);
    const segments = messages.map((message) => ({
      key: this.hash(JSON.stringify(message)),
      tokenCount: this.estimator.estimateMessage(message),
    }));
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
        child = { ...segment, children: new Map(), visits: 0 };
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
      branchOnlyTokens: totalTokens - sharedPrefixTokens,
      reuseRate: totalTokens > 0 ? `${((sharedPrefixTokens / totalTokens) * 100).toFixed(2)}%` : '0.00%',
    };
  }

  analyzeKvQuantization({ tokenCount, layers = 32, hiddenSize = 4096 }) {
    const elementCount = tokenCount * layers * hiddenSize * 2;
    const fp16MemoryMB = this.toMB(elementCount * 2);
    const int8MemoryMB = this.toMB(elementCount);
    const fp8MemoryMB = this.toMB(elementCount);

    return {
      tokenCount,
      layers,
      hiddenSize,
      fp16MemoryMB: this.round(fp16MemoryMB),
      int8MemoryMB: this.round(int8MemoryMB),
      fp8MemoryMB: this.round(fp8MemoryMB),
      int8SavedMB: this.round(fp16MemoryMB - int8MemoryMB),
      fp8SavedMB: this.round(fp16MemoryMB - fp8MemoryMB),
      int8SavingRate: '50.00%',
      fp8SavingRate: '50.00%',
      recommendation: 'KV 量化适合自托管推理服务；普通云 API 客户端无法直接压缩服务商内部 KV Cache。',
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

  toBlocks(messages) {
    const blocks = [];
    for (let i = 0; i < messages.length; i += this.blockSize) {
      const blockMessages = messages.slice(i, i + this.blockSize);
      blocks.push({
        key: this.hash(JSON.stringify(blockMessages)),
        tokenCount: this.estimator.estimateMessages(blockMessages),
      });
    }
    return blocks;
  }

  getRoot(sessionId) {
    let root = this.sessionRoots.get(sessionId);
    if (!root) {
      root = { key: sessionId, tokenCount: 0, children: new Map(), visits: 0 };
      this.sessionRoots.set(sessionId, root);
    }
    return root;
  }

  evictBlocks() {
    if (this.globalBlockPool.size <= this.maxBlocks) return;
    const removeCount = this.globalBlockPool.size - this.maxBlocks;
    const blocks = Array.from(this.globalBlockPool.values()).sort((a, b) => (a.hits - b.hits) || (a.lastUsed - b.lastUsed));
    for (const block of blocks.slice(0, removeCount)) {
      this.globalBlockPool.delete(block.key);
    }
  }

  hash(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
  }

  toMB(bytes) {
    return bytes / 1024 / 1024;
  }

  round(value) {
    return Math.round(value * 100) / 100;
  }
}

function baseConversation() {
  return [
    { role: 'system', content: '你是一个代码助手，需要持续记住项目规范：TypeScript、缓存优先、日志脱敏、严格错误处理。' },
    { role: 'user', content: '我们正在设计 LLM 调用优化库，请记住项目目标和接口约束。' },
    { role: 'assistant', content: '已记住：需要优化 Token、缓存命中、队列吞吐和多 Provider 适配。' },
  ];
}

function createSessionTurns() {
  const base = baseConversation();
  const turns = [];
  for (let i = 1; i <= 12; i++) {
    turns.push({
      sessionId: 'session-main',
      branchId: `main-${i}`,
      messages: [
        ...base,
        { role: 'user', content: `第 ${i} 轮：请分析缓存策略、Token 统计、队列并发和可观测性。` },
      ],
    });
  }

  for (let i = 1; i <= 8; i++) {
    turns.push({
      sessionId: 'session-main',
      branchId: `branch-a-${i}`,
      messages: [
        ...base,
        { role: 'user', content: '现在从缓存策略分支继续，重点比较 Trie、块缓存、会话树缓存。' },
        { role: 'assistant', content: '分支已建立，会复用基础上下文并只追加差异内容。' },
        { role: 'user', content: `分支问题 ${i}：请给出优化收益测算。` },
      ],
    });
  }

  return turns;
}

function run() {
  const cache = new AdvancedPromptCache({ blockSize: 2, maxBlocks: 256 });
  const estimator = new TokenEstimator();
  const turns = createSessionTurns();
  const blockRows = [];
  const treeRows = [];
  let totalTokens = 0;
  let blockReusedTokens = 0;
  let treeReusedTokens = 0;

  for (const turn of turns) {
    const block = cache.analyzeBlockCache(turn.sessionId, turn.messages);
    const tree = cache.analyzeSessionTree(turn.sessionId, turn.branchId, turn.messages);
    totalTokens += estimator.estimateMessages(turn.messages);
    blockReusedTokens += block.reusedTokens;
    treeReusedTokens += tree.sharedPrefixTokens;
    blockRows.push({ branch: turn.branchId, total: block.totalTokens, reused: block.reusedTokens, hitBlocks: block.hitBlocks, reuseRate: block.reuseRate });
    treeRows.push({ branch: turn.branchId, total: tree.totalTokens, sharedPrefix: tree.sharedPrefixTokens, branchOnly: tree.branchOnlyTokens, reuseRate: tree.reuseRate });
  }

  const kv = cache.analyzeKvQuantization({ tokenCount: totalTokens, layers: 32, hiddenSize: 4096 });
  const blockReuseRate = totalTokens > 0 ? ((blockReusedTokens / totalTokens) * 100).toFixed(2) : '0.00';
  const treeReuseRate = totalTokens > 0 ? ((treeReusedTokens / totalTokens) * 100).toFixed(2) : '0.00';

  console.log('=== Advanced Cache / KV Optimization Analysis ===');
  console.log(`Requests: ${turns.length}`);
  console.log(`Total prompt tokens: ${totalTokens}`);
  console.log(`Block cache reused tokens: ${blockReusedTokens}`);
  console.log(`Block cache reuse rate: ${blockReuseRate}%`);
  console.log(`Session tree reused tokens: ${treeReusedTokens}`);
  console.log(`Session tree reuse rate: ${treeReuseRate}%`);
  console.log(`FP16 KV memory estimate: ${kv.fp16MemoryMB} MB`);
  console.log(`INT8 KV memory estimate: ${kv.int8MemoryMB} MB`);
  console.log(`FP8 KV memory estimate: ${kv.fp8MemoryMB} MB`);
  console.log(`KV quantization memory saving: ${kv.int8SavingRate}`);
  console.log(`Recommendation: ${kv.recommendation}`);
  console.log('Cache stats:', JSON.stringify(cache.getStats()));
  console.log('\nBlock cache details:');
  console.table(blockRows);
  console.log('\nSession tree details:');
  console.table(treeRows);
}

run();
