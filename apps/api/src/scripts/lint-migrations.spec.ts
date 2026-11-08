import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { githubAnnotation, lintMigrationFile, type SquawkViolation } from './lint-migrations';

describe('lint-migrations', () => {
  let fixturesDir: string;
  let fixtureCount = 0;

  beforeAll(() => {
    fixturesDir = mkdtempSync(join(tmpdir(), 'lint-migrations-'));
  });

  afterAll(() => {
    rmSync(fixturesDir, { recursive: true, force: true });
  });

  function rulesViolatedBy(sql: string): string[] {
    fixtureCount += 1;
    const file = join(fixturesDir, `${fixtureCount}.sql`);
    writeFileSync(file, sql);
    return lintMigrationFile(file).map((violation) => violation.rule_name);
  }

  it('passes an idempotent migration that indexes a table it creates', () => {
    const rules = rulesViolatedBy(
      'CREATE TABLE IF NOT EXISTS "t" ("id" uuid PRIMARY KEY, "a" text);\n' +
        'CREATE INDEX IF NOT EXISTS "t_a" ON "t" ("a");\n',
    );

    expect(rules).toEqual([]);
  });

  it('flags a blocking, non-idempotent index on an existing table', () => {
    const rules = rulesViolatedBy('CREATE INDEX "t_a" ON "t" ("a");\n');

    expect(rules).toEqual(
      expect.arrayContaining(['require-concurrent-index-creation', 'prefer-robust-stmts']),
    );
  });

  it('flags CONCURRENTLY even as the only statement, since drizzle-kit migrate runs in a transaction', () => {
    const rules = rulesViolatedBy('CREATE INDEX CONCURRENTLY IF NOT EXISTS "t_a" ON "t" ("a");\n');

    expect(rules).toContain('ban-concurrent-index-creation-in-transaction');
  });

  it('reports a violation found by both passes once', () => {
    const rules = rulesViolatedBy('CREATE INDEX CONCURRENTLY "t_a" ON "t" ("a");\n');

    expect(rules.filter((rule) => rule === 'prefer-robust-stmts')).toHaveLength(1);
  });

  it('accepts a blocking index acknowledged with a squawk-ignore directive', () => {
    const rules = rulesViolatedBy(
      '-- squawk-ignore require-concurrent-index-creation\n' +
        'CREATE INDEX IF NOT EXISTS "t_a" ON "t" ("a");\n',
    );

    expect(rules).toEqual([]);
  });

  it('flags a syntax error', () => {
    expect(rulesViolatedBy('CREATE TABLE "t" (;\n')).toContain('syntax-error');
  });

  it('formats a GitHub error annotation with a repo-relative path and 1-based position', () => {
    const violation: SquawkViolation = {
      file: 'drizzle_v2/0001_x.sql',
      line: 0,
      column: 4,
      rule_name: 'prefer-robust-stmts',
      message: 'Missing `IF NOT EXISTS`',
      help: '100% robust\nnext line',
    };

    expect(githubAnnotation(join(__dirname, '../../../..'), violation)).toBe(
      '::error file=apps/api/drizzle_v2/0001_x.sql,line=1,col=5,title=squawk prefer-robust-stmts::' +
        'Missing `IF NOT EXISTS` 100%25 robust%0Anext line',
    );
  });
});
