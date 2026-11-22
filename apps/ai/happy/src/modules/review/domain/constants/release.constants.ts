export const RELEASE_BASE_BRANCH = 'main';
export const RELEASE_HEAD_BRANCH = 'development';

export const MIGRATION_FILE_PATTERNS: readonly string[] = [
  '**/drizzle*/*.sql',
  '**/migrations/**/*.sql',
];

export const DEPENDENCY_MANIFEST_PATTERN = '**/package.json';
export const LOCKFILE_PATTERNS: readonly string[] = ['**/package-lock.json', 'package-lock.json'];

export const ENV_FILE_PATTERNS: readonly string[] = [
  '**/.env.example',
  '**/.env.*.example',
  '**/railway.json',
  '**/Dockerfile',
];

export const ENV_SCHEMA_FILE_PATTERNS: readonly string[] = [
  '**/env.schema.ts',
  '**/env*.ts',
  '**/*.env.ts',
];

export const MAX_LISTED_ITEMS = 25;
