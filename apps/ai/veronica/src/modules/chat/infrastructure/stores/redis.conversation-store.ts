import type IORedis from 'ioredis';

import {
  CONVERSATION_MAX_MESSAGES,
  CONVERSATION_MESSAGE_MAX_CHARS,
  CONVERSATION_TTL_SECONDS,
} from '../../domain/constants/investigation.constants';
import { TurnRole, type ConversationTurn } from '../../domain/entities/conversation-turn';
import { clip } from '../../domain/policies/answer-sanitizer.policy';
import type { ConversationStorePort } from '../../domain/ports/conversation-store.port';

const KEY_PREFIX = 'ai-veronica:conversation:';

const isTurn = (value: unknown): value is ConversationTurn => {
  const candidate = value as Partial<ConversationTurn> | null;
  return (
    (candidate?.role === TurnRole.USER || candidate?.role === TurnRole.ASSISTANT) &&
    typeof candidate.text === 'string'
  );
};

const parseTurn = (raw: string): ConversationTurn[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isTurn(parsed) ? [{ role: parsed.role, text: parsed.text }] : [];
  } catch {
    return [];
  }
};

export class RedisConversationStore implements ConversationStorePort {
  constructor(private readonly redis: Pick<IORedis, 'lrange' | 'multi'>) {}

  async recent(chatId: string): Promise<ConversationTurn[]> {
    const raw = await this.redis.lrange(this.keyOf(chatId), -CONVERSATION_MAX_MESSAGES, -1);
    return raw.flatMap(parseTurn);
  }

  async append(chatId: string, turns: readonly ConversationTurn[]): Promise<void> {
    if (turns.length === 0) return;
    const key = this.keyOf(chatId);
    const serialized = turns.map((turn) =>
      JSON.stringify({ role: turn.role, text: clip(turn.text, CONVERSATION_MESSAGE_MAX_CHARS) }),
    );
    await this.redis
      .multi()
      .rpush(key, ...serialized)
      .ltrim(key, -CONVERSATION_MAX_MESSAGES, -1)
      .expire(key, CONVERSATION_TTL_SECONDS)
      .exec();
  }

  private keyOf(chatId: string): string {
    return `${KEY_PREFIX}${chatId}`;
  }
}
