import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const appRoot = fileURLToPath(new URL('./app', import.meta.url));
const outDir = fileURLToPath(new URL('./dist', import.meta.url));

/** Dark theme background: the manifest, <meta name="theme-color"> and CSS all use it. */
const THEME_DARK = '#0d1117';

export default defineConfig({
  root: appRoot,
  // Relative base: the built app works from any subpath (e.g. GitHub Pages /<repo>/).
  base: './',
  build: {
    outDir,
    emptyOutDir: true,
    // The whole knowledge base compiles into the bundle (and is precached for offline use),
    // so the main chunk is expected to be large.
    chunkSizeWarningLimit: 1500,
  },
  plugins: [
    react(),
    VitePWA({
      // A new version waits for the user to tap "Reload" instead of reloading mid-edit.
      registerType: 'prompt',
      injectRegister: false,
      // workbox.globPatterns already precaches the icons and favicon.
      includeManifestIcons: false,
      manifest: {
        id: './',
        name: 'Dialed',
        short_name: 'Dialed',
        description:
          'Evidence-based XIM MATRIX setup for Destiny 2 on Xbox and PC, with the why and the source behind every value.',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        theme_color: THEME_DARK,
        background_color: THEME_DARK,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // manifest.webmanifest is not listed: the plugin precaches it on its own.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    root: repoRoot,
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          include: ['app/src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['app/src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['knowledge/**/*.test.ts', 'scripts/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
