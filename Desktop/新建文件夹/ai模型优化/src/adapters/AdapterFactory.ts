import { LLMAdapter } from './LLMAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';
import { DoubaoAdapter } from './DoubaoAdapter';
import { ERNIEAdapter } from './ERNIEAdapter';
import { VivaAdapter } from './VivaAdapter';
import { VivaClaudeAdapter } from './VivaClaudeAdapter';
import { VivaGPTAdapter } from './VivaGPTAdapter';

export type ProviderType = 'openai' | 'doubao' | 'ernie' | 'viva' | 'viva-claude' | 'viva-gpt';

export interface AdapterConfig {
  provider: ProviderType;
  apiKey: string;
  secretKey?: string;
  baseUrl?: string;
}

export class AdapterFactory {
  private static instances = new Map<string, LLMAdapter>();

  static create(config: AdapterConfig): LLMAdapter {
    const cacheKey = `${config.provider}:${config.apiKey}`;
    
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)!;
    }

    let adapter: LLMAdapter;

    switch (config.provider) {
      case 'openai':
        adapter = new OpenAIAdapter(config.apiKey, config.baseUrl);
        break;
      case 'doubao':
        adapter = new DoubaoAdapter(config.apiKey, config.secretKey || '');
        break;
      case 'ernie':
        adapter = new ERNIEAdapter(config.apiKey, config.secretKey || '');
        break;
      case 'viva':
        adapter = new VivaAdapter(config.apiKey, config.baseUrl);
        break;
      case 'viva-claude':
        adapter = new VivaClaudeAdapter(config.apiKey, config.baseUrl);
        break;
      case 'viva-gpt':
        adapter = new VivaGPTAdapter(config.apiKey, config.baseUrl);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }

    this.instances.set(cacheKey, adapter);
    return adapter;
  }

  static getAdapter(provider: ProviderType): LLMAdapter | undefined {
    for (const [key, adapter] of this.instances) {
      if (key.startsWith(provider)) {
        return adapter;
      }
    }
    return undefined;
  }

  static clearCache(): void {
    this.instances.clear();
  }
}