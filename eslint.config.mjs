import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import noDeepRelativeImports from './eslint-rules/no-deep-relative-imports.mjs';

const apiProductionFiles = ['apps/api/src/**/*.ts'];
const apiTestFiles = [
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/*.e2e-spec.ts',
  '**/*.testing.ts',
  '**/test/**',
  '**/__test__/**',
  '**/__tests__/**',
];
const maxLinesOptions = { skipBlankLines: true, skipComments: true };
const oversizedFilesToSplit = {
  'apps/api/src/modules/user-media/infrastructure/repositories/drizzle-user-media-state.repository.ts': 826,
};

const jestRecommendedRulesAsErrors = Object.fromEntries(
  Object.keys(jestPlugin.configs['flat/recommended'].rules).map((rule) => [rule, 'error']),
);

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

const apiImportSettings = {
  'import/parsers': {
    '@typescript-eslint/parser': ['.ts'],
  },
  'import/resolver': {
    typescript: { project: path.join(tsconfigRootDir, 'apps/api/tsconfig.json') },
    node: true,
  },
};

// Module boundary zones: cross-module imports must go through the module's
// public/ barrel (or the shared micro-module's index). The only exception is
// `<module>.module.ts` — Nest module wiring imports it directly.
const apiModules = [
  'auth',
  'catalog',
  'catalog-policy',
  'home',
  'ingestion',
  'insights',
  'journal',
  'provider',
  'reviews',
  'stats',
  'tmdb',
  'trakt',
  'user-actions',
  'user-media',
  'users',
];
const sharedModules = [
  'cards',
  'clock',
  'contracts',
  'drop-off-analyzer',
  'score-calculator',
  'verdict',
];
const domainInfrastructureZone = {
  target: './apps/api/src/modules/**/domain/**/*',
  from: [
    './apps/api/src/modules/**/infrastructure/**/*',
    './apps/api/src/common/infrastructure/**/*',
    './apps/api/src/database/**/*',
  ],
  message: 'Domain must not depend on infrastructure',
};
const applicationInfrastructureZone = {
  target: './apps/api/src/modules/**/application/**/*',
  from: [
    './apps/api/src/modules/**/infrastructure/**/*',
    './apps/api/src/common/infrastructure/**/*',
    './apps/api/src/database/**/*',
  ],
  message:
    'Application must not depend on infrastructure: inject a domain port or repository token instead',
};
const applicationPresentationZone = {
  target: './apps/api/src/modules/**/application/**/*',
  from: './apps/api/src/modules/**/presentation/**/*',
  message:
    'Application must not depend on presentation: return domain types and map them to DTOs in the controller',
};
const infrastructureApplicationZone = {
  target: './apps/api/src/modules/**/infrastructure/**/*',
  from: './apps/api/src/modules/**/application/**/*',
  message:
    'Infrastructure must not depend on application: move shared types to domain and row mappers to infrastructure',
};
const presentationInfrastructureZone = {
  target: './apps/api/src/modules/**/presentation/**/*',
  from: [
    './apps/api/src/modules/**/infrastructure/**/*',
    './apps/api/src/common/infrastructure/**/*',
    './apps/api/src/database/**/*',
  ],
  message:
    'Presentation must not depend on infrastructure: call an application service, and keep guards and decorators in presentation',
};
const domainOuterLayersZone = {
  target: './apps/api/src/modules/**/domain/**/*',
  from: ['./apps/api/src/modules/**/application/**/*', './apps/api/src/modules/**/presentation/**/*'],
  message: 'Domain must not depend on application or presentation',
};
const infrastructurePresentationZone = {
  target: './apps/api/src/modules/**/infrastructure/**/*',
  from: './apps/api/src/modules/**/presentation/**/*',
  message: 'Infrastructure must not depend on presentation: move shared types to domain',
};
const moduleBoundaryZones = [
  domainInfrastructureZone,
  domainOuterLayersZone,
  applicationInfrastructureZone,
  applicationPresentationZone,
  infrastructureApplicationZone,
  infrastructurePresentationZone,
  presentationInfrastructureZone,
  {
    target: './apps/api/src/modules/shared/contracts/**/*',
    from: './apps/api/src',
    except: ['./modules/shared/contracts', './common/enums'],
    message:
      'shared/contracts must stay dependency-free: import only sibling contracts and common/enums.',
  },
  ...apiModules.flatMap((m) => [
    {
      target: `./apps/api/src/modules/!(${m})/**/*`,
      from: `./apps/api/src/modules/${m}/!(public)/**/*`,
      message: `Import from ${m}/public instead of internal files.`,
    },
    {
      target: `./apps/api/src/modules/!(${m})/**/*`,
      from: `./apps/api/src/modules/${m}/!(${m}.module).ts`,
      message: `Import from ${m}/public instead of internal files (only ${m}.module.ts may be imported directly, for module wiring).`,
    },
  ]),
  ...sharedModules.flatMap((m) => [
    {
      target: './apps/api/src/modules/!(shared)/**/*',
      from: `./apps/api/src/modules/shared/${m}/*/**/*`,
      message: `Import from shared/${m} (its index.ts) instead of internal files.`,
    },
    {
      target: './apps/api/src/modules/!(shared)/**/*',
      from: `./apps/api/src/modules/shared/${m}/!(index|${m}.module).ts`,
      message: `Import from shared/${m} (its index.ts) instead of internal files (only ${m}.module.ts may be imported directly, for module wiring).`,
    },
  ]),
];

export default [
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/build/**',
      '**/drizzle/**',
      '**/.turbo/**',
      '.vercel/**',
      '.trae/**',
      '.qoder/**',
      '**/coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/.eslintrc.js', '**/.eslintrc.cjs', '**/*.config.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
      },
    },
    rules: {
      // Disabled globally, but enabled stricter in api code-style block
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'off',
    },
  },
  // Code Style Rules (apps/api)
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      // === TYPE SAFETY ===
      // Avoid any — use unknown for external data
      '@typescript-eslint/no-explicit-any': 'error',

      // Catch unused variables
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // No throw literals — only Error objects
      'no-throw-literal': 'error',

      // Disabled: NestJS DI requires real class imports at runtime
      // Type-only imports break constructor injection
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // === MAGIC VALUES ===
      // No magic numbers — force extraction to constants
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [-1, 0, 1, 2],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],

      // === IMMUTABILITY ===
      // Prefer const over let when not reassigned
      'prefer-const': 'error',

      // No var
      'no-var': 'error',

      // === READABILITY ===
      // Prefer template literals over string concatenation
      'prefer-template': 'error',

      // Prefer destructuring (objects only)
      'prefer-destructuring': [
        'error',
        {
          array: false,
          object: true,
        },
        {
          enforceForRenamedProperties: false,
        },
      ],

      // Require === and !== (except null comparisons)
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // No nested ternary (readability)
      'no-nested-ternary': 'error',

      // === EARLY RETURNS ===
      // Max depth of nested blocks
      'max-depth': ['error', 3],

      // No else after return
      'no-else-return': ['error', { allowElseIf: false }],

      // === FUNCTIONAL STYLE ===
      // Prefer arrow functions for callbacks
      'prefer-arrow-callback': 'error',

      // Prefer array methods over for-in
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForInStatement',
          message: 'Use Object.keys/values/entries instead of for-in.',
        },
      ],

      // === LOGGING ===
      // No console — use NestJS Logger (bootstrap/scripts can override)
      'no-console': 'error',

      // === IMPORT ORDER ===
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '@nestjs/**',
              group: 'external',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin', 'type'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
      },
    },
    rules: {
      'no-throw-literal': 'off',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { string: true } },
      ],
      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        { allowConstantLoopConditions: 'only-allowed-literals' },
      ],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/*.e2e-spec.ts',
      '**/*.testing.ts',
      '**/__test__/**',
      '**/__tests__/**',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
    },
  },
  // Config/DTO/Common files — relaxed magic numbers (ports, TTL, validation limits, defaults)
  {
    files: [
      'apps/api/src/config/**/*.ts',
      'apps/api/src/common/**/*.ts',
      'apps/api/src/**/*dto*.ts',
      'apps/api/src/**/*.dto.ts',
      'apps/api/src/app.module.ts',
      'apps/api/src/main.ts',
      'apps/api/src/**/*.constants.ts',
      'apps/api/src/database/seed*.ts',
    ],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
  // Bootstrap/scripts — console allowed
  {
    files: [
      'apps/api/src/main.ts',
      'apps/api/src/scripts/**/*.ts',
      'apps/api/src/database/seed*.ts',
      '**/drizzle/**/*.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  // Domain layer — pure functions, no side effects, explicit return types
  {
    files: ['apps/api/src/modules/**/domain/**/*.ts'],
    rules: {
      'no-console': 'error',
      // Block non-deterministic globals
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Use injected clock in domain logic' },
      ],
      // Block non-deterministic methods specifically
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Avoid Math.random() in domain — inject randomness',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Avoid Date.now() in domain — use injected clock',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Domain must not access process.env — use injected config',
        },
        {
          selector: "ThrowStatement > NewExpression[callee.name='Error']",
          message: 'Use domain-specific error classes instead of generic Error',
        },
        {
          selector: 'ForInStatement',
          message: 'Use Object.keys/values/entries instead of for-in.',
        },
      ],
      // Domain functions should be self-documenting
      '@typescript-eslint/explicit-function-return-type': 'error',
    },
  },
  // Application/Infrastructure — typed errors only
  {
    files: [
      'apps/api/src/modules/**/application/**/*.ts',
      'apps/api/src/modules/**/infrastructure/**/*.ts',
      'apps/api/src/modules/**/presentation/**/*.ts',
    ],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ThrowStatement > NewExpression[callee.name='Error']",
          message: 'Use app-specific error classes instead of generic Error',
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Read environment variables in apps/api/src/config and inject the config instead',
        },
        {
          selector: 'ForInStatement',
          message: 'Use Object.keys/values/entries instead of for-in.',
        },
      ],
    },
  },
  {
    files: ['apps/api/src/modules/**/domain/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', 'drizzle-orm', 'drizzle-orm/*', 'ioredis', 'bullmq'],
              message: 'Domain must stay framework-free: no Nest, Drizzle, Redis or BullMQ.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/api/src/modules/**/domain/**/*.spec.ts',
      'apps/api/src/modules/**/domain/**/*.test.ts',
    ],
    plugins: {
      import: importPlugin,
    },
    settings: apiImportSettings,
    rules: {
      'import/no-restricted-paths': ['error', { zones: [domainInfrastructureZone] }],
    },
  },
  // Cycle guards (ADR 0001 Phase 1): catalog and catalog-policy must not depend on ingestion, and
  // tmdb must not depend on catalog. Shared types live in shared/contracts.
  // Covers specs too. Uses no-restricted-imports (not import/no-restricted-paths)
  // so it does not replace the module boundary zones below. Flat config is
  // last-wins per rule: keep ONE no-restricted-imports block per file glob, or a
  // later block for the same files silently drops these patterns.
  {
    files: ['apps/api/src/modules/catalog/**/*.ts', 'apps/api/src/modules/catalog-policy/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // modules/ingestion via `@/modules/...` or relative `../` hops only
              // (not common/enums/ingestion-status.enum or a local ./ingestion folder).
              regex: '(^|/)modules/ingestion(/|$)|^(\\.\\./)+ingestion(/|$)',
              message:
                'catalog and catalog-policy must not import ingestion (ADR 0001). Use shared/contracts for queue names, job names and Normalized* types.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/modules/tmdb/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)modules/catalog(/|$)|^(\\.\\./)+catalog(/|$)',
              message:
                'tmdb must not import catalog (ADR 0001). Use common/utils or shared/contracts instead.',
            },
          ],
        },
      ],
    },
  },
  // shared/contracts stays dependency-free: pure types/enums/constants only.
  // Packages are banned here; project imports are limited by the resolved-path
  // zone in moduleBoundaryZones (contracts may import only itself and common/enums).
  {
    files: ['apps/api/src/modules/shared/contracts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.|@/)',
              message:
                'shared/contracts must stay dependency-free: no packages (Nest, Drizzle, BullMQ, ...).',
            },
          ],
        },
      ],
    },
  },
  // Module boundaries: enforce public API imports
  {
    files: ['apps/api/src/modules/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    plugins: {
      import: importPlugin,
    },
    settings: apiImportSettings,
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: moduleBoundaryZones,
        },
      ],
      'import/no-cycle': ['error', { ignoreExternal: true }],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    plugins: {
      ratingo: { rules: { 'no-deep-relative-imports': noDeepRelativeImports } },
    },
    rules: {
      'ratingo/no-deep-relative-imports': [
        'error',
        {
          maxParentLevels: 1,
          aliasRoot: path.join(tsconfigRootDir, 'apps/api/src'),
          aliasPrefix: '@/',
        },
      ],
    },
  },
  {
    files: ['apps/api/src/**/*.spec.ts'],
    ...jestPlugin.configs['flat/recommended'],
    settings: { jest: { version: 29 } },
    rules: {
      ...jestRecommendedRulesAsErrors,
      '@typescript-eslint/require-await': 'off',
      'jest/no-focused-tests': 'error',
      'jest/no-disabled-tests': 'error',
      'jest/expect-expect': [
        'error',
        { assertFunctionNames: ['expect', 'fc.assert', 'request.**.expect'] },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: apiProductionFiles,
    ignores: apiTestFiles,
    rules: {
      'max-lines': ['error', { max: 500, ...maxLinesOptions }],
    },
  },
  ...Object.entries(oversizedFilesToSplit).map(([file, currentLines]) => ({
    files: [file],
    rules: {
      'max-lines': ['error', { max: currentLines, ...maxLinesOptions }],
    },
  })),
];
