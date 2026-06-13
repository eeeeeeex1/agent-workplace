import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

export interface ModelTokenConfig {
  maxTokens: number;
  reserveTokens: number;
}

export const modelTokenLimits: Record<string, ModelTokenConfig> = {
  'claude-opus-4-8': {
    maxTokens: 200000,
    reserveTokens: 4096,
  },
  'claude-3-opus': {
    maxTokens: 200000,
    reserveTokens: 4096,
  },
  'claude-3-sonnet': {
    maxTokens: 200000,
    reserveTokens: 4096,
  },
  'claude-3-haiku': {
    maxTokens: 200000,
    reserveTokens: 4096,
  },
  'gpt-5.5': {
    maxTokens: 272000,
    reserveTokens: 8192,
  },
  'gpt-4o': {
    maxTokens: 128000,
    reserveTokens: 4096,
  },
  'gpt-4-turbo': {
    maxTokens: 128000,
    reserveTokens: 4096,
  },
  'gpt-3.5-turbo': {
    maxTokens: 16384,
    reserveTokens: 2048,
  },
};

export const config = {
  viva: {
    apiKey: process.env.VIVA_API_KEY || '',
    apiUrl: process.env.VIVA_API_URL || 'https://api.viva.example.com/v1/chat/completions',
    timeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '60000', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10),
    enabled: process.env.CACHE_ENABLED !== 'false',
  },
  token: {
    maxLimit: parseInt(process.env.MAX_TOKEN_LIMIT || '8192', 10),
    reserveTokens: parseInt(process.env.RESERVE_TOKENS || '1024', 10),
  },
  rateLimit: {
    requestsPerMinute: parseInt(process.env.RATE_LIMIT || '60', 10),
  },
};

export function getModelTokenConfig(modelName: string): ModelTokenConfig {
  const lowerModelName = modelName.toLowerCase();
  
  for (const [pattern, config] of Object.entries(modelTokenLimits)) {
    if (lowerModelName.includes(pattern)) {
      return config;
    }
  }
  
  return {
    maxTokens: config.token.maxLimit,
    reserveTokens: config.token.reserveTokens,
  };
}