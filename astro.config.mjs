// @ts-check
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

const BASE = '/des/';

/**
 * Every file under `dir`, as paths relative to it.
 * @param {string} dir
 */
async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'));
}

/**
 * Offline reading. After the build, writes sw.js with the list of every page, style, script,
 * font and icon, and a cache name that changes whenever any of them does. Only Latin font
 * files are kept: the pages use no other script.
 */
/** @returns {import('astro').AstroIntegration} */
function offline() {
  return {
    name: 'primer-offline',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const out = fileURLToPath(dir);
        const files = (await filesIn(out))
          .filter((f) => f !== 'sw.js' && !/\.map$/.test(f))
          .filter((f) => !/\.woff$/.test(f)) // every browser that runs a service worker reads woff2
          .filter((f) => !/\.woff2$/.test(f) || /latin(?!-ext)/.test(f))
          .sort();
        const hash = createHash('sha256');
        for (const f of files) hash.update(f).update(await readFile(join(out, f)));
        const version = hash.digest('hex').slice(0, 12);
        // Pages are cached by their folder URL (settings/easing/), the way people open them.
        const urls = files.map((f) => BASE + f.replace(/(^|\/)index\.html$/, '$1'));
        const template = await readFile(fileURLToPath(new URL('./src/sw-template.js', import.meta.url)), 'utf8');
        await writeFile(
          join(out, 'sw.js'),
          template.replace('__VERSION__', version).replace('__BASE__', BASE).replace('[/*__FILES__*/]', JSON.stringify(urls)),
        );
      },
    },
  };
}

// Served from GitHub Pages at https://gabrieldemman1-hub.github.io/des/.
export default defineConfig({
  site: 'https://gabrieldemman1-hub.github.io',
  base: BASE,
  trailingSlash: 'always',
  integrations: [offline()],
});
