import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'drizzle/**', '.vercel/**', '.trae/**', '.qoder/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  { plugins: { 'react-hooks': reactHooks }, rules: { 'react-hooks/exhaustive-deps': 'off' } },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'off',
    },
  },
];