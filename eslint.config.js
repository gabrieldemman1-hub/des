import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'coverage', 'node_modules']),
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['app/src/**/*.{ts,tsx}', 'knowledge/**/*.ts'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['app/src/**/*.tsx'],
    ignores: ['**/*.test.tsx', 'app/src/test/**'],
    extends: [reactRefresh.configs.vite()],
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Tests may use non-null assertions on values they have just checked.
    files: ['**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
]);
