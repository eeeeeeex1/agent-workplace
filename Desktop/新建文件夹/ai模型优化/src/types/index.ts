export interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage: Usage;
}

export interface Choice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface CacheEntry {
  response: LLMResponse;
  timestamp: number;
  usage: Usage;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
}

export interface RequestPriority {
  HIGH: 'high';
  NORMAL: 'normal';
  LOW: 'low';
}

export interface QueuedRequest {
  id: string;
  request: LLMRequest;
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
  resolve: (value: LLMResponse) => void;
  reject: (reason: Error) => void;
}

export interface BatchResult {
  results: Array<{ requestId: string; response: LLMResponse }>;
  errors: Array<{ requestId: string; error: Error }>;
}