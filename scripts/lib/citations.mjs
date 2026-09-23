// Pure helpers for `npm run verify:citations`: find citations in the knowledge JSON, turn a
// fetched page into plain text, and normalise text so a verbatim quote can be compared.
import { decodeHTML } from 'entities';

/**
 * @typedef {object} FoundCitation
 * @property {string} file    Knowledge file, relative to the repo root.
 * @property {string} entryId The nearest enclosing entry's `id` (or `name`).
 * @property {string} path    JSON path to the citation, e.g. `terms[0].definition.citations[0]`.
 * @property {string} source  The citation's `source` id.
 * @property {string} url     The cited URL as written (may include an #anchor).
 * @property {string} quote   The verbatim quote.
 */

/**
 * Walks parsed JSON and returns every citation (any object in a `citations` array that has a
 * string `url` and `quote`).
 * @param {string} file
 * @param {unknown} json
 * @returns {FoundCitation[]}
 */
export function collectCitations(file, json) {
  /** @type {FoundCitation[]} */
  const found = [];

  /**
   * @param {unknown} node
   * @param {string} path
   * @param {string} entryId
   */
  const walk = (node, path, entryId) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`, entryId));
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = /** @type {Record<string, unknown>} */ (node);
    const ownId = typeof obj.id === 'string' ? obj.id : typeof obj.name === 'string' ? obj.name : undefined;
    const id = ownId ?? entryId;
    for (const [key, value] of Object.entries(obj)) {
      const childPath = path ? `${path}.${key}` : key;
      if (key === 'citations' && Array.isArray(value)) {
        /** @type {unknown[]} */ (value).forEach((c, i) => {
          const citation = c && typeof c === 'object' ? /** @type {Record<string, unknown>} */ (c) : null;
          if (citation && typeof citation.url === 'string' && typeof citation.quote === 'string') {
            found.push({
              file,
              entryId: id,
              path: `${childPath}[${i}]`,
              source: typeof citation.source === 'string' ? citation.source : '',
              url: citation.url,
              quote: citation.quote,
            });
          }
        });
      } else {
        walk(value, childPath, id);
      }
    }
  };

  walk(json, '', '(root)');
  return found;
}

/**
 * The URL to fetch: the cited URL without its #anchor.
 * @param {string} url
 */
export function stripAnchor(url) {
  const hash = url.indexOf('#');
  return hash === -1 ? url : url.slice(0, hash);
}

/** Inline elements are removed without a space, so `Smooth<em>ing</em>` stays one word. */
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'font', 'i', 'kbd', 'mark',
  'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
]);

const TAG = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*\s*\/?>/g;
const META = /<meta\s[^>]*>/gi;
const META_TEXT_NAMES = new Set(['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description']);

/**
 * Text of `<meta name|property="description|og:*" content="…">`, which is where some pages
 * (e.g. YouTube) keep their description.
 * @param {string} html
 */
function metaText(html) {
  const parts = [];
  for (const [tag] of html.matchAll(META)) {
    const name = /\b(?:name|property)\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const key = (name?.[1] ?? name?.[2] ?? '').toLowerCase();
    if (content && META_TEXT_NAMES.has(key)) parts.push(content[1] ?? content[2] ?? '');
  }
  return parts.join(' ');
}

/**
 * Converts an HTML page to plain text: drops comments, <script> and <style>, strips tags,
 * decodes entities (named and numeric) and appends description meta tags.
 * The result is not yet normalised; see `normalizeText`.
 * @param {string} html
 */
export function htmlToText(html) {
  const meta = metaText(html);
  const body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!(?:doctype|\[CDATA\[)[^>]*>/gi, ' ')
    .replace(TAG, (_m, /** @type {string} */ tag) => (INLINE_TAGS.has(tag.toLowerCase()) ? '' : ' '));
  return decodeHTML(meta ? `${body} ${meta}` : body);
}

/**
 * Normalisation applied to both the page text and the quote before comparing:
 * curly quotes and apostrophes become straight ones, non-breaking spaces become spaces,
 * zero-width characters and soft hyphens disappear, and whitespace collapses.
 * @param {string} text
 */
export function normalizeText(text) {
  return text
    .normalize('NFC')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Page text ready for quote matching, from a fetched body and its content type.
 * @param {string} body
 * @param {string} contentType
 */
export function pageText(body, contentType) {
  const isMarkup = /html|xml/i.test(contentType) || /^\s*</.test(body);
  return normalizeText(isMarkup ? htmlToText(body) : body);
}

/**
 * @param {string} normalizedPage Output of `pageText`.
 * @param {string} quote          The raw quote from the knowledge file.
 */
export function quoteFound(normalizedPage, quote) {
  const needle = normalizeText(quote);
  return needle.length > 0 && normalizedPage.includes(needle);
}
