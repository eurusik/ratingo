import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import * as fs from 'node:fs';
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

const webSourceFiles = ['apps/web-client/src/**/*.{ts,tsx}'];
const webTestFiles = [
  'apps/web-client/src/**/*.test.{ts,tsx}',
  'apps/web-client/src/**/*.spec.{ts,tsx}',
  'apps/web-client/src/**/__tests__/**',
];
const webGeneratedUiPrimitives = ['apps/web-client/src/shared/ui/**'];
const storefrontDir = 'apps/storefront';
const storefrontSourceFiles = [`${storefrontDir}/{app,src}/**/*.{ts,tsx}`];
const storefrontTestFiles = [`${storefrontDir}/{app,src}/**/*.test.{ts,tsx}`];
const storefrontRouteFiles = [`${storefrontDir}/app/**/*.{ts,tsx}`];
const storefrontEnvReaders = [`${storefrontDir}/src/shared/config/**`];
const webCoreSourceFiles = ['packages/web-core/src/**/*.{ts,tsx}'];
const uiSourceFiles = ['packages/ui/src/**/*.{ts,tsx}'];
const nodeTelemetrySourceFiles = ['packages/node-telemetry/src/**/*.ts'];
const aiCoreSourceFiles = ['packages/ai-core/src/**/*.ts'];
const aiOpsToolsSourceFiles = ['packages/ai-ops-tools/src/**/*.ts'];
const aiOpsToolsTestFiles = [
  'packages/ai-ops-tools/src/**/*.test.ts',
  'packages/ai-ops-tools/src/testing/*.ts',
];
const aiOpsToolsPostgresFiles = [
  'packages/ai-ops-tools/src/job-failures/postgres.job-failures-adapter.ts',
  'packages/ai-ops-tools/src/job-failures/reporting-connection.ts',
  'packages/ai-ops-tools/src/database/postgres.explorer-adapter.ts',
];
const aiCoreAnthropicAdapterFiles = [
  'packages/ai-core/src/model/adapters/anthropic/anthropic.mapper.ts',
  'packages/ai-core/src/model/adapters/anthropic/anthropic.model-adapter.ts',
];
const aiCoreTelemetryRepositoryFiles = [
  'packages/ai-core/src/runs/telemetry.run-repository.ts',
  'packages/ai-core/src/runs/create-run-repository.ts',
  'packages/ai-core/src/telemetry/agent-budget-gauge.ts',
  'packages/ai-core/src/mcp/adapters/otel/*.ts',
];
const aiCoreMcpStdioAdapterFiles = ['packages/ai-core/src/mcp/adapters/stdio/*.ts'];
const aiCoreLoaderFiles = ['packages/ai-core/src/manifest/agent-folder.loader.ts'];
const aiCoreInternalAccessFiles = ['packages/ai-core/src/http/internal-access.ts'];
const aiCoreSystemClockFiles = ['packages/ai-core/src/clock/system.clock.ts'];
const aiCoreTestFiles = [
  'packages/ai-core/src/**/*.test.ts',
  'packages/ai-core/src/**/testing/*.ts',
];
const veronicaSourceFiles = ['apps/ai/veronica/src/**/*.ts'];
const veronicaTestFiles = [
  'apps/ai/veronica/src/**/*.spec.ts',
  'apps/ai/veronica/src/**/*.testing.ts',
];
const veronicaDomainFiles = ['apps/ai/veronica/src/modules/*/domain/**/*.ts'];
const veronicaModuleFiles = [
  'apps/ai/veronica/src/modules/**/*.ts',
  'apps/ai/veronica/src/core/**/*.ts',
];
const veronicaModules = ['digest', 'notify', 'runs'];
const happySourceFiles = ['apps/ai/happy/src/**/*.ts'];
const happyTestFiles = ['apps/ai/happy/src/**/*.spec.ts', 'apps/ai/happy/src/**/*.testing.ts'];
const happyDomainFiles = ['apps/ai/happy/src/modules/*/domain/**/*.ts'];
const happyModuleFiles = ['apps/ai/happy/src/modules/**/*.ts', 'apps/ai/happy/src/core/**/*.ts'];
const happyModules = ['review'];
const dumeSourceFiles = ['apps/ai/dume/src/**/*.ts'];
const dumeTestFiles = ['apps/ai/dume/src/**/*.spec.ts', 'apps/ai/dume/src/**/*.testing.ts'];
const dumeDomainFiles = ['apps/ai/dume/src/modules/*/domain/**/*.ts'];
const dumeModuleFiles = ['apps/ai/dume/src/modules/**/*.ts', 'apps/ai/dume/src/core/**/*.ts'];
const dumeModules = ['investigation'];
const dumeEvalFiles = ['apps/ai/dume/eval/**/*.ts'];
const dumeEvalTestFiles = ['apps/ai/dume/eval/**/*.spec.ts'];
const heroUiAutoFocusRule = { 'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }] };
const webCoreTestFiles = ['packages/web-core/src/**/__tests__/**'];
const tanstackTableFiles = ['apps/web-client/src/modules/admin/components/ui/DataTable.tsx'];
const oversizedWebFilesToSplit = {
  'apps/web-client/src/modules/settings/utils/csv-parsers.ts': 519,
};

const severityOf = (entry) => (Array.isArray(entry) ? entry[0] : entry);
const isDisabled = (entry) => [0, 'off'].includes(severityOf(entry));
const withErrorSeverity = (entry) =>
  Array.isArray(entry) ? ['error', ...entry.slice(1)] : 'error';
const asErrors = (rules) =>
  Object.fromEntries(
    Object.entries(rules)
      .filter(([, entry]) => !isDisabled(entry))
      .map(([rule, entry]) => [rule, withErrorSeverity(entry)]),
  );

const jestRecommendedRulesAsErrors = Object.fromEntries(
  Object.keys(jestPlugin.configs['flat/recommended'].rules).map((rule) => [rule, 'error']),
);

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

const nextAppPlugins = {
  'react-hooks': reactHooksPlugin,
  '@next/next': nextPlugin,
  'jsx-a11y': jsxA11yPlugin,
  react: reactPlugin,
};
const nextAppRules = {
  ...asErrors(reactHooksPlugin.configs['recommended-latest'].rules),
  ...asErrors(nextPlugin.configs['core-web-vitals'].rules),
  ...asErrors(jsxA11yPlugin.flatConfigs.recommended.rules),
  'jsx-a11y/no-redundant-roles': ['error', { nav: ['navigation'], ol: ['list'], ul: ['list'] }],
  'react/jsx-key': 'error',
  'react/no-array-index-key': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/prefer-nullish-coalescing': ['error', { ignorePrimitives: { string: true } }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  'no-console': ['error', { allow: ['warn', 'error'] }],
};
const typeSafetyRules = {
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
};

const aiCoreFrameworkPattern = {
  group: ['@nestjs/*', 'next', 'next/*', '@/*'],
  message: 'ai-core is shared by every agent app: no framework imports and no app aliases.',
};
const aiCoreGuardedImports = {
  anthropic: {
    group: ['@anthropic-ai/*'],
    message: 'Provider SDKs are imported only inside their adapter folder under model/adapters.',
  },
  opentelemetry: {
    group: ['@opentelemetry/*'],
    message: 'OpenTelemetry is imported only by the telemetry adapters.',
  },
  mcpSdk: {
    group: ['@modelcontextprotocol/*'],
    message: 'The MCP SDK is imported only inside mcp/adapters/stdio.',
  },
  node: {
    group: ['node:*'],
    message: 'Node built-ins are used only by the agent folder loader.',
  },
  yaml: {
    group: ['yaml'],
    message: 'YAML parsing belongs to the agent folder loader.',
  },
};
const aiCoreImportRule = (allowed = []) => [
  'error',
  {
    patterns: [
      aiCoreFrameworkPattern,
      ...Object.entries(aiCoreGuardedImports)
        .filter(([name]) => !allowed.includes(name))
        .map(([, pattern]) => pattern),
    ],
  },
];
const aiCoreRestrictedSyntax = [
  {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    message:
      'ai-core takes its config and API keys from the caller instead of reading process.env.',
  },
  {
    selector: "ThrowStatement > NewExpression[callee.name='Error']",
    message: 'Throw typed errors that extend Error instead of the generic Error.',
  },
  {
    selector: 'ForInStatement',
    message: 'Use Object.keys/values/entries instead of for-in.',
  },
];

const ratingoPlugin = { rules: { 'no-deep-relative-imports': noDeepRelativeImports } };

const webSrcDir = 'apps/web-client/src';
const webSrc = `./${webSrcDir}`;
const webModules = fs
  .readdirSync(path.join(tsconfigRootDir, webSrcDir, 'modules'), {
    withFileTypes: true,
  })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const webLayerZones = [
  {
    target: `${webSrc}/shared/**/*`,
    from: [`${webSrc}/modules/**/*`, `${webSrc}/app/**/*`],
    message:
      'shared must not depend on modules or app: move the code into shared or pass it in as a prop.',
  },
  {
    target: `${webSrc}/core/**/*`,
    from: [`${webSrc}/modules/**/*`, `${webSrc}/app/**/*`],
    message: 'core must not depend on modules or app: move the shared types or hooks into core.',
  },
  {
    target: `${webSrc}/modules/**/*`,
    from: `${webSrc}/app/**/*`,
    message: 'modules must not depend on app routes.',
  },
];
const webModuleExtraEntryPoints = {
  journal: ['admin'],
  settings: ['import'],
};
const webModuleInternalsZone = (moduleName) => {
  const extraEntryPoints = webModuleExtraEntryPoints[moduleName] ?? [];
  const allowedImports = [
    `@/modules/${moduleName}`,
    ...extraEntryPoints.map((entryPoint) => `@/modules/${moduleName}/${entryPoint}`),
  ].join(' or ');
  return {
    target: [`${webSrc}/app/**/*`, `${webSrc}/modules/!(${moduleName})/**/*`],
    from: [
      `${webSrc}/modules/${moduleName}/*/**/*`,
      `${webSrc}/modules/${moduleName}/!(${['index', ...extraEntryPoints].join('|')}).{ts,tsx}`,
    ],
    message: `Import from ${allowedImports} instead of internal files.`,
  };
};
const webBoundaryZones = [...webLayerZones, ...webModules.map(webModuleInternalsZone)];
const webImportSettings = {
  'import/resolver': {
    typescript: { project: path.join(tsconfigRootDir, 'apps/web-client/tsconfig.json') },
    node: true,
  },
};

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
  'job-failures',
  'journal',
  'monitoring',
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
  'show-premiere',
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
  from: [
    './apps/api/src/modules/**/application/**/*',
    './apps/api/src/modules/**/presentation/**/*',
  ],
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
          message:
            'Read environment variables in apps/api/src/config and inject the config instead',
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
      ratingo: ratingoPlugin,
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
  {
    files: webSourceFiles,
    plugins: nextAppPlugins,
    languageOptions: {
      parserOptions: {
        projectService: true,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
      next: { rootDir: path.join(tsconfigRootDir, 'apps/web-client') },
    },
    rules: nextAppRules,
  },
  {
    files: webSourceFiles,
    plugins: {
      ratingo: ratingoPlugin,
    },
    rules: {
      'ratingo/no-deep-relative-imports': [
        'error',
        {
          maxParentLevels: 1,
          aliasRoot: path.join(tsconfigRootDir, webSrcDir),
          aliasPrefix: '@/',
        },
      ],
    },
  },
  {
    files: webSourceFiles,
    plugins: {
      import: importPlugin,
    },
    settings: webImportSettings,
    rules: {
      'import/no-restricted-paths': [
        'error',
        { basePath: tsconfigRootDir, zones: webBoundaryZones },
      ],
    },
  },
  {
    files: tanstackTableFiles,
    rules: {
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    files: webTestFiles,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@next/next/no-img-element': 'off',
      'jsx-a11y/alt-text': 'off',
    },
  },
  {
    files: webSourceFiles,
    ignores: webTestFiles,
    rules: typeSafetyRules,
  },
  {
    files: webSourceFiles,
    ignores: [...webTestFiles, ...webGeneratedUiPrimitives],
    rules: {
      'max-lines': ['error', { max: 500, ...maxLinesOptions }],
    },
  },
  {
    files: storefrontSourceFiles,
    plugins: { ...nextAppPlugins, ratingo: ratingoPlugin, import: importPlugin },
    languageOptions: {
      parserOptions: {
        projectService: true,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
      next: { rootDir: path.join(tsconfigRootDir, storefrontDir) },
      'import/resolver': {
        typescript: { project: path.join(tsconfigRootDir, storefrontDir, 'tsconfig.json') },
        node: true,
      },
    },
    rules: {
      ...nextAppRules,
      ...heroUiAutoFocusRule,
      'ratingo/no-deep-relative-imports': [
        'error',
        {
          maxParentLevels: 1,
          aliasRoot: path.join(tsconfigRootDir, storefrontDir, 'src'),
          aliasPrefix: '@/',
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: tsconfigRootDir,
          zones: [
            {
              target: `./${storefrontDir}/**/*`,
              from: './apps/!(storefront)/**/*',
              message: 'storefront must not import other apps: share the code through packages/*.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'Read environment variables in src/shared/config and import them from @/shared/config.',
        },
      ],
      'max-lines': ['error', { max: 500, ...maxLinesOptions }],
    },
  },
  {
    files: storefrontRouteFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '^@/(pages|widgets|features|entities|shared)/[^/]+/(?!index\\.(server|client)$)',
              message:
                'Route files import a slice or shared segment through its public API (@/pages/<slice>, @/shared/<segment>, or its index.server / index.client entry), not its internals.',
            },
          ],
        },
      ],
    },
  },
  {
    files: storefrontEnvReaders,
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: storefrontSourceFiles,
    ignores: storefrontTestFiles,
    rules: typeSafetyRules,
  },
  {
    files: webCoreSourceFiles,
    plugins: {
      'react-hooks': reactHooksPlugin,
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      'import/resolver': {
        typescript: { project: path.join(tsconfigRootDir, 'packages/web-core/tsconfig.json') },
      },
    },
    rules: {
      ...asErrors(reactHooksPlugin.configs['recommended-latest'].rules),
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', 'next-*', '@/*'],
              message:
                'web-core is shared by Next and Vite apps: no Next imports and no app aliases.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'web-core takes its config from the caller instead of reading process.env.',
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: tsconfigRootDir,
          zones: [
            {
              target: './packages/web-core/**/*',
              from: './apps/**/*',
              message: 'Packages never import apps.',
            },
          ],
        },
      ],
      'max-lines': ['error', { max: 500, ...maxLinesOptions }],
    },
  },
  {
    files: webCoreTestFiles,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: webCoreSourceFiles,
    ignores: webCoreTestFiles,
    rules: typeSafetyRules,
  },
  {
    files: uiSourceFiles,
    plugins: {
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      react: reactPlugin,
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: { project: path.join(tsconfigRootDir, 'packages/ui/tsconfig.json') },
      },
    },
    rules: {
      ...asErrors(reactHooksPlugin.configs['recommended-latest'].rules),
      ...asErrors(jsxA11yPlugin.flatConfigs.recommended.rules),
      ...heroUiAutoFocusRule,
      'react/jsx-key': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', '@/*'],
              message: 'ui is shared by Next and Vite apps: no Next imports and no app aliases.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'ui takes its config from the caller instead of reading process.env.',
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: tsconfigRootDir,
          zones: [
            {
              target: './packages/ui/**/*',
              from: './apps/**/*',
              message: 'Packages never import apps.',
            },
          ],
        },
      ],
      'max-lines': ['error', { max: 500, ...maxLinesOptions }],
      ...typeSafetyRules,
    },
  },
  {
    files: nodeTelemetrySourceFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', 'next', 'next/*', '@/*'],
              message:
                'node-telemetry is shared by the API and the storefront: no framework imports and no app aliases.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'node-telemetry takes its config from the caller instead of reading process.env.',
        },
      ],
      ...typeSafetyRules,
    },
  },
  {
    files: aiCoreSourceFiles,
    plugins: { import: importPlugin },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    settings: {
      'import/resolver': {
        typescript: { project: path.join(tsconfigRootDir, 'packages/ai-core/tsconfig.json') },
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
      'no-restricted-imports': aiCoreImportRule(),
      'no-restricted-syntax': ['error', ...aiCoreRestrictedSyntax],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Use the injected ClockPort instead of Date.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Inject randomness instead of Math.random().',
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: tsconfigRootDir,
          zones: [
            {
              target: [
                './packages/ai-core/src/{tools,loop,runs,manifest,clock,telemetry}/**/*',
                './packages/ai-core/src/model/*.ts',
              ],
              from: './packages/ai-core/src/model/adapters/**/*',
              message: 'Ports and the loop never depend on adapters; apps wire adapters in.',
            },
            {
              target: './packages/ai-core/src/model/adapters/**/*',
              from: './packages/ai-core/src/{tools,loop,runs,manifest,telemetry}/**/*',
              message: 'Model adapters depend only on the model port and neutral types.',
            },
            {
              target: './packages/ai-core/src/model/adapters/anthropic/**/*',
              from: './packages/ai-core/src/model/adapters/stub/**/*',
              message: 'Adapters never import each other.',
            },
            {
              target: './packages/ai-core/src/model/adapters/stub/**/*',
              from: './packages/ai-core/src/model/adapters/anthropic/**/*',
              message: 'Adapters never import each other.',
            },
            {
              target: './packages/ai-core/src/model/*.ts',
              from: './packages/ai-core/src/{tools,loop,runs,manifest,telemetry}/**/*',
              message: 'The model port and its types are the innermost layer.',
            },
            {
              target: './packages/ai-core/src/tools/**/*',
              from: './packages/ai-core/src/{loop,runs,manifest}/**/*',
              message: 'Tools do not depend on the loop, the run log or manifests.',
            },
            {
              target: './packages/ai-core/src/mcp/*.ts',
              from: './packages/ai-core/src/mcp/adapters/**/*',
              message: 'The MCP gateway depends on its ports; apps wire the adapters in.',
            },
            {
              target: './packages/ai-core/src/mcp/adapters/stdio/**/*',
              from: './packages/ai-core/src/mcp/adapters/otel/**/*',
              message: 'Adapters never import each other.',
            },
            {
              target: './packages/ai-core/src/mcp/adapters/otel/**/*',
              from: './packages/ai-core/src/mcp/adapters/stdio/**/*',
              message: 'Adapters never import each other.',
            },
            {
              target: './packages/ai-core/src/{tools,loop,runs,manifest,model,telemetry}/**/*',
              from: './packages/ai-core/src/mcp/**/*',
              message:
                'Only the MCP gateway knows about MCP; the rest of the core stays unaware of it.',
            },
            {
              target: './packages/ai-core/src/runs/{run,run.repository,run-logger.port}.ts',
              from: './packages/ai-core/src/{runs/telemetry.run-repository,runs/in-memory.run-repository,telemetry}*',
              message: 'The Run aggregate and its ports stay free of their adapters.',
            },
            {
              target: './packages/ai-core/src/**/*',
              from: './apps/**/*',
              message: 'Packages never import apps.',
            },
          ],
        },
      ],
      ...typeSafetyRules,
    },
  },
  {
    files: aiCoreAnthropicAdapterFiles,
    rules: { 'no-restricted-imports': aiCoreImportRule(['anthropic']) },
  },
  {
    files: aiCoreTelemetryRepositoryFiles,
    rules: { 'no-restricted-imports': aiCoreImportRule(['opentelemetry']) },
  },
  {
    files: ['packages/ai-core/src/**/testing/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', process: 'readonly', setTimeout: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: aiCoreMcpStdioAdapterFiles,
    rules: { 'no-restricted-imports': aiCoreImportRule(['node', 'mcpSdk']) },
  },
  {
    files: aiCoreLoaderFiles,
    rules: { 'no-restricted-imports': aiCoreImportRule(['node', 'yaml']) },
  },
  {
    files: aiCoreInternalAccessFiles,
    rules: { 'no-restricted-imports': aiCoreImportRule(['node']) },
  },
  {
    files: aiCoreSystemClockFiles,
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    files: aiCoreTestFiles,
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-imports': aiCoreImportRule([
        'anthropic',
        'opentelemetry',
        'node',
        'yaml',
        'mcpSdk',
      ]),
      'no-restricted-syntax': [
        'error',
        ...aiCoreRestrictedSyntax.filter((rule) => !rule.selector.startsWith('ThrowStatement')),
      ],
      'import/no-restricted-paths': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    files: aiOpsToolsSourceFiles,
    plugins: { import: importPlugin },
    languageOptions: { parserOptions: { projectService: true } },
    settings: {
      'import/resolver': {
        typescript: { project: path.join(tsconfigRootDir, 'packages/ai-ops-tools/tsconfig.json') },
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', 'next', 'next/*', '@/*'],
              message:
                'ai-ops-tools is shared by every agent app: no framework imports and no app aliases.',
            },
            {
              group: ['postgres'],
              message: 'The Postgres driver is imported only by the Postgres adapters.',
            },
            { group: ['node:*'], message: 'ai-ops-tools needs no Node built-ins.' },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'ai-ops-tools takes its config from the caller instead of reading process.env.',
        },
        {
          selector: "ThrowStatement > NewExpression[callee.name='Error']",
          message: 'Throw typed errors that extend Error instead of the generic Error.',
        },
        {
          selector: 'ForInStatement',
          message: 'Use Object.keys/values/entries instead of for-in.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Use the injected ClockPort instead of Date.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Inject randomness instead of Math.random().',
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: tsconfigRootDir,
          zones: [
            {
              target: './packages/ai-ops-tools/src/{logs,job-failures,metrics,database}/**/*',
              from: './packages/ai-ops-tools/src/{tools,testing}/**/*',
              message: 'A capability never imports the tool builder or the simulators.',
            },
            {
              target: './packages/ai-ops-tools/src/logs/**/*',
              from: './packages/ai-ops-tools/src/{job-failures,metrics,database}/**/*',
              message: 'Capabilities never import each other; share through shared or time.',
            },
            {
              target: './packages/ai-ops-tools/src/job-failures/**/*',
              from: './packages/ai-ops-tools/src/{logs,metrics,database}/**/*',
              message: 'Capabilities never import each other; share through shared or time.',
            },
            {
              target: './packages/ai-ops-tools/src/metrics/**/*',
              from: './packages/ai-ops-tools/src/{logs,job-failures,database}/**/*',
              message: 'Capabilities never import each other; share through shared or time.',
            },
            {
              target: './packages/ai-ops-tools/src/database/**/*',
              from: './packages/ai-ops-tools/src/{logs,job-failures,metrics}/**/*',
              message: 'Capabilities never import each other; share through shared or time.',
            },
            {
              target: './packages/ai-ops-tools/src/{shared,time}/**/*',
              from: './packages/ai-ops-tools/src/{logs,job-failures,metrics,database,tools,testing}/**/*',
              message: 'shared and time are the bottom of the package.',
            },
            {
              target: './packages/ai-ops-tools/src/**/*',
              from: './apps/**/*',
              message: 'Packages never import apps.',
            },
          ],
        },
      ],
      ...typeSafetyRules,
    },
  },
  {
    files: aiOpsToolsPostgresFiles,
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: aiOpsToolsTestFiles,
    rules: {
      'no-restricted-syntax': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-imports': 'off',
      'import/no-restricted-paths': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: veronicaSourceFiles,
    plugins: { import: importPlugin },
    languageOptions: { parserOptions: { projectService: true } },
    settings: {
      'import/resolver': {
        typescript: { project: path.join(tsconfigRootDir, 'apps/ai/veronica/tsconfig.json') },
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
      'import/no-restricted-paths': [
        'error',
        {
          basePath: tsconfigRootDir,
          zones: [
            {
              target: './apps/ai/veronica/src/modules/*/domain/**/*',
              from: './apps/ai/veronica/src/modules/*/{application,infrastructure,presentation}/**/*',
              message: 'Domain must not depend on outer layers.',
            },
            {
              target: './apps/ai/veronica/src/modules/*/application/**/*',
              from: './apps/ai/veronica/src/modules/*/{infrastructure,presentation}/**/*',
              message: 'Application depends on domain ports, never on adapters.',
            },
            {
              target: './apps/ai/veronica/src/modules/*/infrastructure/**/*',
              from: './apps/ai/veronica/src/modules/*/application/**/*',
              message: 'Infrastructure implements domain ports and must not call application code.',
            },
            ...veronicaModules.flatMap((m) => [
              {
                target: `./apps/ai/veronica/src/modules/!(${m})/**/*`,
                from: `./apps/ai/veronica/src/modules/${m}/!(public)/**/*`,
                message: `Import from ${m}/public instead of internal files.`,
              },
              {
                target: `./apps/ai/veronica/src/modules/!(${m})/**/*`,
                from: `./apps/ai/veronica/src/modules/${m}/!(${m}.module).ts`,
                message: `Import from ${m}/public instead of internal files.`,
              },
            ]),
            {
              target: './apps/ai/veronica/src/**/*',
              from: './apps/ai/!(veronica)/**/*',
              message:
                'Agents never import each other: share through @ratingo/ai-core or @ratingo/ai-ops-tools.',
            },
          ],
        },
      ],
      ...typeSafetyRules,
    },
  },
  {
    files: veronicaDomainFiles,
    ignores: veronicaTestFiles,
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Use the injected ClockPort instead of Date.' },
        { name: 'process', message: 'Domain code takes config as arguments, not from process.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Inject randomness instead of Math.random().',
        },
      ],
    },
  },
  {
    files: veronicaModuleFiles,
    ignores: veronicaTestFiles,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Read env only in src/config and at the entry points.',
        },
      ],
    },
  },
  {
    files: veronicaTestFiles,
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'import/no-restricted-paths': 'off',
    },
  },
  {
    files: happySourceFiles,
    plugins: { import: importPlugin },
    languageOptions: { parserOptions: { projectService: true } },
    settings: {
      'import/resolver': {
        typescript: { project: path.join(tsconfigRootDir, 'apps/ai/happy/tsconfig.json') },
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
      'import/no-restricted-paths': [
        'error',
        {
          basePath: tsconfigRootDir,
          zones: [
            {
              target: './apps/ai/happy/src/modules/*/domain/**/*',
              from: './apps/ai/happy/src/modules/*/{application,infrastructure,presentation}/**/*',
              message: 'Domain must not depend on outer layers.',
            },
            {
              target: './apps/ai/happy/src/modules/*/application/**/*',
              from: './apps/ai/happy/src/modules/*/{infrastructure,presentation}/**/*',
              message: 'Application depends on domain ports, never on adapters.',
            },
            {
              target: './apps/ai/happy/src/modules/*/infrastructure/**/*',
              from: './apps/ai/happy/src/modules/*/application/**/*',
              message: 'Infrastructure implements domain ports and must not call application code.',
            },
            ...happyModules.flatMap((m) => [
              {
                target: `./apps/ai/happy/src/modules/!(${m})/**/*`,
                from: `./apps/ai/happy/src/modules/${m}/!(public)/**/*`,
                message: `Import from ${m}/public instead of internal files.`,
              },
              {
                target: `./apps/ai/happy/src/modules/!(${m})/**/*`,
                from: `./apps/ai/happy/src/modules/${m}/!(${m}.module).ts`,
                message: `Import from ${m}/public instead of internal files.`,
              },
            ]),
            {
              target: './apps/ai/happy/src/**/*',
              from: './apps/ai/!(happy)/**/*',
              message:
                'Agents never import each other: share through @ratingo/ai-core or @ratingo/ai-ops-tools.',
            },
          ],
        },
      ],
      ...typeSafetyRules,
    },
  },
  {
    files: happyDomainFiles,
    ignores: happyTestFiles,
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Use the injected ClockPort instead of Date.' },
        { name: 'process', message: 'Domain code takes config as arguments, not from process.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Inject randomness instead of Math.random().',
        },
      ],
    },
  },
  {
    files: happyModuleFiles,
    ignores: happyTestFiles,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Read env only in src/config and at the entry points.',
        },
      ],
    },
  },
  {
    files: happyTestFiles,
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'import/no-restricted-paths': 'off',
    },
  },
  {
    files: dumeSourceFiles,
    plugins: { import: importPlugin },
    languageOptions: { parserOptions: { projectService: true } },
    settings: {
      'import/resolver': {
        typescript: { project: path.join(tsconfigRootDir, 'apps/ai/dume/tsconfig.json') },
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
      'import/no-restricted-paths': [
        'error',
        {
          basePath: tsconfigRootDir,
          zones: [
            {
              target: './apps/ai/dume/src/modules/*/domain/**/*',
              from: './apps/ai/dume/src/modules/*/{application,infrastructure,presentation}/**/*',
              message: 'Domain must not depend on outer layers.',
            },
            {
              target: './apps/ai/dume/src/modules/*/application/**/*',
              from: './apps/ai/dume/src/modules/*/{infrastructure,presentation}/**/*',
              message: 'Application depends on domain ports, never on adapters.',
            },
            {
              target: './apps/ai/dume/src/modules/*/infrastructure/**/*',
              from: './apps/ai/dume/src/modules/*/application/**/*',
              message: 'Infrastructure implements domain ports and must not call application code.',
            },
            ...dumeModules.flatMap((m) => [
              {
                target: `./apps/ai/dume/src/modules/!(${m})/**/*`,
                from: `./apps/ai/dume/src/modules/${m}/!(public)/**/*`,
                message: `Import from ${m}/public instead of internal files.`,
              },
              {
                target: `./apps/ai/dume/src/modules/!(${m})/**/*`,
                from: `./apps/ai/dume/src/modules/${m}/!(${m}.module).ts`,
                message: `Import from ${m}/public instead of internal files.`,
              },
            ]),
            {
              target: './apps/ai/dume/src/!(modules)/**/*',
              from: './apps/ai/dume/src/modules/*/!(public)/**/*',
              message: 'Outside the modules, import a module through its public barrel only.',
            },
            {
              target: './apps/ai/dume/src/main.ts',
              from: './apps/ai/dume/src/modules/*/!(public)/**/*',
              message: 'The entry point imports a module through its public barrel only.',
            },
            {
              target: './apps/ai/dume/src/**/*',
              from: './apps/ai/!(dume)/**/*',
              message:
                'Agents never import each other: share through @ratingo/ai-core or @ratingo/ai-ops-tools.',
            },
          ],
        },
      ],
      ...typeSafetyRules,
    },
  },
  {
    files: dumeDomainFiles,
    ignores: dumeTestFiles,
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Use the injected ClockPort instead of Date.' },
        { name: 'process', message: 'Domain code takes config as arguments, not from process.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Inject randomness instead of Math.random().',
        },
      ],
    },
  },
  {
    files: dumeModuleFiles,
    ignores: dumeTestFiles,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Read env only in src/config and at the entry points.',
        },
      ],
    },
  },
  {
    files: dumeTestFiles,
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'import/no-restricted-paths': 'off',
    },
  },
  {
    files: dumeEvalFiles,
    ignores: dumeEvalTestFiles,
    plugins: { import: importPlugin },
    languageOptions: { parserOptions: { projectService: true } },
    settings: {
      'import/resolver': {
        typescript: { project: path.join(tsconfigRootDir, 'apps/ai/dume/tsconfig.json') },
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: tsconfigRootDir,
          zones: [
            {
              target: './apps/ai/dume/eval/**/*',
              from: './apps/ai/dume/src/modules/*/!(public)/**/*',
              message: 'The eval imports a module through its public barrel only.',
            },
            {
              target: './apps/ai/dume/eval/**/*',
              from: './apps/ai/!(dume)/**/*',
              message:
                'Agents never import each other: share through @ratingo/ai-core or @ratingo/ai-ops-tools.',
            },
          ],
        },
      ],
    },
  },
  ...Object.entries(oversizedWebFilesToSplit).map(([file, currentLines]) => ({
    files: [file],
    rules: {
      'max-lines': ['error', { max: currentLines, ...maxLinesOptions }],
    },
  })),
];
