import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

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
  'user-actions',
  'user-media',
  'users',
];
const sharedModules = ['cards', 'clock', 'drop-off-analyzer', 'score-calculator', 'verdict'];
const moduleBoundaryZones = [
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
      '@typescript-eslint/no-explicit-any': 'warn',

      // Catch unused variables
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // No throw literals — only Error objects
      'no-throw-literal': 'error',

      // Disabled: NestJS DI requires real class imports at runtime
      // Type-only imports break constructor injection
      '@typescript-eslint/consistent-type-imports': 'off',

      // === MAGIC VALUES ===
      // No magic numbers — force extraction to constants
      'no-magic-numbers': [
        'warn',
        {
          ignore: [-1, 0, 1, 2],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
        },
      ],

      // === IMMUTABILITY ===
      // Prefer const over let when not reassigned
      'prefer-const': 'error',

      // No var
      'no-var': 'error',

      // === READABILITY ===
      // Prefer template literals over string concatenation
      'prefer-template': 'warn',

      // Prefer destructuring (objects only)
      'prefer-destructuring': [
        'warn',
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
      'no-nested-ternary': 'warn',

      // === EARLY RETURNS ===
      // Max depth of nested blocks
      'max-depth': ['warn', 3],

      // No else after return
      'no-else-return': ['warn', { allowElseIf: false }],

      // === FUNCTIONAL STYLE ===
      // Prefer arrow functions for callbacks
      'prefer-arrow-callback': 'warn',

      // Prefer array methods over for-in
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'ForInStatement',
          message: 'Use Object.keys/values/entries instead of for-in.',
        },
      ],

      // === LOGGING ===
      // No console — use NestJS Logger (bootstrap/scripts can override)
      'no-console': 'warn',

      // === IMPORT ORDER ===
      'import/order': [
        'warn',
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
  // Config/DTO/Common files — relaxed magic numbers (ports, TTL, validation limits, defaults)
  {
    files: [
      'apps/api/src/config/**/*.ts',
      'apps/api/src/common/**/*.ts',
      'apps/api/src/**/*dto*.ts',
      'apps/api/src/**/*.dto.ts',
      'apps/api/src/app.module.ts',
      'apps/api/src/main.ts',
    ],
    rules: {
      'no-magic-numbers': 'off',
    },
  },
  // Bootstrap/scripts — console allowed
  {
    files: [
      'apps/api/src/main.ts',
      'apps/api/scripts/**/*.ts',
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
      '@typescript-eslint/explicit-function-return-type': 'warn',
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
          selector: 'ForInStatement',
          message: 'Use Object.keys/values/entries instead of for-in.',
        },
      ],
    },
  },
  // Domain must not depend on infrastructure (clean architecture)
  {
    files: ['apps/api/src/modules/**/domain/**/*.ts'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './apps/api/src/modules/**/domain/**/*',
              from: './apps/api/src/modules/**/infrastructure/**/*',
              message: 'Domain must not depend on infrastructure',
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
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: moduleBoundaryZones,
        },
      ],
    },
  },
];
