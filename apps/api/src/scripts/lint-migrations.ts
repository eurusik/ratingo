import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export interface SquawkViolation {
  file: string;
  line: number;
  column: number;
  rule_name: string;
  message: string;
  help: string | null;
}

const API_DIR = resolve(__dirname, '../..');
const MIGRATIONS_DIR = 'drizzle_v2';
const CONFIG_PATH = resolve(API_DIR, '.squawk.toml');
const DEFAULT_BASE_REF = 'origin/development';
const IDEMPOTENCY_RULE = 'prefer-robust-stmts';
const DRIZZLE_TRANSACTION_SUFFIX = '\n;\nSELECT 1;\n';
const RULES_DOCS_URL = 'https://squawkhq.com/docs/rules';
const SQUAWK_BIN = require.resolve('squawk-cli/js/bin/squawk');

function gitLines(args: string[]): string[] {
  return execFileSync('git', args, { cwd: API_DIR, encoding: 'utf8' }).split('\n').filter(Boolean);
}

function changedMigrations(baseRef: string): string[] {
  const changedSinceBase = gitLines([
    'diff',
    '--name-only',
    '--relative',
    '--diff-filter=d',
    '--merge-base',
    baseRef,
    '--',
    MIGRATIONS_DIR,
  ]);
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard', '--', MIGRATIONS_DIR]);

  return [...new Set([...changedSinceBase, ...untracked])].filter(
    (file) => file.endsWith('.sql') && existsSync(resolve(API_DIR, file)),
  );
}

function filesToLint(explicitFiles: string[]): string[] {
  if (explicitFiles.length === 0) {
    return changedMigrations(process.env.MIGRATIONS_BASE || DEFAULT_BASE_REF);
  }
  const callerDir = process.env.INIT_CWD ?? process.cwd();
  return explicitFiles.map((file) => relative(API_DIR, resolve(callerDir, file)));
}

function runSquawk(args: string[], input: string): SquawkViolation[] {
  const result = spawnSync(
    process.execPath,
    [SQUAWK_BIN, '--config', CONFIG_PATH, '--reporter', 'json', ...args],
    { cwd: API_DIR, encoding: 'utf8', input },
  );
  if (result.error) throw result.error;
  if (!result.stdout.trim()) {
    throw new Error(`squawk produced no report (exit ${result.status}): ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout) as SquawkViolation[];
}

function assertConfigIsValid(): void {
  runSquawk(['--stdin-filepath', 'config-check.sql'], '');
}

function asRunInsideDrizzleTransaction(file: string): string {
  return readFileSync(resolve(API_DIR, file), 'utf8') + DRIZZLE_TRANSACTION_SUFFIX;
}

function violationKey({ line, column, rule_name }: SquawkViolation): string {
  return `${line}:${column}:${rule_name}`;
}

export function lintMigrationFile(file: string): SquawkViolation[] {
  const sql = asRunInsideDrizzleTransaction(file);
  const stdinArgs = ['--stdin-filepath', file];
  const safetyViolations = runSquawk(stdinArgs, sql);
  const alreadyReported = new Set(safetyViolations.map(violationKey));
  const idempotencyViolations = runSquawk(['--no-assume-in-transaction', ...stdinArgs], sql).filter(
    (violation) =>
      violation.rule_name === IDEMPOTENCY_RULE && !alreadyReported.has(violationKey(violation)),
  );
  return [...safetyViolations, ...idempotencyViolations];
}

function formatViolation({
  file,
  line,
  column,
  rule_name,
  message,
  help,
}: SquawkViolation): string {
  const location = `${file}:${line + 1}:${column + 1}`;
  return [`${location} ${rule_name}: ${message}`, help && `  help: ${help}`]
    .filter(Boolean)
    .join('\n');
}

export function githubAnnotation(workspace: string, violation: SquawkViolation): string {
  const { file, line, column, rule_name, message, help } = violation;
  const repoPath = relative(workspace, resolve(API_DIR, file));
  const text = [message, help].filter(Boolean).join(' ').replace(/%/g, '%25').replace(/\n/g, '%0A');
  return `::error file=${repoPath},line=${line + 1},col=${column + 1},title=squawk ${rule_name}::${text}`;
}

function report(violations: SquawkViolation[]): void {
  console.error(violations.map(formatViolation).join('\n\n'));
  const workspace = process.env.GITHUB_WORKSPACE;
  if (workspace) {
    console.log(violations.map((violation) => githubAnnotation(workspace, violation)).join('\n'));
  }
  console.error(`\nSquawk found ${violations.length} issue(s). See ${RULES_DOCS_URL}`);
}

function lintMigrations(explicitFiles: string[]): number {
  const files = filesToLint(explicitFiles);

  if (files.length === 0) {
    assertConfigIsValid();
    console.log('No new or changed migrations to lint.');
    return 0;
  }

  console.log(`Linting migrations:\n${files.map((file) => `  ${file}`).join('\n')}\n`);

  const violations = files.flatMap(lintMigrationFile);
  if (violations.length > 0) {
    report(violations);
    return 1;
  }

  console.log('Squawk found no issues.');
  return 0;
}

if (require.main === module) {
  process.exitCode = lintMigrations(process.argv.slice(2));
}
