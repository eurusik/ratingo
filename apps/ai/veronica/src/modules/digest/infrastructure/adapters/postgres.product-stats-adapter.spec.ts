import postgres from 'postgres';

import { SourceState } from '../../domain/entities/source-reading';
import { describeWithDatabase, TEST_DATABASE_URL } from '../../../../testing/test-database.testing';

import { PostgresProductStatsAdapter } from './postgres.product-stats-adapter';

const READER_LOGIN = 'ai_reader_contract_test';
const READER_PASSWORD = 'contract-test';
const WINDOW_END_MS = Date.UTC(2026, 0, 12, 6, 0, 0);
const MEDIA_ITEM = '10000000-0000-0000-0000-0000000000a1';

const userId = (n: number): string => `00000000-0000-0000-0000-0000000000${n}0`;

const readerUrl = (): string => {
  const url = new URL(TEST_DATABASE_URL as string);
  url.username = READER_LOGIN;
  url.password = READER_PASSWORD;
  return url.toString();
};

describeWithDatabase('PostgresProductStatsAdapter against the reporting views', () => {
  let admin: postgres.Sql;
  let adapter: PostgresProductStatsAdapter;

  const clearSeed = async (): Promise<void> => {
    await admin`DELETE FROM users WHERE email LIKE '%@veronica-contract.test'`;
    await admin`DELETE FROM media_items WHERE id = ${MEDIA_ITEM}`;
  };

  const seedUser = (n: number, createdAt: string) =>
    admin`INSERT INTO users (id, email, username, created_at)
          VALUES (${userId(n)}, ${`u${n}@veronica-contract.test`}, ${`veronica_contract_${n}`}, ${createdAt})`;

  const seedAction = (n: number, action: string, createdAt: string) =>
    admin`INSERT INTO user_media_actions (user_id, media_item_id, action, created_at)
          VALUES (${userId(n)}, ${MEDIA_ITEM}, ${action}, ${createdAt})`;

  beforeAll(async () => {
    admin = postgres(TEST_DATABASE_URL as string);
    await admin.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${READER_LOGIN}') THEN
          CREATE ROLE ${READER_LOGIN} LOGIN PASSWORD '${READER_PASSWORD}' IN ROLE ai_reader;
        END IF;
      END
      $$`);
    adapter = PostgresProductStatsAdapter.connect(readerUrl());
  });

  beforeEach(async () => {
    await clearSeed();
    await admin`INSERT INTO media_items (id, type, tmdb_id, title, slug)
                VALUES (${MEDIA_ITEM}, 'movie', 990001, 'Contract', 'veronica-contract')`;
  });

  afterAll(async () => {
    await clearSeed();
    await adapter.onApplicationShutdown();
    await admin.unsafe(`DROP OWNED BY ${READER_LOGIN}`);
    await admin.unsafe(`DROP ROLE ${READER_LOGIN}`);
    await admin.end();
  });

  it('reads yesterday in Kyiv time against the same day a week earlier', async () => {
    await seedUser(1, '2026-01-04 08:00:00');
    await seedUser(2, '2026-01-11 08:00:00');
    await seedUser(3, '2026-01-11 21:30:00');
    await seedUser(4, '2026-01-11 22:30:00');
    await seedAction(1, 'save_for_later', '2026-01-04 09:00:00');
    await seedAction(2, 'save_for_later', '2026-01-11 09:00:00');
    await seedAction(2, 'subscribe', '2026-01-11 10:00:00');
    await seedAction(3, 'consider', '2026-01-11 11:00:00');

    const reading = await adapter.read(WINDOW_END_MS);

    expect(reading).toEqual({
      state: SourceState.OK,
      data: {
        newUsers: { current: 3, baseline: 1 },
        actions: { current: 3, baseline: 1 },
      },
    });
  });

  it('reports zero for a quiet day when the history reaches back past the baseline day', async () => {
    await seedUser(1, '2026-01-04 08:00:00');

    const reading = await adapter.read(WINDOW_END_MS);

    expect(reading).toEqual({
      state: SourceState.OK,
      data: {
        newUsers: { current: 0, baseline: 1 },
        actions: { current: 0, baseline: 0 },
      },
    });
  });

  it('leaves the baseline unknown when the product is younger than a week', async () => {
    await seedUser(1, '2026-01-10 08:00:00');
    await seedUser(2, '2026-01-11 08:00:00');

    const reading = await adapter.read(WINDOW_END_MS);

    expect(reading).toEqual({
      state: SourceState.OK,
      data: {
        newUsers: { current: 1, baseline: null },
        actions: { current: 0, baseline: null },
      },
    });
  });

  it('cannot read anything outside the reporting views', async () => {
    const reader = postgres(readerUrl());
    try {
      await expect(reader`SELECT count(*) FROM users`).rejects.toMatchObject({ code: '42501' });
      await expect(
        reader`SELECT count(*) FROM reporting.internal_user_events`,
      ).rejects.toMatchObject({
        code: '42501',
      });
    } finally {
      await reader.end();
    }
  });
});
