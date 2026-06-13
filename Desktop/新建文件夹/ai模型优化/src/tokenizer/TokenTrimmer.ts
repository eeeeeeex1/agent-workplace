import { ChatMessage } from '../types';
import { TokenEstimator } from './TokenEstimator';
import { config, getModelTokenConfig, ModelTokenConfig } from '../config';

export class TokenTrimmer {
  private tokenEstimator: TokenEstimator;
  private defaultMaxTokens: number;
  private defaultReserveTokens: number;

  constructor() {
    this.tokenEstimator = new TokenEstimator();
    this.defaultMaxTokens = config.token.maxLimit;
    this.defaultReserveTokens = config.token.reserveTokens;
  }

  private getTokenConfig(modelName?: string): ModelTokenConfig {
    if (!modelName) {
      return {
        maxTokens: this.defaultMaxTokens,
        reserveTokens: this.defaultReserveTokens,
      };
    }
    return getModelTokenConfig(modelName);
  }

  trimMessages(messages: ChatMessage[], modelName?: string): ChatMessage[] {
    const tokenConfig = this.getTokenConfig(modelName);
    const totalTokens = this.tokenEstimator.estimateMessagesTokenCount(messages);
    const availableTokens = tokenConfig.maxTokens - tokenConfig.reserveTokens;

    if (totalTokens <= availableTokens) {
      return messages;
    }

    return this.intelligentTrim(messages, availableTokens);
  }

  private intelligentTrim(messages: ChatMessage[], availableTokens: number): ChatMessage[] {
    const trimmedMessages: ChatMessage[] = [];
    let usedTokens = 0;

    const systemMessages = messages.filter(m => m.role === 'system');
    const userAssistantMessages = messages.filter(m => m.role !== 'system');

    for (const sysMsg of systemMessages) {
      const msgTokens = this.tokenEstimator.estimateMessageTokenCount(sysMsg);
      if (usedTokens + msgTokens <= availableTokens) {
        trimmedMessages.push(sysMsg);
        usedTokens += msgTokens;
      } else {
        const trimmedContent = this.trimContent(sysMsg.content, availableTokens - usedTokens);
        if (trimmedContent) {
          trimmedMessages.push({ ...sysMsg, content: trimmedContent });
          usedTokens += this.tokenEstimator.estimateMessageTokenCount({ ...sysMsg, content: trimmedContent });
        }
      }
    }

    const remainingTokens = availableTokens - usedTokens;
    if (remainingTokens > 0) {
      const trimmedUserAssistant = this.trimConversationHistory(userAssistantMessages, remainingTokens);
      trimmedMessages.push(...trimmedUserAssistant);
    }

    return trimmedMessages;
  }

  private trimConversationHistory(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
    if (messages.length === 0) return [];

    const reversedMessages = [...messages].reverse();
    const trimmed: ChatMessage[] = [];
    let usedTokens = 0;

    for (const msg of reversedMessages) {
      const msgTokens = this.tokenEstimator.estimateMessageTokenCount(msg);

      if (usedTokens + msgTokens <= maxTokens) {
        trimmed.push(msg);
        usedTokens += msgTokens;
      } else {
        const remaining = maxTokens - usedTokens;
        if (remaining > 0) {
          const trimmedContent = this.trimContent(msg.content, remaining);
          if (trimmedContent) {
            trimmed.push({ ...msg, content: `...${trimmedContent}` });
            usedTokens += remaining;
          }
        }
        break;
      }
    }

    return trimmed.reverse();
  }

  private trimContent(content: string, maxTokens: number): string {
    if (maxTokens <= 0) return '';

    const maxChars = Math.floor(maxTokens * 3.5);

    if (content.length <= maxChars) {
      return content;
    }

    return this.smartTruncate(content, maxChars);
  }

  private smartTruncate(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    const sentences = content.split(/(?<=[.!?])\s+/);
    let result = '';
    let length = 0;

    for (const sentence of sentences) {
      if (length + sentence.length <= maxLength) {
        result += (result ? ' ' : '') + sentence;
        length += sentence.length + (result ? 1 : 0);
      } else {
        const remaining = maxLength - length;
        if (remaining > 10) {
          const truncated = sentence.substring(0, remaining - 3) + '...';
          result += (result ? ' ' : '') + truncated;
        }
        break;
      }
    }

    return result || content.substring(0, maxLength - 3) + '...';
  }

  trimSingleMessage(message: ChatMessage, maxTokens: number): ChatMessage {
    const currentTokens = this.tokenEstimator.estimateMessageTokenCount(message);
    
    if (currentTokens <= maxTokens) {
      return message;
    }

    const trimmedContent = this.trimContent(message.content, maxTokens - 6);
    return {
      ...message,
      content: trimmedContent,
    };
  }

  getTrimStats(messages: ChatMessage[], modelName?: string): {
    originalTokens: number;
    trimmedTokens: number;
    reductionPercent: string;
    messagesTrimmed: number;
    modelMaxTokens: number;
  } {
    const tokenConfig = this.getTokenConfig(modelName);
    const originalTokens = this.tokenEstimator.estimateMessagesTokenCount(messages);
    const trimmed = this.trimMessages(messages, modelName);
    const trimmedTokens = this.tokenEstimator.estimateMessagesTokenCount(trimmed);
    
    const trimmedCount = messages.length - trimmed.length;

    return {
      originalTokens,
      trimmedTokens,
      reductionPercent: originalTokens > 0 ? ((1 - trimmedTokens / originalTokens) * 100).toFixed(2) : '0',
      messagesTrimmed: trimmedCount,
      modelMaxTokens: tokenConfig.maxTokens,
    };
  }

  getModelTokenLimit(modelName: string): number {
    return getModelTokenConfig(modelName).maxTokens;
  }
}