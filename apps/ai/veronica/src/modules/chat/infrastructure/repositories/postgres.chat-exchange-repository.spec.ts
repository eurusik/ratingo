import { RunStatus, RunTrigger, type RunSnapshot } from '@ratingo/ai-core';

import { PostgresRunRepository } from '../../../runs/infrastructure/repositories/postgres.run-repository';
import {
  describeWithDatabase,
  openTestDatabase,
  type TestDatabase,
} from '../../../../testing/test-database.testing';
import { ChatRoute } from '../../domain/constants/chat.constants';
import { ExchangeOutcome } from '../../domain/constants/exchange.constants';
import type { ChatExchangeEntry } from '../../domain/entities/chat-exchange';

import { PostgresChatExchangeRepository } from './postgres.chat-exchange-repository';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = 1_800_000_000_000;

const run = (id: string, costUsd: number): RunSnapshot => ({
  id,
  agent: 'veronica',
  task: 'chat',
  trigger: RunTrigger.CHAT,
  model: 'fast',
  status: RunStatus.COMPLETED,
  startedAtMs: NOW_MS,
  turns: 1,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } as never,
  costUsd,
  toolCalls: {},
});

const entry = (runId: string, overrides: Partial<ChatExchangeEntry> = {}): ChatExchangeEntry => ({
  runId,
  chatId: '10',
  createdAtMs: NOW_MS,
  route: ChatRoute.INVESTIGATION,
  question: 'питання',
  answer: 'відповідь',
  outcome: ExchangeOutcome.ANSWERED,
  cutNumbers: [],
  toolNames: ['metrics_query'],
  ...overrides,
});

describeWithDatabase('PostgresChatExchangeRepository', () => {
  let database: TestDatabase;
  let repository: PostgresChatExchangeRepository;
  let runs: PostgresRunRepository;

  beforeAll(async () => {
    database = await openTestDatabase();
    repository = new PostgresChatExchangeRepository(database.db);
    runs = new PostgresRunRepository(database.db);
  });
  beforeEach(() => database.reset());
  afterAll(() => database.close());

  it('stores an exchange and reads it back with the run cost', async () => {
    await runs.save(run('r1', 0.0123));
    await repository.record(entry('r1', { cutNumbers: ['42'] }));
    const [found] = await repository.search({ sinceMs: NOW_MS - DAY_MS });
    expect(found).toMatchObject({
      runId: 'r1',
      question: 'питання',
      cutNumbers: ['42'],
      toolNames: ['metrics_query'],
      costUsd: 0.0123,
      createdAtMs: NOW_MS,
    });
  });

  it('rejects an exchange that points at no run', async () => {
    await expect(repository.record(entry('missing'))).rejects.toThrow();
  });

  it('filters by outcome and by time window', async () => {
    await runs.save(run('r1', 0));
    await runs.save(run('r2', 0));
    await runs.save(run('r3', 0));
    await repository.record(entry('r1'));
    await repository.record(entry('r2', { outcome: ExchangeOutcome.REDACTED }));
    await repository.record(entry('r3', { createdAtMs: NOW_MS - 10 * DAY_MS }));
    const redacted = await repository.search({
      sinceMs: NOW_MS - DAY_MS,
      outcomes: [ExchangeOutcome.REDACTED],
    });
    expect(redacted.map((found) => found.runId)).toEqual(['r2']);
    expect(await repository.search({ sinceMs: NOW_MS - DAY_MS })).toHaveLength(2);
  });

  it('lists the newest conversational exchanges of one chat, skipping commands', async () => {
    for (const id of ['r1', 'r2', 'r3', 'r4']) await runs.save(run(id, 0));
    await repository.record(entry('r1', { createdAtMs: NOW_MS - 3000 }));
    await repository.record(entry('r2', { createdAtMs: NOW_MS - 2000, route: ChatRoute.COMMAND }));
    await repository.record(entry('r3', { createdAtMs: NOW_MS - 1000, chatId: '99' }));
    await repository.record(entry('r4', { createdAtMs: NOW_MS, route: ChatRoute.HAPPY }));
    const recent = await repository.recentConversational('10', 3);
    expect(recent.map((found) => found.runId)).toEqual(['r4', 'r1']);
  });

  it('deletes only rows older than the cutoff and is safe to repeat', async () => {
    await runs.save(run('r1', 0));
    await runs.save(run('r2', 0));
    await repository.record(entry('r1', { createdAtMs: NOW_MS - 31 * DAY_MS }));
    await repository.record(entry('r2'));
    const cutoff = NOW_MS - 30 * DAY_MS;
    expect(await repository.deleteOlderThan(cutoff)).toBe(1);
    expect(await repository.deleteOlderThan(cutoff)).toBe(0);
    expect(await repository.search({ sinceMs: 0 })).toHaveLength(1);
  });
});
