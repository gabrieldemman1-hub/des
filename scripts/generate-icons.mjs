#!/usr/bin/env node
// Renders the app icons from the SVG sources in assets/icons/ into public/.
//
//   npm run icons
//
// icon.svg           rounded square → favicon.svg, icons/icon-192.png, icons/icon-512.png
// icon-maskable.svg  full bleed, mark inside the maskable safe zone
//                    → icons/icon-maskable-512.png, icons/apple-touch-icon.png (180×180)
// The generated files are committed, so this only needs to run after editing an SVG.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

/** @param {string} name */
const src = (name) => fileURLToPath(new URL(`../assets/icons/${name}`, import.meta.url));
/** @param {string} name */
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

/** @type {Array<[source: string, target: string, size: number]>} */
const renders = [
  ['icon.svg', 'icons/icon-192.png', 192],
  ['icon.svg', 'icons/icon-512.png', 512],
  ['icon-maskable.svg', 'icons/icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'icons/apple-touch-icon.png', 180],
];

await mkdir(out('icons'), { recursive: true });
for (const [source, target, size] of renders) {
  const png = new Resvg(await readFile(src(source)), { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(out(target), png);
  console.log(`wrote public/${target} (${size}×${size})`);
}
await copyFile(src('icon.svg'), out('favicon.svg'));
console.log('wrote public/favicon.svg');
