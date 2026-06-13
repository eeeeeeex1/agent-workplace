import { ChatMessage } from '../types';

export class TokenEstimator {
  private readonly CHARS_PER_TOKEN = 3.5;
  private readonly MESSAGE_OVERHEAD = 4;
  private readonly ROLE_OVERHEAD = 2;

  estimateTokenCount(text: string): number {
    const charCount = text.length;
    const tokenCount = Math.ceil(charCount / this.CHARS_PER_TOKEN);
    return tokenCount;
  }

  estimateMessageTokenCount(message: ChatMessage): number {
    const contentTokens = this.estimateTokenCount(message.content);
    return contentTokens + this.MESSAGE_OVERHEAD + this.ROLE_OVERHEAD;
  }

  estimateMessagesTokenCount(messages: ChatMessage[]): number {
    return messages.reduce((total, msg) => total + this.estimateMessageTokenCount(msg), 0);
  }

  calculateRemainingTokens(messages: ChatMessage[], maxTokens: number, reserveTokens: number): number {
    const usedTokens = this.estimateMessagesTokenCount(messages);
    return maxTokens - usedTokens - reserveTokens;
  }
}