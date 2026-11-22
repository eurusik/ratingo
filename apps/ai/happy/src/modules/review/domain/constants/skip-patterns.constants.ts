export const SkipReason = {
  DRAFT: 'draft',
  UNTRUSTED_FORK: 'untrusted_fork',
  BOT_AUTHOR: 'bot_author',
  DOCS_ONLY: 'docs_only',
  NOTHING_TO_REVIEW: 'nothing_to_review',
  TRIVIAL: 'trivial',
} as const;
export type SkipReason = (typeof SkipReason)[keyof typeof SkipReason];

export const BOT_AUTHOR_SUFFIX = '[bot]';

export const MIN_REVIEWABLE_CHANGED_LINES = 20;

export const IGNORED_FILE_PATTERNS: readonly string[] = [
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/*.lock',
  'packages/api-contract/**',
  '**/*.snap',
  '**/drizzle*/meta/**',
  '**/dist/**',
  '**/*.min.js',
];

export const DOCS_FILE_PATTERNS: readonly string[] = ['**/*.md', 'docs/**', '**/LICENSE'];

export const SENSITIVE_PATH_PATTERNS: readonly string[] = [
  '**/.env',
  '**/.env.*',
  '**/*.pem',
  '**/*.key',
  '**/id_rsa*',
  '.git/**',
];
