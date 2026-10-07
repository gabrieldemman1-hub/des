/// <reference types="vitest/config" />
// Tests run through Astro's Vite setup, so page tests can render .astro files.
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['content/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
