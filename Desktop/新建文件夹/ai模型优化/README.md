# LLM Optimization Toolkit

LLM Optimization Toolkit 是一个面向大模型 API 调用场景的 TypeScript 工具库，封装了多模型适配、请求缓存、Token 裁剪、优先级队列、批处理和性能统计等能力。它适合用于需要统一调用不同大模型服务、降低重复请求成本、控制上下文长度、提升高并发请求稳定性的 Node.js 项目。

## 项目定位

在实际接入大模型 API 时，常见问题包括：

- 不同厂商接口格式不统一，业务代码需要重复适配。
- 相同请求会反复命中模型接口，造成额外费用和延迟。
- 长对话容易超过模型上下文限制，需要在请求前裁剪消息。
- 高并发调用缺少队列和优先级控制，容易导致请求堆积或限流。
- 缺少调用统计，难以评估缓存命中率、平均耗时和队列状态。

本项目通过统一客户端 `OptimizedLLMClient` 把这些能力整合到一个调用入口中，业务层只需要构造标准化的 `LLMRequest`，即可按统一方式调用不同 Provider。

## 核心特性

- 多平台适配：统一支持 OpenAI、Viva、Viva Claude、Viva GPT、豆包、文心一言等 Provider。
- 请求缓存：基于请求内容缓存响应，减少重复模型调用。
- Redis 支持：通过 `ioredis` 持久化缓存，支持缓存统计和内存占用查询。
- Token 裁剪：根据模型上下文限制自动裁剪消息，预留回复 Token 空间。
- 优先级队列：支持 `high`、`normal`、`low` 三档优先级调度。
- 并发控制：内置请求队列，默认最大并发数为 3，可按需调整。
- 批量处理：支持顺序处理多个 LLM 请求，适合离线任务或批处理场景。
- 性能统计：提供总请求数、缓存命中数、命中率、平均耗时、队列状态和缓存状态。
- 类型导出：统一导出请求、响应、缓存、队列、适配器和客户端相关类型。

## 技术栈

- Runtime：Node.js
- Language：TypeScript
- Module：CommonJS
- HTTP Client：Axios
- Cache：Redis / ioredis
- Test：Jest
- Config：dotenv

## 支持的 Provider

| Provider | 取值 | 说明 |
| --- | --- | --- |
| OpenAI | `openai` | OpenAI Chat Completions 兼容接口 |
| Viva | `viva` | Viva 原生模型接口 |
| Viva Claude | `viva-claude` | Viva 平台 Claude 模型接口 |
| Viva GPT | `viva-gpt` | Viva 平台 GPT 模型接口 |
| 豆包 | `doubao` | 豆包模型接口 |
| 文心一言 | `ernie` | 百度文心一言接口 |

Provider 类型定义位于 `src/adapters/AdapterFactory.ts`。

## 目录结构

```text
.
├── examples/                  # 示例代码
│   └── claude-example.ts
├── scripts/                   # 性能测试、诊断、监控和验证脚本
├── src/
│   ├── adapters/              # 不同模型平台的适配器
│   ├── cache/                 # 缓存管理和 Redis 缓存实现
│   ├── client/                # 优化客户端入口
│   ├── config/                # 环境变量和模型 Token 配置
│   ├── queue/                 # 优先级队列、请求队列和批处理
│   ├── tokenizer/             # Token 估算和消息裁剪
│   ├── types/                 # 公共类型定义
│   └── index.ts               # 统一导出入口
├── tests/                     # Jest 单元测试
├── .env.example               # 环境变量模板
├── jest.config.js             # Jest 配置
├── package.json               # 项目脚本和依赖
└── tsconfig.json              # TypeScript 配置
```

## 安装依赖

```bash
npm install
```

## 环境配置

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

然后根据实际 Provider 填写配置。

```env
# 通用配置
PROVIDER=viva
CACHE_TTL_SECONDS=3600
MAX_TOKEN_LIMIT=8192
RESERVE_TOKENS=1024
REQUEST_TIMEOUT_MS=30000
CACHE_ENABLED=true
RATE_LIMIT=60

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Viva API 配置
VIVA_API_KEY=your_viva_api_key
VIVA_API_URL=https://api.viva.example.com/v1

# Viva Claude API 配置
VIVA_CLAUDE_API_KEY=your_viva_claude_api_key
VIVA_CLAUDE_API_URL=https://api.viva.example.com/v1
VIVA_CLAUDE_MODEL=claude-3-opus-20240229

# OpenAI API 配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_URL=https://api.openai.com/v1

# 豆包 API 配置
DOUBAO_API_KEY=your_doubao_api_key
DOUBAO_SECRET_KEY=your_doubao_secret_key

# 文心一言 API 配置
ERNIE_API_KEY=your_ernie_api_key
ERNIE_SECRET_KEY=your_ernie_secret_key
```

> 注意：`.env` 可能包含真实密钥，不应提交到远程仓库。请只提交 `.env.example`。

## 快速开始

```ts
import { OptimizedLLMClient } from './src';

async function main() {
  const client = OptimizedLLMClient.create(
    'openai',
    process.env.OPENAI_API_KEY || '',
    undefined,
    process.env.OPENAI_API_URL || 'https://api.openai.com/v1'
  );

  const response = await client.chat({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: '你是一个专业助手。' },
      { role: 'user', content: '请总结这个项目的核心能力。' },
    ],
    temperature: 0.7,
    maxTokens: 1024,
  });

  console.log(response.choices[0].message.content);
  await client.shutdown();
}

main().catch(console.error);
```

## 基础用法

### 创建客户端

```ts
import { OptimizedLLMClient } from './src';

const client = OptimizedLLMClient.create(
  'viva-claude',
  process.env.VIVA_CLAUDE_API_KEY || '',
  undefined,
  process.env.VIVA_CLAUDE_API_URL
);
```

`OptimizedLLMClient.create` 参数说明：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `provider` | `ProviderType` | 是 | 模型服务提供商 |
| `apiKey` | `string` | 是 | API Key |
| `secretKey` | `string` | 否 | 部分平台需要的 Secret Key |
| `baseUrl` | `string` | 否 | 自定义 API Base URL |

### 发送普通请求

```ts
const response = await client.chat({
  model: 'claude-3-opus-20240229',
  messages: [
    { role: 'user', content: '帮我优化这段提示词。' },
  ],
  maxTokens: 2048,
});
```

### 发送高优先级请求

```ts
const response = await client.chat(
  {
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: '这是一个需要优先处理的请求。' },
    ],
  },
  'high'
);
```

### 批量处理请求

```ts
const results = await client.batchProcess([
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: '任务 A' }],
  },
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: '任务 B' }],
  },
]);
```

### 预热缓存

```ts
await client.warmUpCache([
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: '常用问题' }],
  },
]);
```

### 查看性能统计

```ts
const stats = client.getPerformanceStats();
console.log(stats);
```

返回数据包含：

- `provider`：当前 Provider 名称。
- `totalRequests`：客户端收到的请求总数。
- `cacheHits`：缓存命中次数。
- `cacheHitRate`：缓存命中率。
- `averageProcessingTime`：平均处理耗时。
- `totalProcessingTime`：累计处理耗时。
- `queueStats`：队列状态。
- `cacheStats`：缓存状态。

### 健康检查

```ts
const ok = await client.healthCheck();
console.log(ok);
```

### 关闭客户端

```ts
await client.shutdown();
```

`shutdown` 会断开缓存连接并清空请求队列，建议在服务退出前调用。

## 请求与响应类型

### LLMRequest

```ts
interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}
```

### ChatMessage

```ts
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### LLMResponse

```ts
interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage: Usage;
}
```

完整类型位于 `src/types/index.ts`。

## 模块说明

### OptimizedLLMClient

路径：`src/client/OptimizedLLMClient.ts`

统一的 LLM 调用入口，继承 `RequestQueue`，调用流程如下：

1. 统计请求总数。
2. 根据模型配置裁剪消息。
3. 尝试从缓存读取响应。
4. 缓存未命中时进入优先级队列。
5. 队列执行真实 Provider 请求。
6. 写入缓存并更新性能统计。

### AdapterFactory

路径：`src/adapters/AdapterFactory.ts`

根据 `provider` 创建对应适配器，并对相同 Provider 和 API Key 的适配器实例做内存复用。

### CacheManager

路径：`src/cache/CacheManager.ts`

负责缓存读取、写入、失效、预热和统计。缓存 TTL 会根据响应 Token 数动态调整：

- 总 Token 大于 6000：7200 秒。
- 总 Token 大于 3000：3600 秒。
- 其他情况：1800 秒。

### TokenTrimmer

路径：`src/tokenizer/TokenTrimmer.ts`

在请求发送前根据模型上下文限制裁剪消息，避免超出模型 Token 上限。

### RequestQueue

路径：`src/queue/RequestQueue.ts`

负责请求排队、并发控制和调度执行。默认最大并发为 3，可通过 `setMaxConcurrent` 修改。

```ts
client.setMaxConcurrent(5);
```

## 模型 Token 配置

模型上下文配置位于 `src/config/index.ts`。

当前内置配置包括：

| 模型匹配规则 | 最大 Token | 预留 Token |
| --- | ---: | ---: |
| `claude-opus-4-8` | 200000 | 4096 |
| `claude-3-opus` | 200000 | 4096 |
| `claude-3-sonnet` | 200000 | 4096 |
| `claude-3-haiku` | 200000 | 4096 |
| `gpt-5.5` | 272000 | 8192 |
| `gpt-4o` | 128000 | 4096 |
| `gpt-4-turbo` | 128000 | 4096 |
| `gpt-3.5-turbo` | 16384 | 2048 |

如果模型名称未匹配到内置规则，会使用环境变量中的 `MAX_TOKEN_LIMIT` 和 `RESERVE_TOKENS`。

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run build` | 使用 TypeScript 编译项目 |
| `npm run watch` | 监听模式编译 TypeScript |
| `npm test` | 运行 Jest 单元测试 |
| `npm start` | 运行编译后的 `dist/index.js` |
| `npm run test:performance` | 运行性能测试脚本 |
| `npm run test:cache` | 运行缓存性能测试脚本 |
| `npm run test:token` | 运行 Token 限制测试脚本 |

## 测试

项目包含 Jest 单元测试和多个脚本测试文件。

```bash
npm test
```

当前单元测试目录：

```text
tests/
├── cache-manager.test.ts
└── token-trimmer.test.ts
```

建议在修改核心代码后执行：

```bash
npm run build
npm test
```

## 开发指南

### 新增 Provider

1. 在 `src/adapters/` 中新增适配器类。
2. 实现 `LLMAdapter` 接口。
3. 在 `src/adapters/AdapterFactory.ts` 中扩展 `ProviderType`。
4. 在 `AdapterFactory.create` 的 `switch` 中注册新 Provider。
5. 按需补充 `.env.example` 配置。

### 调整 Token 策略

1. 在 `src/config/index.ts` 中调整 `modelTokenLimits`。
2. 如需改变裁剪逻辑，修改 `src/tokenizer/TokenTrimmer.ts`。
3. 补充或更新 `tests/token-trimmer.test.ts`。

### 调整缓存策略

1. 修改 `src/cache/CacheManager.ts` 中的缓存读写逻辑。
2. 如需改变 Redis Key 生成或连接逻辑，修改 `src/cache/RedisCache.ts`。
3. 补充或更新 `tests/cache-manager.test.ts`。

### 调整队列并发

```ts
client.setMaxConcurrent(10);
```

如果需要更复杂的调度策略，可扩展 `src/queue/PriorityQueue.ts` 或 `src/queue/RequestQueue.ts`。

## 注意事项

- 请不要提交 `.env`，避免泄露 API Key、Secret Key 或 Redis 密码。
- Redis 不可用时，缓存读取或写入失败会被捕获，不会阻断模型调用主流程。
- 批处理方法中单个请求失败会记录错误，并向结果数组填入空响应占位。
- 项目默认 TypeScript 严格模式开启，新增代码需要通过类型检查。
- 当前公共导出位于 `src/index.ts`，业务侧建议从统一入口导入。

## 许可证

MIT
