import {
  DEPENDENCY_MANIFEST_PATTERN,
  ENV_FILE_PATTERNS,
  ENV_SCHEMA_FILE_PATTERNS,
  LOCKFILE_PATTERNS,
  MIGRATION_FILE_PATTERNS,
  RELEASE_BASE_BRANCH,
  RELEASE_HEAD_BRANCH,
} from '../constants/release.constants';
import type { ChangedFile, PullRequest } from '../entities/pull-request';
import { FileStatus } from '../entities/pull-request';

import { globMatches, matchesAnyGlob } from './glob-match';

export interface MigrationRisk {
  path: string;
  risks: string[];
}

export interface DependencyChange {
  name: string;
  change: 'added' | 'removed' | 'changed';
}

export interface ReleaseChecklist {
  services: string[];
  migrations: MigrationRisk[];
  envVars: string[];
  dependencies: { path: string; changes: DependencyChange[] }[];
  lockfileChanged: boolean;
  fileCount: number;
}

const PROCESS_ENV_NAME = /\bprocess\.env\.([A-Z][A-Z0-9_]{2,})/g;
const ENV_ASSIGNMENT = /^([A-Z][A-Z0-9_]{2,})=/;
const DOCKER_ENV = /^(?:ARG|ENV)\s+([A-Z][A-Z0-9_]{2,})/;
const SCHEMA_KEY = /^([A-Z][A-Z0-9_]{3,})\s*:/;
const DEPENDENCY_LINE = /^"((?:@[\w.-]+\/)?[\w.-]+)":\s*"([~^<>=*]*\d[^"]*|\*|latest)"/;
const NON_DEPENDENCY_KEYS: ReadonlySet<string> = new Set(['version', 'node', 'npm']);
const ADDED = '+';
const REMOVED = '-';

const RISKY_SQL: readonly { risk: string; pattern: RegExp }[] = [
  { risk: 'DROP TABLE або DROP COLUMN', pattern: /\bDROP\s+(?:TABLE|COLUMN)\b/i },
  {
    risk: 'CREATE INDEX без CONCURRENTLY і без IF NOT EXISTS',
    pattern: /^(?!.*\bCONCURRENTLY\b)(?!.*\bIF\s+NOT\s+EXISTS\b).*\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i,
  },
  { risk: 'ALTER TYPE ... ADD VALUE', pattern: /\bALTER\s+TYPE\b.*\bADD\s+VALUE\b/i },
  { risk: 'ADD COLUMN ... NOT NULL', pattern: /\bADD\s+COLUMN\b.*\bNOT\s+NULL\b/i },
  { risk: 'CREATE TABLE без IF NOT EXISTS', pattern: /\bCREATE\s+TABLE\b(?!.*\bIF\s+NOT\s+EXISTS\b)/i },
];

const changedLines = (patch: string | null, marker: string): string[] =>
  (patch ?? '')
    .split('\n')
    .filter((line) => line.startsWith(marker) && !line.startsWith(marker.repeat(3)))
    .map((line) => line.slice(1).trim());

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();

export const isReleasePullRequest = (pr: Pick<PullRequest, 'baseRef' | 'headRef'>): boolean =>
  pr.baseRef === RELEASE_BASE_BRANCH && pr.headRef === RELEASE_HEAD_BRANCH;

const serviceOf = (path: string): string => {
  const parts = path.split('/');
  const [first, second, third] = parts;
  if (first === 'apps' && second === 'ai' && third !== undefined) return `apps/ai/${third}`;
  if ((first === 'apps' || first === 'packages') && second !== undefined) {
    return `${first}/${second}`;
  }
  if (first === '.github') return '.github (CI)';
  return parts.length === 1 ? 'корінь репозиторію' : (first ?? path);
};

const envNamesFromLine = (line: string, path: string): string[] => {
  const names = [...line.matchAll(PROCESS_ENV_NAME)].map((match) => match[1] ?? '');
  const declared = matchesAnyGlob(ENV_FILE_PATTERNS, path)
    ? [ENV_ASSIGNMENT.exec(line)?.[1], DOCKER_ENV.exec(line)?.[1]]
    : matchesAnyGlob(ENV_SCHEMA_FILE_PATTERNS, path)
      ? [SCHEMA_KEY.exec(line)?.[1]]
      : [];
  return [...names, ...declared.filter((name): name is string => name !== undefined)];
};

const newEnvVars = (files: readonly ChangedFile[]): string[] => {
  const added = new Set<string>();
  const removed = new Set<string>();
  for (const file of files) {
    for (const line of changedLines(file.patch, ADDED)) {
      envNamesFromLine(line, file.path).forEach((name) => added.add(name));
    }
    for (const line of changedLines(file.patch, REMOVED)) {
      envNamesFromLine(line, file.path).forEach((name) => removed.add(name));
    }
  }
  return sorted([...added].filter((name) => !removed.has(name)));
};

const migrationRisks = (file: ChangedFile): MigrationRisk => {
  const added = changedLines(file.patch, ADDED);
  const risks = RISKY_SQL.filter(({ pattern }) => added.some((line) => pattern.test(line))).map(
    ({ risk }) => risk,
  );
  return {
    path: file.path,
    risks: file.status === FileStatus.MODIFIED ? ['змінено наявну міграцію', ...risks] : risks,
  };
};

const dependencyMap = (lines: readonly string[]): Map<string, string> =>
  new Map(
    lines.flatMap((line): [string, string][] => {
      const match = DEPENDENCY_LINE.exec(line);
      const name = match?.[1];
      return name === undefined || NON_DEPENDENCY_KEYS.has(name) ? [] : [[name, match?.[2] ?? '']];
    }),
  );

const dependencyChanges = (file: ChangedFile): DependencyChange[] => {
  const added = dependencyMap(changedLines(file.patch, ADDED));
  const removed = dependencyMap(changedLines(file.patch, REMOVED));
  const names = sorted([...added.keys(), ...removed.keys()]);
  return names.flatMap((name): DependencyChange[] => {
    if (added.has(name) && removed.has(name)) {
      return added.get(name) === removed.get(name) ? [] : [{ name, change: 'changed' }];
    }
    return [{ name, change: added.has(name) ? 'added' : 'removed' }];
  });
};

export const buildReleaseChecklist = (files: readonly ChangedFile[]): ReleaseChecklist => ({
  services: sorted(files.map((file) => serviceOf(file.path))),
  migrations: files
    .filter((file) => matchesAnyGlob(MIGRATION_FILE_PATTERNS, file.path))
    .map(migrationRisks),
  envVars: newEnvVars(files),
  dependencies: files
    .filter((file) => globMatches(DEPENDENCY_MANIFEST_PATTERN, file.path))
    .map((file) => ({ path: file.path, changes: dependencyChanges(file) }))
    .filter(({ changes }) => changes.length > 0),
  lockfileChanged: files.some((file) => matchesAnyGlob(LOCKFILE_PATTERNS, file.path)),
  fileCount: files.length,
});
