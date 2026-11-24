import type { ChatRoute } from '../constants/chat.constants';
import type { ExchangeOutcome } from '../constants/exchange.constants';

export interface LoggedToolCall {
  tool: string;
  input: string;
}

export interface ChatExchangeEntry {
  runId: string;
  chatId: string;
  createdAtMs: number;
  route: ChatRoute;
  question: string;
  answer: string;
  outcome: ExchangeOutcome;
  cutNumbers: readonly string[];
  toolNames: readonly string[];
  toolCalls: readonly LoggedToolCall[];
}

export interface ChatExchange extends ChatExchangeEntry {
  id: string;
  costUsd: number;
}
