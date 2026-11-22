import type { ExchangeOutcome } from '../constants/exchange.constants';
import type { ChatExchange, ChatExchangeEntry } from '../entities/chat-exchange';

export interface ExchangeSearch {
  sinceMs: number;
  outcomes?: readonly ExchangeOutcome[];
}

export interface ChatExchangeLogPort {
  record(entry: ChatExchangeEntry): Promise<void>;
  recentConversational(chatId: string, limit: number): Promise<ChatExchange[]>;
  search(query: ExchangeSearch): Promise<ChatExchange[]>;
  deleteOlderThan(cutoffMs: number): Promise<number>;
}

export const CHAT_EXCHANGE_LOG = Symbol('CHAT_EXCHANGE_LOG');
