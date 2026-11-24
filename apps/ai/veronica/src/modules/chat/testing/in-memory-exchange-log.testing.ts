import { ChatRoute } from '../domain/constants/chat.constants';
import type { ChatExchange, ChatExchangeEntry } from '../domain/entities/chat-exchange';
import type { ChatExchangeLogPort, ExchangeSearch } from '../domain/ports/chat-exchange-log.port';

export class InMemoryChatExchangeLog implements ChatExchangeLogPort {
  readonly entries: ChatExchangeEntry[] = [];
  failure: Error | null = null;
  costUsd = 0;

  async record(entry: ChatExchangeEntry): Promise<void> {
    if (this.failure !== null) throw this.failure;
    this.entries.push(entry);
  }

  async recentConversational(chatId: string, limit: number): Promise<ChatExchange[]> {
    return this.entries
      .filter((entry) => entry.chatId === chatId && entry.route !== ChatRoute.COMMAND)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, limit)
      .map((entry, index) => this.withId(entry, index));
  }

  async search(query: ExchangeSearch): Promise<ChatExchange[]> {
    return this.entries
      .filter(
        (entry) =>
          entry.createdAtMs >= query.sinceMs &&
          (query.outcomes === undefined ||
            query.outcomes.length === 0 ||
            query.outcomes.includes(entry.outcome)),
      )
      .map((entry, index) => this.withId(entry, index));
  }

  async deleteOlderThan(cutoffMs: number): Promise<number> {
    const kept = this.entries.filter((entry) => entry.createdAtMs >= cutoffMs);
    const deleted = this.entries.length - kept.length;
    this.entries.splice(0, this.entries.length, ...kept);
    return deleted;
  }

  private withId(entry: ChatExchangeEntry, index: number): ChatExchange {
    return {
      ...entry,
      id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
      costUsd: this.costUsd,
    };
  }
}
