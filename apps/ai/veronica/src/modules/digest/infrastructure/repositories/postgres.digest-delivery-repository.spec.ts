import {
  describeWithDatabase,
  openTestDatabase,
  type TestDatabase,
} from '../../../../testing/test-database.testing';

import { PostgresDigestDeliveryRepository } from './postgres.digest-delivery-repository';

const DATE = '2026-11-22';
const STALE_MS = 500;

describeWithDatabase('PostgresDigestDeliveryRepository', () => {
  let database: TestDatabase;
  let repository: PostgresDigestDeliveryRepository;

  beforeAll(async () => {
    database = await openTestDatabase();
    repository = new PostgresDigestDeliveryRepository(database.db);
  });
  beforeEach(() => database.reset());
  afterAll(() => database.close());

  it('lets exactly one of two simultaneous claims win', async () => {
    const results = await Promise.all([
      repository.claim(DATE, 1000, STALE_MS),
      repository.claim(DATE, 1000, STALE_MS),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('reclaims only a stale claim that never started sending', async () => {
    expect(await repository.claim(DATE, 1000, STALE_MS)).toBe(true);
    expect(await repository.claim(DATE, 1200, STALE_MS)).toBe(false);
    expect(await repository.claim(DATE, 2000, STALE_MS)).toBe(true);
  });

  it('never reclaims a claim that reached the sending step', async () => {
    await repository.claim(DATE, 1000, STALE_MS);
    await repository.markSending(DATE);
    expect(await repository.claim(DATE, 999_999, STALE_MS)).toBe(false);
  });

  it('releases an unsent claim but never a sent one', async () => {
    await repository.claim(DATE, 1000, STALE_MS);
    await repository.release(DATE);
    expect(await repository.claim(DATE, 1100, STALE_MS)).toBe(true);
    await repository.markSent({ date: DATE, sentAtMs: 1200, silent: true, runId: 'r' });
    await repository.release(DATE);
    expect(await repository.claim(DATE, 999_999, STALE_MS)).toBe(false);
  });
});
