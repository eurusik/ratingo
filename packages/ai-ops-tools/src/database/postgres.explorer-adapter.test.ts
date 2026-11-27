import { join } from 'node:path';

import { RowList, fitRowList } from '@ratingo/ai-core';

import {
  createExplorerTestDatabase,
  type ExplorerTestDatabase,
} from '../testing/explorer-database';
import { EXPLORER_FIXTURE, seedExplorerFixture } from '../testing/explorer-fixture';
import { recordingLogger } from '../testing/recording-logger';

import { DB_SCHEMA_OUTPUT_CAP, QueryRefusal } from './database.constants';
import { ExplorerQueryRefusedError } from './database.port';
import { DbQueryExecutor } from './db-query.executor';
import { DbSchemaExecutor } from './db-schema.executor';
import { PostgresExplorerAdapter } from './postgres.explorer-adapter';

const ADMIN_URL = process.env.EXPLORER_TEST_DATABASE_URL;
const describeWithDatabase = ADMIN_URL ? describe : describe.skip;
const MIGRATIONS = join(__dirname, '../../../../apps/api/drizzle_v2');
const SHORT_TIMEOUT_MS = 200;

const refusalOf = async (run: () => Promise<unknown>): Promise<string | undefined> => {
  try {
    await run();
    return undefined;
  } catch (error) {
    return error instanceof ExplorerQueryRefusedError ? error.refusal : 'other';
  }
};

describeWithDatabase('PostgresExplorerAdapter against the migrated database as ai_explorer', () => {
  let database: ExplorerTestDatabase;
  let adapter: PostgresExplorerAdapter;
  let quick: PostgresExplorerAdapter;

  const query = (sql: string, explain = false) => adapter.query({ sql, explain, rowLimit: 100 });

  beforeAll(async () => {
    database = await createExplorerTestDatabase({
      adminUrl: ADMIN_URL as string,
      migrationsFolder: MIGRATIONS,
    });
    await seedExplorerFixture(database.admin, { heavy: true });
    adapter = PostgresExplorerAdapter.connect(database.explorerUrl);
    quick = PostgresExplorerAdapter.connect(database.explorerUrl, {
      statementTimeoutMs: SHORT_TIMEOUT_MS,
    });
  });

  afterAll(async () => {
    await adapter.close();
    await quick.close();
    await database.close();
  });

  describe('schema', () => {
    it('lists only readable columns, counts the hidden ones and names the closed tables', async () => {
      const listing = await adapter.schema();
      const users = listing.tables.find((table) => table.name === 'users');

      expect(users?.columns.map((column) => column.name)).toEqual([
        'id',
        'preferred_language',
        'preferred_region',
        'is_profile_public',
        'show_watch_history',
        'show_ratings',
        'allow_followers',
        'role',
        'created_at',
        'updated_at',
        'deleted_at',
        'auto_subscribe_on_watch',
      ]);
      expect(users?.privateColumnCount).toBe(7);
      expect([...listing.privateTables].sort()).toEqual([
        'oauth_accounts',
        'oauth_exchange_codes',
        'refresh_tokens',
      ]);
      expect(listing.tables.map((table) => table.name)).not.toContain('oauth_accounts');
    });

    it('shows the values of an enum column and the kind of a view', async () => {
      const listing = await adapter.schema();
      const saved = listing.tables.find((table) => table.name === 'user_saved_items');
      const view = listing.tables.find((table) => table.name === 'public_media_items');

      expect(saved?.columns.find((column) => column.name === 'list')?.enumValues).toEqual([
        'for_later',
        'considering',
      ]);
      expect([view?.kind, view?.rowEstimate]).toEqual(['view', null]);
    });
  });

  describe('query', () => {
    it('returns bigint counts as exact text, small integers as numbers and timestamps as text', async () => {
      const counted = await query('SELECT count(*) AS total, count(*)::int AS small FROM users');
      const stamped = await query('SELECT created_at FROM users LIMIT 1');

      expect(counted.rows).toEqual([
        { total: String(EXPLORER_FIXTURE.totalUsers), small: EXPLORER_FIXTURE.totalUsers },
      ]);
      expect(typeof stamped.rows[0]?.created_at).toBe('string');
    });

    it('runs a WITH statement inside the row-limit wrapper', async () => {
      const result = await query('WITH numbers AS (SELECT 1 AS n) SELECT n FROM numbers');

      expect(result.rows).toEqual([{ n: 1 }]);
    });

    it('cuts a very long text and a very long json value and says how long they were', async () => {
      const text = await query("SELECT repeat('x', 5000) AS body");
      const json = await query("SELECT jsonb_build_object('items', repeat('y', 5000)) AS payload");

      expect(String(text.rows[0]?.body)).toContain('[cut, 5000 characters in total]');
      expect(String(json.rows[0]?.payload)).toContain('[cut, ');
      expect(String(text.rows[0]?.body).length).toBeLessThan(1100);
    });

    it('stops at the row limit and says that more rows exist', async () => {
      const result = await query('SELECT g FROM generate_series(1, 150) AS g');

      expect([result.rows.length, result.hasMoreRows]).toEqual([100, true]);
    });

    it('returns the plan and runs nothing when asked to explain', async () => {
      const result = await query('SELECT * FROM media_items', true);

      expect(String(Object.values(result.rows[0] ?? {})[0])).toContain('media_items');
    });

    it.each([
      ['a private column', 'SELECT email FROM users', QueryRefusal.PRIVATE],
      ['a whole row of a mixed table', 'SELECT * FROM users', QueryRefusal.PRIVATE],
      ['a closed column', 'SELECT notes FROM user_media_state', QueryRefusal.PRIVATE],
      ['a private table', 'SELECT 1 AS one FROM oauth_accounts', QueryRefusal.PRIVATE],
      ['a missing table', 'SELECT 1 FROM no_such_table', QueryRefusal.NOT_FOUND],
      ['a missing column', 'SELECT no_such_column FROM users', QueryRefusal.NOT_FOUND],
      ['a bad statement', 'SELEC 1', QueryRefusal.INVALID_QUERY],
      ['a division by zero', 'SELECT 1 / 0', QueryRefusal.INVALID_QUERY],
      [
        'a write',
        "INSERT INTO genres (tmdb_id, name, slug) VALUES (99, 'x', 'x')",
        QueryRefusal.INVALID_QUERY,
      ],
    ])('refuses %s with the right class', async (_label, sql, refusal) => {
      expect(await refusalOf(() => query(sql))).toBe(refusal);
    });

    it('cancels a heavy query at the timeout and stays usable afterwards', async () => {
      const heavy = `SELECT count(*) FROM media_watchers_snapshots a
                     JOIN media_watchers_snapshots b ON a.media_item_id = b.media_item_id
                      AND a.snapshot_date < b.snapshot_date AND a.total_watchers > b.total_watchers`;

      const refusal = await refusalOf(() =>
        quick.query({ sql: heavy, explain: false, rowLimit: 100 }),
      );
      const after = await quick.query({ sql: 'SELECT 1 AS ok', explain: false, rowLimit: 100 });

      expect([refusal, after.rows]).toEqual([QueryRefusal.TIMEOUT, [{ ok: 1 }]]);
    });

    it('does not let one call change the limits of the next one', async () => {
      await quick.query({
        sql: "SELECT set_config('statement_timeout', '0', false)",
        explain: false,
        rowLimit: 100,
      });

      const refusal = await refusalOf(() =>
        quick.query({ sql: 'SELECT pg_sleep(2)', explain: false, rowLimit: 100 }),
      );

      expect(refusal).toBe(QueryRefusal.TIMEOUT);
    });

    it.each([
      ['ending a session', 'SELECT pg_terminate_backend(pg_backend_pid())'],
      ['cancelling a query', 'SELECT pg_cancel_backend(pg_backend_pid())'],
      ['taking an advisory lock', 'SELECT pg_advisory_lock(4242)'],
    ])(
      'is not allowed to run a function for %s, and says so instead of calling it private',
      async (_label, sql) => {
        expect(await refusalOf(() => query(sql))).toBe(QueryRefusal.NOT_ALLOWED);
      },
    );
  });

  describe('the schema listing', () => {
    it('lists the whole real schema within its output cap, with no table left out', async () => {
      const executor = new DbSchemaExecutor(adapter, recordingLogger());

      const text = fitRowList((await executor.run({})) as RowList, DB_SCHEMA_OUTPUT_CAP);

      const parsed = JSON.parse(text) as { tables: { table: string }[]; omitted?: number };
      expect(parsed.omitted).toBeUndefined();
      expect(parsed.tables.length).toBeGreaterThanOrEqual(30);
      expect(text.length).toBeLessThan(DB_SCHEMA_OUTPUT_CAP);
    });
  });

  describe('through the executor', () => {
    it('answers a private read with a status and the real database message', async () => {
      const executor = new DbQueryExecutor(adapter, recordingLogger());

      const result = (await executor.run({ sql: 'SELECT email FROM users' })) as {
        status: string;
        message: string;
      };

      expect(result.status).toBe('private');
      expect(result.message).toContain('permission denied for table users');
      expect(result.message).not.toContain(EXPLORER_FIXTURE.userEmailDomain);
    });

    it('returns the fixture numbers for the questions the evals ask', async () => {
      const executor = new DbQueryExecutor(adapter, recordingLogger());
      const rowsOf = async (sql: string) =>
        (((await executor.run({ sql })) as RowList).withAllRows() as { rows: unknown[] }).rows;

      expect(
        await rowsOf(
          "SELECT count(*)::int AS n FROM media_items WHERE type = 'show' AND poster_path IS NULL",
        ),
      ).toEqual([{ n: EXPLORER_FIXTURE.showsWithoutPoster }]);
      expect(
        await rowsOf(`SELECT m.title, count(*)::int AS saves FROM user_saved_items s
                      JOIN media_items m ON m.id = s.media_item_id
                      WHERE s.created_at >= now() - interval '7 days'
                      GROUP BY m.title ORDER BY saves DESC, m.title`),
      ).toEqual(EXPLORER_FIXTURE.topSavedThisWeek);
    });
  });
});
