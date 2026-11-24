import { and, desc, eq, gte, inArray, lt, ne } from 'drizzle-orm';

import type { Database } from '../../../../database/database.module';
import { chatExchanges, runs } from '../../../../database/schema';
import { ChatRoute } from '../../domain/constants/chat.constants';
import type { ExchangeOutcome } from '../../domain/constants/exchange.constants';
import type {
  ChatExchange,
  ChatExchangeEntry,
  LoggedToolCall,
} from '../../domain/entities/chat-exchange';
import type {
  ChatExchangeLogPort,
  ExchangeSearch,
} from '../../domain/ports/chat-exchange-log.port';

const selection = {
  id: chatExchanges.id,
  runId: chatExchanges.runId,
  chatId: chatExchanges.chatId,
  createdAt: chatExchanges.createdAt,
  route: chatExchanges.route,
  question: chatExchanges.question,
  answer: chatExchanges.answer,
  outcome: chatExchanges.outcome,
  flaggedNumbers: chatExchanges.flaggedNumbers,
  toolNames: chatExchanges.toolNames,
  toolCalls: chatExchanges.toolCalls,
  costUsd: runs.costUsd,
};

type ExchangeRow = {
  [Key in keyof typeof selection]: (typeof selection)[Key]['_']['data'];
};

const fromRow = (row: ExchangeRow): ChatExchange => ({
  id: row.id,
  runId: row.runId,
  chatId: row.chatId,
  createdAtMs: row.createdAt.getTime(),
  route: row.route as ChatRoute,
  question: row.question,
  answer: row.answer,
  outcome: row.outcome as ExchangeOutcome,
  flaggedNumbers: row.flaggedNumbers as string[],
  toolNames: row.toolNames as string[],
  toolCalls: (row.toolCalls ?? []) as LoggedToolCall[],
  costUsd: row.costUsd,
});

export class PostgresChatExchangeRepository implements ChatExchangeLogPort {
  constructor(private readonly db: Database) {}

  async record(entry: ChatExchangeEntry): Promise<void> {
    await this.db.insert(chatExchanges).values({
      runId: entry.runId,
      chatId: entry.chatId,
      createdAt: new Date(entry.createdAtMs),
      route: entry.route,
      question: entry.question,
      answer: entry.answer,
      outcome: entry.outcome,
      flaggedNumbers: [...entry.flaggedNumbers],
      toolNames: [...entry.toolNames],
      toolCalls: entry.toolCalls.map((call) => ({ ...call })),
    });
  }

  async recentConversational(chatId: string, limit: number): Promise<ChatExchange[]> {
    const rows = await this.db
      .select(selection)
      .from(chatExchanges)
      .innerJoin(runs, eq(runs.id, chatExchanges.runId))
      .where(and(eq(chatExchanges.chatId, chatId), ne(chatExchanges.route, ChatRoute.COMMAND)))
      .orderBy(desc(chatExchanges.createdAt))
      .limit(limit);
    return rows.map(fromRow);
  }

  async search(query: ExchangeSearch): Promise<ChatExchange[]> {
    const conditions = [gte(chatExchanges.createdAt, new Date(query.sinceMs))];
    if (query.outcomes !== undefined && query.outcomes.length > 0) {
      conditions.push(inArray(chatExchanges.outcome, [...query.outcomes]));
    }
    const rows = await this.db
      .select(selection)
      .from(chatExchanges)
      .innerJoin(runs, eq(runs.id, chatExchanges.runId))
      .where(and(...conditions))
      .orderBy(chatExchanges.createdAt);
    return rows.map(fromRow);
  }

  async deleteOlderThan(cutoffMs: number): Promise<number> {
    const deleted = await this.db
      .delete(chatExchanges)
      .where(lt(chatExchanges.createdAt, new Date(cutoffMs)))
      .returning({ id: chatExchanges.id });
    return deleted.length;
  }
}
