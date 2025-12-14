import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

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
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'off',
    },
  },
];
