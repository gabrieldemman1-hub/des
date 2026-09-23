// Pure helpers for `npm run check:release`: things that must be settled before Dialed ships.

/**
 * The Easing caveat, word for word (knowledge/integrity.ts has the same text and a test keeps
 * the two equal). CONCEPT.md §6: the Easing direction is confirmed in-game before the app
 * ships it, so while any statement still carries this caveat, the release check fails.
 */
export const EASING_CAVEAT =
  "The official wording is ambiguous: we read 'lower response time' as less responsive because of the 'but'. Confirm in-game before relying on it.";

/**
 * @typedef {object} ReleaseBlocker
 * @property {string} file    Knowledge file, relative to the repo root.
 * @property {string} entryId The nearest enclosing entry's `id` (or `name`, or `input`).
 * @property {string} path    JSON path to the statement.
 * @property {string} reason
 */

/**
 * Every statement in a knowledge file whose caveat still says the Easing direction is
 * unconfirmed.
 * @param {string} file
 * @param {unknown} json
 * @returns {ReleaseBlocker[]}
 */
export function releaseBlockers(file, json) {
  /** @type {ReleaseBlocker[]} */
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
    const own = [obj.id, obj.name, obj.input].find((v) => typeof v === 'string');
    const id = typeof own === 'string' ? own : entryId;
    if (typeof obj.caveat === 'string' && obj.caveat.includes(EASING_CAVEAT)) {
      found.push({ file, entryId: id, path: path || '(root)', reason: 'Easing direction not yet confirmed in-game' });
    }
    for (const [key, value] of Object.entries(obj)) walk(value, path ? `${path}.${key}` : key, id);
  };
  walk(json, '', '(root)');
  return found;
}
