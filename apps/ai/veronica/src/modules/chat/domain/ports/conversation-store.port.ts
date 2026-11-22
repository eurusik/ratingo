import type { ConversationTurn } from '../entities/conversation-turn';

export interface ConversationStorePort {
  recent(chatId: string): Promise<ConversationTurn[]>;
  append(chatId: string, turns: readonly ConversationTurn[]): Promise<void>;
}

export const CONVERSATION_STORE = Symbol('CONVERSATION_STORE');
