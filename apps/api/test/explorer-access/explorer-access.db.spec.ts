import { randomBytes } from 'node:crypto';

import * as postgres from 'postgres';

import {
  describeViolations,
  findViolations,
  tableKey,
  ViolationKind,
} from './explorer-access.guard';
import { readExplorerGrants, readSqlFixture } from './explorer-access.grants';
import { CLOSED_COLUMNS, PRIVATE_TABLES } from './explorer-access.rules';

const ADMIN_URL = process.env.EXPLORER_ACCESS_DATABASE_URL;
const describeWithDatabase = ADMIN_URL ? describe : describe.skip;

if (!ADMIN_URL && process.env.CI) {
  it('has a database to check, because CI runs this guard', () => {
    throw new Error('EXPLORER_ACCESS_DATABASE_URL is not set in CI');
  });
}

const ROLE = 'ai_explorer';
const PERMISSION_DENIED = '42501';

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
    await admin?.unsafe(`ALTER ROLE ${ROLE} WITH NOLOGIN PASSWORD NULL`);
    await admin?.end({ timeout: 2 });
  });

  const catches = async (fixture: string, cleanup: string, expected: string[]) => {
    try {
      await admin.unsafe(readSqlFixture(fixture));
      const violations = findViolations(await readExplorerGrants(admin));
      const targets = violations.map((item) => item.target);
      for (const wanted of expected) {
        expect(targets.some((target) => target.includes(wanted))).toBe(true);
      }
      expect(violations.every((item) => item.kind !== ViolationKind.STALE_ALLOW_LIST_ENTRY)).toBe(
        true,
      );
    } finally {
      await admin.unsafe(readSqlFixture(cleanup));
    }
  };

  describe('the grants the migrations leave behind', () => {
    it('open nothing sensitive and nothing private', async () => {
      const grants = await readExplorerGrants(admin);
      expect(describeViolations(findViolations(grants))).toBe('');
    });

    it('make every private table and every closed column unreadable', async () => {
      const { readable } = await readExplorerGrants(admin);
      const privateTables = PRIVATE_TABLES.filter((table) =>
        readable.some((item) => tableKey(item) === table),
      );
      const closed = CLOSED_COLUMNS.flatMap(({ table, columns }) =>
        columns.filter((column) =>
          readable.some((item) => tableKey(item) === table && item.column === column),
        ),
      );
      expect([privateTables, closed]).toEqual([[], []]);
    });

    it('notices a private table that becomes readable, which proves the rule keys match the database', async () => {
      try {
        await admin.unsafe('GRANT SELECT ON public.refresh_tokens TO ai_explorer');

        const violations = findViolations(await readExplorerGrants(admin));

        expect(violations.map((item) => item.kind)).toContain(ViolationKind.PRIVATE_TABLE_READABLE);
      } finally {
        await admin.unsafe('REVOKE ALL ON public.refresh_tokens FROM ai_explorer');
      }
    });

    it('notices a closed column that becomes readable', async () => {
      try {
        await admin.unsafe('GRANT SELECT (email) ON public.users TO ai_explorer');

        const violations = findViolations(await readExplorerGrants(admin));

        expect(violations.map((item) => item.kind)).toContain(ViolationKind.CLOSED_COLUMN_READABLE);
      } finally {
        await admin.unsafe('REVOKE SELECT (email) ON public.users FROM ai_explorer');
      }
    });

    it('notices a membership in another role', async () => {
      await catches('granted-role.sql', 'granted-role.cleanup.sql', ['pg_read_all_stats']);
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

    it('is caught when a view runs with its owner rights, even with innocent column names', async () => {
      await catches('leaky-view.sql', 'leaky-view.cleanup.sql', [
        'public.leaky_view',
        'public.leaky_bio_view',
      ]);
    });

    it('is caught when a materialized view copies private columns', async () => {
      await catches('leaky-matview.sql', 'leaky-matview.cleanup.sql', ['public.leaky_matview']);
    });

    it('is caught when a SECURITY DEFINER function can be run by the role', async () => {
      await catches('leaky-function.sql', 'leaky-function.cleanup.sql', [
        'public.leaky_function()',
      ]);
    });

    it('is caught when a function that can end or lock sessions becomes executable', async () => {
      await catches('dangerous-function.sql', 'dangerous-function.cleanup.sql', ['set_config']);
    });

    it('is caught when a function that writes to the replication log becomes executable', async () => {
      await catches('emit-message.sql', 'emit-message.cleanup.sql', ['pg_logical_emit_message']);
    });

    it('is caught when the link to users is a created_by foreign key', async () => {
      await catches('created-by.sql', 'created-by.cleanup.sql', ['public.feedback_notes.topic']);
    });

    it('is caught when the link to users is a foreign key with any column name', async () => {
      await catches('foreign-key-link.sql', 'foreign-key-link.cleanup.sql', [
        'public.reactions.reaction',
      ]);
    });

    it('is caught when a free-form column hides behind a domain, and when it is a tsvector', async () => {
      await catches('domain-column.sql', 'domain-column.cleanup.sql', [
        'public.domain_tickets.topic',
        'public.domain_tickets.search',
      ]);
    });

    it('is caught when the link to users goes through two foreign keys', async () => {
      await catches('two-hop-link.sql', 'two-hop-link.cleanup.sql', ['public.batch_notes.topic']);
    });

    it('is caught when a table linked to users has message and contact columns', async () => {
      await catches('support-tickets.sql', 'support-tickets.cleanup.sql', [
        'public.support_tickets.message',
        'public.support_tickets.contact_name',
      ]);
    });

    it('is caught when a table linked to users has free-form columns with innocent names', async () => {
      await catches('opaque-tickets.sql', 'opaque-tickets.cleanup.sql', [
        'public.opaque_tickets.topic',
        'public.opaque_tickets.extra',
      ]);
    });

    it.each([
      ['an innocent table', 'innocent-table.sql', 'innocent-table.cleanup.sql'],
      ['a security_invoker view', 'invoker-view.sql', 'invoker-view.cleanup.sql'],
    ])('is not reported for %s', async (_label, fixture, cleanup) => {
      await admin.unsafe(readSqlFixture(fixture));
      try {
        const violations = findViolations(await readExplorerGrants(admin));
        expect(describeViolations(violations)).toBe('');
      } finally {
        await admin.unsafe(readSqlFixture(cleanup));
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

    describe('with the read-only default switched off, so that only privileges can stop a write', () => {
      beforeEach(async () => {
        await explorer.unsafe('SET default_transaction_read_only = off');
      });

      afterEach(async () => {
        await explorer.unsafe('RESET default_transaction_read_only');
      });

      it.each([
        ['an insert', "INSERT INTO genres (tmdb_id, name, slug) VALUES (1, 'x', 'x')"],
        ['an update', "UPDATE genres SET name = 'x'"],
        ['a delete', 'DELETE FROM genres'],
        ['a truncate', 'TRUNCATE genres'],
        ['a new table', 'CREATE TABLE explorer_probe (id int)'],
      ])('has no privilege for %s', async (_label, statement) => {
        expect(await sqlStateOf(() => explorer.unsafe(statement))).toBe(PERMISSION_DENIED);
      });

      it('can still create a temporary table, which only the read-only transaction of the adapter prevents', async () => {
        expect(
          await sqlStateOf(() => explorer.unsafe('CREATE TEMP TABLE explorer_probe (id int)')),
        ).toBeUndefined();
      });
    });

    it('refuses writes by default, because the role starts read-only', async () => {
      expect(await sqlStateOf(() => explorer.unsafe('DELETE FROM genres'))).toBe('25006');
    });

    it('still reads the catalog view through the security_invoker rights', async () => {
      const [row] = await explorer`SELECT count(*)::int AS total FROM public_media_items`;

      expect(row?.total).toBe(0);
    });

    it('cannot write to the replication log, run SQL text or change a setting from a function', async () => {
      const results = await Promise.all(
        [
          "select pg_logical_emit_message(true, 'a', 'b')",
          "select set_config('work_mem', '1GB', true)",
          "select * from ts_stat('select 1')",
          "select query_to_xml('select 1', true, true, '')",
          "select pg_notify('a', 'b')",
        ].map((statement) => sqlStateOf(() => explorer.unsafe(statement))),
      );

      expect(results).toEqual(Array(5).fill(PERMISSION_DENIED));
    });

    it('has a temporary-file limit that a session cannot raise', async () => {
      const [limit] = await explorer`SELECT current_setting('temp_file_limit') AS value`;
      const raised = await sqlStateOf(() => explorer.unsafe("SET temp_file_limit = '10GB'"));

      expect([limit?.value, raised]).toEqual(['256MB', PERMISSION_DENIED]);
    });

    it('cannot run the functions that end or lock sessions', async () => {
      const results = await Promise.all(
        [
          'select pg_terminate_backend(1)',
          'select pg_cancel_backend(1)',
          'select pg_advisory_lock(1)',
        ].map((statement) => sqlStateOf(() => explorer.unsafe(statement))),
      );

      expect(results).toEqual([PERMISSION_DENIED, PERMISSION_DENIED, PERMISSION_DENIED]);
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
