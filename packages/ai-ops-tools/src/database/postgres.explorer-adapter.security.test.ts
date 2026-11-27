import { join } from 'node:path';

import fc from 'fast-check';

import {
  createExplorerTestDatabase,
  type ExplorerTestDatabase,
} from '../testing/explorer-database';
import { seedExplorerFixture } from '../testing/explorer-fixture';
import { startStallingProxy } from '../testing/stalling-proxy';
import {
  DATABASE_SETUP_TIMEOUT_MS,
  DATABASE_TEARDOWN_TIMEOUT_MS,
  DATABASE_TEST_TIMEOUT_MS,
} from '../testing/explorer-test-timeouts';

import { QueryRefusal } from './database.constants';
import { ExplorerFailureError, ExplorerQueryRefusedError } from './database.port';
import { PostgresExplorerAdapter } from './postgres.explorer-adapter';
import { readOnlyStatement } from './sql-statement.policy';

const ADMIN_URL = process.env.EXPLORER_TEST_DATABASE_URL;
const describeWithDatabase = ADMIN_URL ? describe : describe.skip;

jest.setTimeout(DATABASE_TEST_TIMEOUT_MS);
const MIGRATIONS = join(__dirname, '../../../../apps/api/drizzle_v2');
const SETTLE_MS = 400;
const PROPERTY_RUNS = 60;

const BYPASS =
  'select 1 as é$a$) q; commit; set statement_timeout=0; create temp table pwn(a int); select * from (select pg_sleep(0.1) as é$a$';

const FRAGMENTS = [
  ';',
  ' commit ',
  ' rollback ',
  ' set statement_timeout = 0 ',
  ' create temp table pwn (a int) ',
  ' select pg_sleep(0.01) ',
  'é$a$',
  '$a$',
  ')',
  '(',
  ' q ',
  '--',
  '/*',
  "'",
  '"',
  ' as é',
  ' union all ',
  ' select 1 ',
];

describeWithDatabase('the explorer adapter against hostile statements', () => {
  let database: ExplorerTestDatabase;
  let adapter: PostgresExplorerAdapter;
  const uncaught: Error[] = [];
  const remember = (error: Error): number => uncaught.push(error);

  const run = (sql: string, explain = false) => adapter.query({ sql, explain, rowLimit: 100 });

  const outcomeOf = async (sql: string): Promise<string> => {
    try {
      await run(sql);
      return 'rows';
    } catch (error) {
      if (error instanceof ExplorerQueryRefusedError) return error.refusal;
      return error instanceof ExplorerFailureError ? `unavailable:${error.reason}` : 'unexpected';
    }
  };

  const sessionLooksUntouched = async (): Promise<void> => {
    const state = await run(
      `SELECT current_setting('statement_timeout') AS timeout,
              current_setting('transaction_read_only') AS read_only,
              to_regclass('pg_temp.pwn') IS NULL AS no_temp_table`,
    );
    expect(state.rows).toEqual([{ timeout: '5s', read_only: 'on', no_temp_table: true }]);
  };

  beforeAll(async () => {
    process.on('uncaughtException', remember);
    database = await createExplorerTestDatabase({
      adminUrl: ADMIN_URL as string,
      migrationsFolder: MIGRATIONS,
    });
    await seedExplorerFixture(database.admin);
    adapter = PostgresExplorerAdapter.connect(database.explorerUrl);
  }, DATABASE_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    process.off('uncaughtException', remember);
    await adapter?.close();
    await database?.close();
  }, DATABASE_TEARDOWN_TIMEOUT_MS);

  it('refuses a second statement hidden behind a non-ASCII name and a dollar quote', async () => {
    expect(await outcomeOf(BYPASS)).toBe(QueryRefusal.INVALID_QUERY);

    await sessionLooksUntouched();
  });

  it('is refused by the policy too, so the database never sees it', () => {
    expect(() => readOnlyStatement(BYPASS)).toThrow('exactly one statement');
  });

  it('never leaves a change behind, whatever the generated statement does', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(...FRAGMENTS), { minLength: 1, maxLength: 6 }),
        async (parts) => {
          const sql = `select 1 as n ${parts.join('')}`;
          try {
            readOnlyStatement(sql);
          } catch {
            return;
          }
          const outcome = await outcomeOf(sql);
          expect(outcome).not.toBe('unexpected');
          await sessionLooksUntouched();
        },
      ),
      { numRuns: PROPERTY_RUNS },
    );
  });

  it('refuses a function that ends its own session, so the connection stays', async () => {
    expect(await outcomeOf('select pg_terminate_backend(pg_backend_pid())')).toBe(
      QueryRefusal.NOT_ALLOWED,
    );

    expect(await outcomeOf('select 1 as ok')).toBe('rows');
  });

  it('keeps working after an administrator killed the idle connection', async () => {
    await run('select 1 as warm');
    await database.admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
                         WHERE application_name = 'ratingo-ai-explorer'`;
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

    const first = await outcomeOf('select 1 as after_kill');
    const second = await outcomeOf('select 1 as again');
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

    expect([first, second]).toEqual([expect.stringMatching(/^(rows|unavailable:)/), 'rows']);
    expect(uncaught).toEqual([]);
  });

  it('turns a backend killed by an administrator mid-query into an ordinary failure', async () => {
    const running = outcomeOf('select pg_sleep(3) as slept');
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    await database.admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
                         WHERE application_name = 'ratingo-ai-explorer' AND state = 'active'`;

    expect(await running).toMatch(/^unavailable:(network|connection_lost)$/);
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    expect(uncaught).toEqual([]);
    expect(await outcomeOf('select 1 as ok')).toBe('rows');
  });

  it('does not keep a session setting from one call in the next one', async () => {
    await run("select set_config('work_mem', '2GB', false) as changed");

    const state = await run("select current_setting('work_mem') as work_mem");

    expect(state.rows).toEqual([{ work_mem: '16MB' }]);
  });

  it('bounds a huge value in the database, before it reaches the process', async () => {
    const result = await run("select repeat('x', 60000000) as body, 1 as n");

    const body = String(result.rows[0]?.body);
    expect(body.length).toBeLessThan(1100);
    expect(body).toContain('[cut, 60000000 characters in total]');
  });

  it('cuts text by characters and never in the middle of an emoji', async () => {
    const result = await run("select repeat('😀', 1500) as body");

    const body = String(result.rows[0]?.body);
    expect(body.startsWith('😀'.repeat(1000))).toBe(true);
    expect(body).toContain('[cut, 1500 characters in total]');
  });

  it('refuses duplicate and unnamed output columns instead of dropping values', async () => {
    const duplicate = await run('select 1 as id, 2 as id').catch((error: Error) => error);
    const unnamed = await run('select 1, 2').catch((error: Error) => error);

    expect(duplicate).toMatchObject({
      refusal: QueryRefusal.INVALID_QUERY,
      message: expect.stringContaining('repeated names (id)'),
    });
    expect(unnamed).toMatchObject({
      refusal: QueryRefusal.INVALID_QUERY,
      message: expect.stringContaining('a column without a name'),
    });
  });

  it('keeps small json, arrays, booleans, nulls and dates readable', async () => {
    const result = await run(
      `select '{"a":1}'::jsonb as doc, array[1,2] as list, true as flag, null::text as nothing, date '2026-01-02' as day`,
    );

    expect(result.rows).toEqual([
      { doc: { a: 1 }, list: [1, 2], flag: true, nothing: null, day: '2026-01-02' },
    ]);
  });

  it('refuses a data-changing statement in the read-only transaction', async () => {
    expect(await outcomeOf('with x as (delete from genres returning 1) select * from x')).toBe(
      QueryRefusal.INVALID_QUERY,
    );
  });

  it('keeps the limits it sets inside the transaction', async () => {
    const state = await run(
      `select current_setting('statement_timeout') as timeout, current_setting('lock_timeout') as lock_timeout,
              current_setting('transaction_read_only') as read_only, current_setting('TimeZone') as zone`,
    );

    expect(state.rows).toEqual([
      { timeout: '5s', lock_timeout: '2s', read_only: 'on', zone: 'UTC' },
    ]);
  });

  it('refuses numbered parameters without treating the protocol error as a lost connection', async () => {
    const plain = await run('select $1::int as n').catch((error: unknown) => error);
    const planned = await run('select $1::int as n', true).catch((error: unknown) => error);

    expect(plain).toMatchObject({ refusal: QueryRefusal.INVALID_QUERY });
    expect(planned).toMatchObject({ refusal: QueryRefusal.INVALID_QUERY });
    expect(await outcomeOf('select 1 as ok')).toBe('rows');
  });

  it('bounds a numeric with a hundred thousand digits as text, before it reaches the process', async () => {
    const result = await run('select power(10::numeric, 100000) as big, 1::numeric as small');

    const big = String(result.rows[0]?.big);
    expect(big.length).toBeLessThan(1100);
    expect(big).toContain('[cut, 100001 characters in total]');
    expect(result.rows[0]?.small).toBe('1');
  });

  it('keeps wide numeric rows small even with many columns and rows', async () => {
    const columns = Array.from(
      { length: 40 },
      (_unused, index) => `power(10::numeric, 50000) as c${index}`,
    );

    const result = await run(`select ${columns.join(', ')} from generate_series(1, 101)`);

    expect(JSON.stringify(result.rows).length).toBeLessThan(100 * 40 * 1100);
    expect(result.hasMoreRows).toBe(true);
  });

  it('does not fail a waiting call when another call loses its connection', async () => {
    const first = outcomeOf('select pg_sleep(3) as slept');
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    const second = outcomeOf('select 1 as waited');
    await database.admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
                         WHERE application_name = 'ratingo-ai-explorer' AND state = 'active'`;

    expect(await first).toMatch(/^unavailable:(network|connection_lost)$/);
    expect(await second).toBe('rows');
    expect(uncaught).toEqual([]);
  });

  it('survives a stalled connection that refuses new connections, without an uncaught error', async () => {
    const { hostname, port } = new URL(database.explorerUrl);
    const proxy = await startStallingProxy(hostname, Number(port));
    const url = new URL(database.explorerUrl);
    url.hostname = '127.0.0.1';
    url.port = String(proxy.port);
    const stalled = PostgresExplorerAdapter.connect(url.toString(), { statementTimeoutMs: 100 });
    try {
      await stalled.query({ sql: 'select 1 as warm', explain: false, rowLimit: 100 });
      await proxy.stall();

      const outcome = await stalled
        .query({ sql: 'select 2 as lost', explain: false, rowLimit: 100 })
        .catch((error: unknown) => error);
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      const after = await stalled
        .query({ sql: 'select 3 as refused', explain: false, rowLimit: 100 })
        .catch((error: unknown) => error);

      expect(outcome).toMatchObject({ refusal: QueryRefusal.TIMEOUT });
      expect(after).toMatchObject({ reason: expect.stringMatching(/network|connection_lost/) });
      expect(uncaught).toEqual([]);
    } finally {
      await stalled.close().catch(() => undefined);
      await proxy.close();
    }
  });
});
