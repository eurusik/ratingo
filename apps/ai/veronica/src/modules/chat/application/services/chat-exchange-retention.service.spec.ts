import { FixedClock } from '@ratingo/ai-core';

import { EXCHANGE_RETENTION_MS } from '../../domain/constants/exchange.constants';
import { InMemoryChatExchangeLog } from '../../testing/in-memory-exchange-log.testing';
import { ChatRoute } from '../../domain/constants/chat.constants';
import { ExchangeOutcome } from '../../domain/constants/exchange.constants';

import { ChatExchangeRetention } from './chat-exchange-retention.service';

const NOW_MS = 1_800_000_000_000;

const entryAt = (createdAtMs: number) => ({
  runId: 'r',
  chatId: '10',
  createdAtMs,
  route: ChatRoute.INVESTIGATION,
  question: 'q',
  answer: 'a',
  outcome: ExchangeOutcome.ANSWERED,
  flaggedNumbers: [],
  toolNames: [],
  toolCalls: [],
});

describe('ChatExchangeRetention', () => {
  it('purges rows past retention and does nothing the second time', async () => {
    const log = new InMemoryChatExchangeLog();
    await log.record(entryAt(NOW_MS - EXCHANGE_RETENTION_MS - 1));
    await log.record(entryAt(NOW_MS));
    const retention = new ChatExchangeRetention(log, new FixedClock(NOW_MS));
    await expect(retention.purge()).resolves.toBe(1);
    await expect(retention.purge()).resolves.toBe(0);
    expect(log.entries).toHaveLength(1);
  });
});
