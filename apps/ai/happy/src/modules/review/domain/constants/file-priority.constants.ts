export const FileTier = {
  CHECK_MATCH: 'check_match',
  DOMAIN: 'domain',
  APPLICATION: 'application',
  INFRASTRUCTURE: 'infrastructure',
  CONFIG: 'config',
  TEST: 'test',
  PERIPHERAL: 'peripheral',
} as const;
export type FileTier = (typeof FileTier)[keyof typeof FileTier];

export const FILE_TIER_PRIORITY: readonly FileTier[] = [
  FileTier.CHECK_MATCH,
  FileTier.DOMAIN,
  FileTier.APPLICATION,
  FileTier.INFRASTRUCTURE,
  FileTier.CONFIG,
  FileTier.TEST,
  FileTier.PERIPHERAL,
];

export const CORE_FILE_TIERS: readonly FileTier[] = [FileTier.CHECK_MATCH, FileTier.DOMAIN];

export const CHECK_MATCH_EXCLUDED_TIERS: readonly FileTier[] = [FileTier.TEST, FileTier.PERIPHERAL];

export const DEFAULT_FILE_TIER: FileTier = FileTier.APPLICATION;

interface PathTierRule {
  tier: FileTier;
  patterns: readonly string[];
}

export const PATH_TIER_RULES: readonly PathTierRule[] = [
  {
    tier: FileTier.PERIPHERAL,
    patterns: [
      '**/package.json',
      '**/package-lock.json',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',
      '**/*.lock',
      '**/*.md',
      'docs/**',
      '**/LICENSE',
      '**/*.snap',
      '**/*.generated.*',
      '**/generated/**',
      '**/dist/**',
      'packages/api-contract/**',
      '**/drizzle*/meta/**',
    ],
  },
  {
    tier: FileTier.TEST,
    patterns: [
      '**/*.spec.*',
      '**/*.test.*',
      '**/*.e2e-spec.*',
      '**/*.testing.ts',
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/test/**',
      '**/tests/**',
      '**/testing/**',
      '**/fixtures/**',
      '**/eval/**',
      '**/e2e/**',
    ],
  },
  {
    tier: FileTier.DOMAIN,
    patterns: [
      '**/domain/**',
      '**/*.policy.ts',
      '**/*.entity.ts',
      '**/*.port.ts',
      '**/policies/**',
      '**/entities/**',
      '**/ports/**',
    ],
  },
  {
    tier: FileTier.INFRASTRUCTURE,
    patterns: [
      '**/infrastructure/**',
      '**/*.repository.ts',
      '**/*.adapter.ts',
      '**/*.sql',
      '**/migrations/**',
      '**/drizzle*/**',
      '**/database/**',
    ],
  },
  {
    tier: FileTier.CONFIG,
    patterns: [
      '**/config/**',
      '**/*.config.*',
      '**/*.module.ts',
      '**/env.*',
      '**/.env*',
      '**/Dockerfile',
      '**/railway.json',
      '**/tsconfig*.json',
      '**/*.json',
      '**/*.yml',
      '**/*.yaml',
      '**/*.toml',
      '.github/**',
    ],
  },
  {
    tier: FileTier.APPLICATION,
    patterns: [
      '**/application/**',
      '**/presentation/**',
      '**/*.service.ts',
      '**/*.worker.ts',
      '**/*.processor.ts',
      '**/*.controller.ts',
      '**/*.handler.ts',
    ],
  },
];
