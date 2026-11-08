import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';

const API_DIR = resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = 'drizzle_v2';
const CONFIG_PATH = resolve(API_DIR, '.squawk.toml');
const DEFAULT_BASE_REF = 'origin/development';
const IDEMPOTENCY_RULE = 'prefer-robust-stmts';
const SQUAWK_BIN = createRequire(import.meta.url).resolve('squawk-cli/js/bin/squawk');

function gitLines(args) {
  return execFileSync('git', args, { cwd: API_DIR, encoding: 'utf8' }).split('\n').filter(Boolean);
}

function changedMigrations(baseRef) {
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

function runSquawk(files, extraArgs) {
  const result = spawnSync(
    process.execPath,
    [SQUAWK_BIN, '--config', CONFIG_PATH, '--reporter', 'json', ...extraArgs, ...files],
    { cwd: API_DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (!result.stdout.trim()) {
    throw new Error(`squawk produced no report (exit ${result.status}): ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function formatViolation({ file, line, column, rule_name, message, help }) {
  return [`${file}:${line + 1}:${column + 1} ${rule_name}: ${message}`, help && `  help: ${help}`]
    .filter(Boolean)
    .join('\n');
}

function filesToLint() {
  const explicitFiles = process.argv.slice(2);
  if (explicitFiles.length === 0) {
    return changedMigrations(process.env.MIGRATIONS_BASE || DEFAULT_BASE_REF);
  }
  const callerDir = process.env.INIT_CWD ?? process.cwd();
  return explicitFiles.map((file) => relative(API_DIR, resolve(callerDir, file)));
}

const files = filesToLint();

if (files.length === 0) {
  console.log('No new or changed migrations to lint.');
  process.exit(0);
}

console.log(`Linting migrations:\n${files.map((file) => `  ${file}`).join('\n')}\n`);

const safetyViolations = runSquawk(files, []);
const idempotencyViolations = runSquawk(files, ['--no-assume-in-transaction']).filter(
  (violation) => violation.rule_name === IDEMPOTENCY_RULE,
);
const violations = [...safetyViolations, ...idempotencyViolations];

if (violations.length === 0) {
  console.log('Squawk found no issues.');
  process.exit(0);
}

console.error(violations.map(formatViolation).join('\n\n'));
console.error(`\nSquawk found ${violations.length} issue(s). See https://squawkhq.com/docs/rules`);
process.exit(1);
