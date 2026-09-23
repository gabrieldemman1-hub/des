#!/usr/bin/env node
// Release gate: lists what must be settled before Dialed ships, and exits 1 while anything is.
//
//   npm run check:release
//
// Today that is one thing (CONCEPT.md §6 and §12): the Easing direction. The official wording
// is ambiguous, so every statement that gives an Easing direction carries a caveat asking for
// an in-game test. Once the test is done, update those statements (and their caveats), and
// this check passes. It is not part of CI or `npm test`, which must pass while the test is
// still open.
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseBlockers } from './lib/release.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const knowledgeDir = join(repoRoot, 'knowledge');

/** @param {string} dir @returns {Promise<string[]>} */
async function jsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => {
      const full = join(dir, e.name);
      if (e.isDirectory()) return jsonFiles(full);
      return Promise.resolve(e.name.endsWith('.json') ? [full] : []);
    }),
  );
  return nested.flat().sort();
}

const blockers = [];
for (const path of await jsonFiles(knowledgeDir)) {
  const file = relative(repoRoot, path).split(sep).join('/');
  blockers.push(...releaseBlockers(file, JSON.parse(await readFile(path, 'utf8'))));
}

if (blockers.length === 0) {
  console.log('Release check passed: nothing is waiting on an in-game test.');
} else {
  console.log(`Release check failed: ${blockers.length} statement(s) still wait on the in-game Easing test.\n`);
  for (const b of blockers) console.log(`✗ ${b.file} › ${b.entryId}\n    at     ${b.path}\n    reason ${b.reason}\n`);
  console.log('Raise Easing in game and feel whether the reticle gets slower to start moving (CONCEPT.md §12),');
  console.log('then update these statements and remove the caveat.');
  process.exitCode = 1;
}
