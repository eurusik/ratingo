import { randomBytes } from 'node:crypto';

import * as postgres from 'postgres';

import {
  describeViolations,
  findViolations,
  readExplorerGrants,
  readSqlFixture,
  ViolationKind,
} from './explorer-access.guard';
import { CLOSED_COLUMNS, PRIVATE_TABLES } from './explorer-access.rules';

const ADMIN_URL = process.env.EXPLORER_ACCESS_DATABASE_URL;
const describeWithDatabase = ADMIN_URL ? describe : describe.skip;

const ROLE = 'ai_explorer';
const PERMISSION_DENIED = '42501';
const READ_ONLY_TRANSACTION = '25006';

const loginUrl = (password: string): string => {
  const url = new URL(ADMIN_URL as string);
  url.username = ROLE;
  url.password = password;
  return url.toString();
};

const sqlStateOf = async (run: () => Promise<unknown>): Promise<string | undefined> => {
  try {
    await run();
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
};

describeWithDatabase('ai_explorer on the fully migrated database', () => {
  let admin: postgres.Sql;
  let explorer: postgres.Sql;

  beforeAll(async () => {
    admin = postgres(ADMIN_URL as string, { max: 1 });
    const password = randomBytes(18).toString('hex');
    await admin.unsafe(`ALTER ROLE ${ROLE} WITH LOGIN PASSWORD '${password}'`);
    explorer = postgres(loginUrl(password), { max: 1 });
  });

  afterAll(async () => {
    await explorer?.end({ timeout: 2 });
    await admin.unsafe(`ALTER ROLE ${ROLE} WITH NOLOGIN PASSWORD NULL`);
    await admin.end({ timeout: 2 });
  });

  describe('the grants the migrations leave behind', () => {
    it('open nothing sensitive and nothing private', async () => {
      const grants = await readExplorerGrants(admin);
      expect(describeViolations(findViolations(grants))).toBe('');
    });

    it('make every private table and every closed column unreadable', async () => {
      const { readable } = await readExplorerGrants(admin);
      const privateTables = PRIVATE_TABLES.filter((table) =>
        readable.some((item) => item.table === table),
      );
      const closed = CLOSED_COLUMNS.flatMap(({ table, columns }) =>
        columns.filter((column) =>
          readable.some((item) => item.table === table && item.column === column),
        ),
      );
      expect([privateTables, closed]).toEqual([[], []]);
    });

    it('still make the application tables readable', async () => {
      const { readable } = await readExplorerGrants(admin);
      const tables = [...new Set(readable.map((item) => item.table))];
      expect(tables).toEqual(
        expect.arrayContaining(['users', 'media_items', 'user_saved_items', 'reviews']),
      );
    });
  });

  describe('a new table or column that would be exposed automatically', () => {
    const catches = async (fixture: string, cleanup: string, expected: string[]) => {
      await admin.unsafe(readSqlFixture(fixture));
      try {
        const violations = findViolations(await readExplorerGrants(admin));
        expect(violations.map((item) => item.target)).toEqual(expect.arrayContaining(expected));
        expect(violations.every((item) => item.kind !== ViolationKind.STALE_ALLOW_LIST_ENTRY)).toBe(
          true,
        );
      } finally {
        await admin.unsafe(readSqlFixture(cleanup));
      }
    };

    it('is caught when a new table has sensitive columns', async () => {
      await catches('leaky-table.sql', 'leaky-table.cleanup.sql', [
        'public.leaky_probe.contact_email',
        'public.leaky_probe.session_token',
      ]);
    });

    it('is caught when a sensitive column is added to an open table', async () => {
      await catches('leaky-column.sql', 'leaky-column.cleanup.sql', [
        'public.media_items.owner_email',
      ]);
    });

    it('is not reported when the new table is innocent', async () => {
      await admin.unsafe(readSqlFixture('innocent-table.sql'));
      try {
        const violations = findViolations(await readExplorerGrants(admin));
        expect(describeViolations(violations)).toBe('');
      } finally {
        await admin.unsafe(readSqlFixture('innocent-table.cleanup.sql'));
      }
    });

    it('is left clean after the fixtures are removed', async () => {
      const violations = findViolations(await readExplorerGrants(admin));
      expect(describeViolations(violations)).toBe('');
    });
  });

  describe('what the role can actually do', () => {
    it('counts and reads the safe columns of a mixed table', async () => {
      const counted = await explorer`SELECT count(*)::int AS total FROM users`;
      const listed = await explorer`SELECT id, role FROM users LIMIT 1`;
      expect([counted.length, listed.length <= 1]).toEqual([1, true]);
    });

    it.each([
      ['a private column', 'SELECT email FROM users'],
      ['a whole row', 'SELECT * FROM users'],
      ['a row as json', 'SELECT row_to_json(u) FROM users u'],
      ['a private column in a predicate', 'SELECT count(*) FROM users WHERE email IS NOT NULL'],
      ['a closed column of another table', 'SELECT notes FROM user_media_state'],
      ['error text of failed jobs', 'SELECT last_message FROM job_failure_days'],
      ['a private table', 'SELECT 1 FROM oauth_accounts'],
      ['token hashes', 'SELECT token_hash FROM refresh_tokens'],
      ['the migration journal', 'SELECT 1 FROM drizzle.__drizzle_migrations'],
      ['the reporting views', 'SELECT 1 FROM reporting.daily_new_users'],
    ])('is refused %s', async (_label, statement) => {
      expect(await sqlStateOf(() => explorer.unsafe(statement))).toBe(PERMISSION_DENIED);
    });

    it.each([
      ['an insert', "INSERT INTO genres (tmdb_id, name, slug) VALUES (1, 'x', 'x')"],
      ['an update', "UPDATE genres SET name = 'x'"],
      ['a delete', 'DELETE FROM genres'],
      ['a truncate', 'TRUNCATE genres'],
      ['a new table', 'CREATE TABLE explorer_probe (id int)'],
      ['a temporary table', 'CREATE TEMP TABLE explorer_probe (id int)'],
    ])('cannot do %s', async (_label, statement) => {
      const code = await sqlStateOf(() => explorer.unsafe(statement));
      expect([PERMISSION_DENIED, READ_ONLY_TRANSACTION]).toContain(code);
    });

    it('has the load limits the migration sets', async () => {
      const [settings] = await explorer`
        SELECT current_setting('statement_timeout') AS statement_timeout,
               current_setting('lock_timeout') AS lock_timeout,
               current_setting('idle_in_transaction_session_timeout') AS idle_timeout,
               current_setting('default_transaction_read_only') AS read_only,
               current_setting('search_path') AS search_path`;
      const [role] = await admin`SELECT rolconnlimit FROM pg_roles WHERE rolname = ${ROLE}`;
      expect([settings, role?.rolconnlimit]).toEqual([
        {
          statement_timeout: '5s',
          lock_timeout: '2s',
          idle_timeout: '10s',
          read_only: 'on',
          search_path: 'public, pg_catalog',
        },
        2,
      ]);
    });
  });
});
