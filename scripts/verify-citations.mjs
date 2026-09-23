#!/usr/bin/env node
// Checks that every citation's quote appears verbatim on the page it cites.
//
//   npm run verify:citations            check every citation in knowledge/**/*.json
//   npm run verify:citations -- --verbose   also list the citations that pass
//   npm run verify:citations -- --dir <path>  check another folder (e.g. a test fixture)
//
// Each unique URL (anchor stripped) is fetched once. The page is converted to text and both
// sides are normalised (see scripts/lib/citations.mjs) before a substring check. A cited
// #anchor must exist on the page (an id, or a name on an <a> element).
// Exits 1 if any quote or anchor is missing, any page can't be fetched, or any file isn't
// valid JSON.
//
// Networking: requests honour HTTPS_PROXY / HTTP_PROXY / NO_PROXY (undici's
// EnvHttpProxyAgent), and extra CA certificates come from NODE_EXTRA_CA_CERTS.
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnvHttpProxyAgent, fetch } from 'undici';
import { anchorOf, anchorTargets, collectCitations, pageText, quoteFound, stripAnchor } from './lib/citations.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const dirArg = args.indexOf('--dir');
const knowledgeDir = dirArg !== -1 && args[dirArg + 1] ? resolve(args[dirArg + 1]) : join(repoRoot, 'knowledge');

const CONCURRENCY = 4;
const TIMEOUT_MS = 30_000;
const ATTEMPTS = 2;
const USER_AGENT = 'Mozilla/5.0 (compatible; DialedCitationCheck/0.1)';

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

/** @param {string} path */
const display = (path) => {
  const rel = relative(repoRoot, path);
  return rel.startsWith('..') ? path : rel.split(sep).join('/');
};

const dispatcher = new EnvHttpProxyAgent();

/**
 * @param {string} url
 * @returns {Promise<{ ok: true, text: string, anchors: Set<string> } | { ok: false, error: string }>}
 */
async function fetchPage(url) {
  let lastError = 'unknown error';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        dispatcher,
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
          'accept-language': 'en',
        },
      });
      const body = await res.text();
      if (!res.ok) {
        lastError = `HTTP ${res.status} ${res.statusText}`.trim();
        if (res.status < 500) break; // a 4xx won't fix itself on retry
        continue;
      }
      const contentType = res.headers.get('content-type') ?? '';
      const isMarkup = /html|xml/i.test(contentType) || /^\s*</.test(body);
      return { ok: true, text: pageText(body, contentType), anchors: isMarkup ? anchorTargets(body) : new Set() };
    } catch (error) {
      const err = /** @type {Error & { cause?: { message?: string, code?: string } }} */ (error);
      lastError = [err.message, err.cause?.code, err.cause?.message].filter(Boolean).join(': ');
    }
  }
  return { ok: false, error: lastError };
}

/**
 * Runs `worker` over `items` with at most `limit` in flight.
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
async function mapLimit(items, limit, worker) {
  /** @type {R[]} */
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(/** @type {T} */ (items[i]));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/** @param {string} s @param {number} max */
const clip = (s, max = 160) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

async function main() {
  /** @type {import('./lib/citations.mjs').FoundCitation[]} */
  const citations = [];
  /** @type {string[]} */
  const fileErrors = [];

  for (const path of await jsonFiles(knowledgeDir)) {
    const file = display(path);
    try {
      citations.push(...collectCitations(file, JSON.parse(await readFile(path, 'utf8'))));
    } catch (error) {
      fileErrors.push(`${file}: ${/** @type {Error} */ (error).message}`);
    }
  }

  for (const message of fileErrors) console.error(`✗ Could not read ${message}`);

  const urls = [...new Set(citations.map((c) => stripAnchor(c.url)))];
  console.log(`Checking ${citations.length} citation(s) on ${urls.length} page(s)…\n`);

  const pages = new Map(
    await mapLimit(urls, CONCURRENCY, async (url) => {
      const page = await fetchPage(url);
      console.log(`${page.ok ? '  fetched' : '  FAILED '} ${url}${page.ok ? '' : ` (${page.error})`}`);
      return /** @type {const} */ ([url, page]);
    }),
  );
  if (urls.length > 0) console.log('');

  let failures = 0;
  for (const c of citations) {
    const page = pages.get(stripAnchor(c.url));
    const anchor = anchorOf(c.url);
    const problem = !page
      ? 'page was not fetched'
      : !page.ok
        ? `could not fetch the page: ${page.error}`
        : !quoteFound(page.text, c.quote)
          ? 'quote not found on the page'
          : anchor && !page.anchors.has(anchor)
            ? `anchor #${anchor} not found on the page`
            : null;
    if (problem) {
      failures++;
      console.log(`✗ ${c.file} › ${c.entryId}`);
      console.log(`    at     ${c.path}`);
      console.log(`    url    ${c.url}`);
      console.log(`    quote  "${clip(c.quote)}"`);
      console.log(`    reason ${problem}\n`);
    } else if (verbose) {
      console.log(`✓ ${c.file} › ${c.entryId} — "${clip(c.quote, 80)}"`);
    }
  }

  const passed = citations.length - failures;
  console.log(
    `Summary: ${citations.length} citation(s) on ${urls.length} page(s): ${passed} verified, ${failures} failed` +
      (fileErrors.length ? `, ${fileErrors.length} unreadable file(s)` : '') +
      '.',
  );
  if (citations.length === 0 && fileErrors.length === 0) console.log('No citations in the knowledge base yet.');

  await dispatcher.close();
  process.exitCode = failures > 0 || fileErrors.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
