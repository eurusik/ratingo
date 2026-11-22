import { RunStatus, RunTrigger, type RunSnapshot } from '@ratingo/ai-core';

import { PostgresDigestDeliveryRepository } from '../../../digest/infrastructure/repositories/postgres.digest-delivery-repository';
import { PostgresRunRepository } from '../../../runs/infrastructure/repositories/postgres.run-repository';
import {
  describeWithDatabase,
  openTestDatabase,
  type TestDatabase,
} from '../../../../testing/test-database.testing';

import { PostgresDigestDeliveryProbe } from './postgres.digest-delivery-probe';
import { PostgresFailedRunsRepository } from './postgres.failed-runs.repository';

const NOW_MS = 1_800_000_000_000;
const HOUR_MS = 60 * 60 * 1000;

const run = (id: string, over: Partial<RunSnapshot>): RunSnapshot =>
  ({
    id,
    agent: 'veronica',
    trigger: RunTrigger.CHAT,
    model: 'fast',
    status: RunStatus.FAILED,
    startedAtMs: NOW_MS,
    turns: 0,
    usage: {},
    costUsd: 0,
    toolCalls: {},
    ...over,
  }) as RunSnapshot;

describeWithDatabase('watchdog Postgres adapters', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await openTestDatabase();
  });
  beforeEach(() => database.reset());
  afterAll(() => database.close());

  it('counts only this agent’s failed runs inside the window', async () => {
    const runs = new PostgresRunRepository(database.db);
    await runs.save(run('a', {}));
    await runs.save(run('b', { startedAtMs: NOW_MS - 2 * HOUR_MS }));
    await runs.save(run('c', { agent: 'happy' }));
    await runs.save(run('d', { status: RunStatus.COMPLETED }));
    const failed = new PostgresFailedRunsRepository(database.db);
    await expect(failed.countFailedSince('veronica', NOW_MS - HOUR_MS)).resolves.toBe(1);
    await expect(failed.countFailedSince('veronica', NOW_MS - 3 * HOUR_MS)).resolves.toBe(2);
  });

  it('sees a digest only once it is marked sent', async () => {
    const deliveries = new PostgresDigestDeliveryRepository(database.db);
    const probe = new PostgresDigestDeliveryProbe(database.db);
    await expect(probe.isSentOn('2026-12-10')).resolves.toBe(false);
    await deliveries.claim('2026-12-10', NOW_MS, 1000);
    await expect(probe.isSentOn('2026-12-10')).resolves.toBe(false);
    await deliveries.markSent({ date: '2026-12-10', sentAtMs: NOW_MS, silent: false, runId: null });
    await expect(probe.isSentOn('2026-12-10')).resolves.toBe(true);
    await expect(probe.isSentOn('2026-12-11')).resolves.toBe(false);
  });
});
