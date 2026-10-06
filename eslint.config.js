// Lints the TypeScript and JavaScript; `astro check` type-checks the .astro pages.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', '.astro', 'node_modules'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/sw-template.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
);
