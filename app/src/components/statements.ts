/**
 * What a page says once for the statements it shows (see `StatementView`): a caveat they share,
 * a passage quoted more than once, the Reasoned badge's meaning. Kept free of React so it can be
 * tested directly.
 */
import type { Statement } from '../../../knowledge/index';

/** The same passage with other spacing, case or a final stop is one passage. */
export function normalizeQuote(quote: string): string {
  return quote.replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '').toLowerCase();
}

/**
 * For the statements one page shows, in order: which of each one's quotes an earlier statement
 * already shows in full, so the later one refers to it instead of repeating it.
 */
export function quotesShownAbove(statements: readonly Statement[]): ReadonlyMap<Statement, ReadonlySet<string>> {
  const seen = new Set<string>();
  const above = new Map<Statement, ReadonlySet<string>>();
  for (const statement of statements) {
    const keys = statement.citations.map((c) => normalizeQuote(c.quote));
    const repeated = new Set(keys.filter((key) => seen.has(key)));
    if (repeated.size > 0) above.set(statement, repeated);
    for (const key of keys) seen.add(key);
  }
  return above;
}

/**
 * The caveat every statement here that has one shares, when at least two have it: shown once
 * above them rather than on each card.
 */
export function hoistedCaveat(statements: readonly Statement[]): string | undefined {
  const caveats = statements.flatMap((s) => (s.caveat ? [s.caveat] : []));
  const [first] = caveats;
  return first !== undefined && caveats.length > 1 && caveats.every((c) => c === first) ? first : undefined;
}

/**
 * True when one of these statements is worked out from cited definitions: its card shows the
 * Reasoned badge and leaves what that means to the page's legend (an uncited one says so itself).
 */
export function needsReasonedLegend(statements: readonly Statement[]): boolean {
  return statements.some((s) => s.confidence === 'reasoned' && s.citations.length > 0);
}

const GUIDE_HOST = 'guide.xim.tech';
const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function words(slug: string): string {
  return slug.replace(/-/g, ' ');
}

/**
 * The guide's page and section a link lands on, in words ("Aim Settings › Standard"), from its
 * path and anchor. Nothing for other sites, whose anchors are ids like #X1101.
 */
export function guideLocation(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.hostname !== GUIDE_HOST) return undefined;
  const page = parsed.pathname.split('/').filter(Boolean).at(-1);
  if (!page) return undefined;
  const title = words(page);
  const slug = parsed.hash.slice(1);
  if (!SLUG.test(slug) || words(slug) === title.toLowerCase()) return title;
  const section = words(slug);
  return `${title} › ${section.charAt(0).toUpperCase()}${section.slice(1)}`;
}

/** The site a link lands on, for a page whose place can't be named. */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
