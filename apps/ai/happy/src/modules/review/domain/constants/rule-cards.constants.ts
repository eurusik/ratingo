export interface RuleCard {
  id: string;
  title: string;
  paths: readonly string[];
  violation: string;
  protectedExample: string;
  unclear: string;
  doNotReport: string;
}

export const RULE_CARDS: readonly RuleCard[] = [
  {
    id: 'domain-purity',
    title: 'Domain layer stays pure',
    paths: ['apps/api/src/modules/*/domain/**', 'apps/ai/*/src/modules/*/domain/**'],
    violation:
      'Code under a domain/ folder calls new Date(), Date.now(), reads process.env, or imports Nest, Drizzle, HTTP or another infrastructure package.',
    protectedExample:
      'A domain function that receives `nowMs` as an argument, or reads a constant from domain/constants, is fine.',
    unclear:
      'A type-only import of an external package: ask whether it leaks a framework type into the domain.',
    doNotReport:
      'Files outside domain/ folders, and spec files that build dates for fixtures.',
  },
  {
    id: 'repository-db-error',
    title: 'Repository database calls use withDbError()',
    paths: ['apps/api/src/modules/*/infrastructure/**'],
    violation:
      'A Drizzle query (db.select, db.insert, db.update, db.delete, db.execute) in an infrastructure repository that is not wrapped in withDbError().',
    protectedExample:
      'A private helper that is only called from a method that already wraps the call in withDbError().',
    unclear: 'A query object that returns an SQL fragment and does not run the query.',
    doNotReport: 'Read-only mapper functions and test doubles.',
  },
  {
    id: 'migrations',
    title: 'Migrations are safe to re-run',
    paths: ['**/drizzle*/*.sql', '**/migrations/**/*.sql', 'apps/api/src/database/schema/**'],
    violation:
      'A migration statement without IF NOT EXISTS / IF EXISTS; CREATE INDEX on an existing table without CONCURRENTLY and without a squawk-ignore directive; a just-added enum value used as a literal in the same migration; a NOT NULL column added in one step.',
    protectedExample:
      'CREATE INDEX IF NOT EXISTS on a table created in the same migration, or with a squawk-ignore directive above it.',
    unclear: 'A schema change in TypeScript with no migration in the diff: ask if one is generated.',
    doNotReport: 'Generated drizzle meta/snapshot files.',
  },
  {
    id: 'module-barrels',
    title: 'Cross-module imports go through public/ barrels',
    paths: ['apps/api/src/modules/**', 'apps/ai/*/src/modules/**', 'apps/web-client/src/**'],
    violation:
      'A file imports another module by a deep path (../other-module/application/..., ../other-module/infrastructure/...) instead of other-module/public or the module index.',
    protectedExample: 'Imports inside the same module, and imports from a public/ or index barrel.',
    unclear: 'A deep import of a pure type from another module: ask whether the barrel exports it.',
    doNotReport: 'Imports of shared/common packages that are not modules.',
  },
  {
    id: 'api-contract-types',
    title: 'Frontend API types come from @ratingo/api-contract',
    paths: ['apps/web-client/**', 'apps/storefront/**', 'packages/web-core/**'],
    violation:
      'A hand-written interface that duplicates an API response shape, or a type imported from apps/api, instead of `import type { components } from "@ratingo/api-contract"`.',
    protectedExample: 'View-model types that wrap or narrow components["schemas"][...].',
    unclear: 'A local type with fields that look like an API response: ask which endpoint it mirrors.',
    doNotReport: 'Props types and UI state types.',
  },
  {
    id: 'fsd-boundaries',
    title: 'Storefront follows Feature-Sliced Design boundaries',
    paths: ['apps/storefront/src/**'],
    violation:
      'An import that goes upward (shared importing entities, entities importing features, features importing widgets or pages) or a sideways import between slices of one layer; a deep import into a slice instead of its index.',
    protectedExample:
      'An import from a lower layer through the slice public index, or a @x cross-import file.',
    unclear: 'A shared/ file that imports a domain concept by name.',
    doNotReport: 'The root app/ routes importing src/ layers, and test files.',
  },
  {
    id: 'no-code-comments',
    title: 'No comments in code or config',
    paths: ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts'],
    violation:
      'A newly added line comment, block comment, JSDoc or YAML comment explaining code that names and structure should explain.',
    protectedExample:
      'Existing comments that the diff leaves alone; a Squawk directive in a migration; eslint or ts directives.',
    unclear: 'A commented-out block that the diff moves.',
    doNotReport: 'License headers and comments in files the diff only renames.',
  },
  {
    id: 'bullmq-jobs',
    title: 'BullMQ jobs are idempotent and typed in constants',
    paths: ['apps/api/src/**/*.worker.ts', 'apps/api/src/**/*.constants.ts', 'apps/ai/*/src/**/*queue*.ts'],
    violation:
      'A job handler whose second run duplicates side effects (insert without a unique key or upsert, sending twice); a job type string written inline instead of the *.constants.ts job type; a random job id where a deterministic one deduplicates.',
    protectedExample:
      'An upsert or INSERT ... ON CONFLICT, a job guarded by a claim or a deterministic job id.',
    unclear: 'A handler that calls an external API with side effects but no idempotency key.',
    doNotReport: 'Retry and backoff numbers.',
  },
];
