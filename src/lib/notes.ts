/**
 * A page's footnotes. Statements are registered in reading order before anything renders, so
 * each citation gets one number per page however often it is cited, and the notes list at the
 * end matches the superscripts.
 */
import { sourceById } from '../../content/index';
import type { Citation, Statement } from '../../content/schema';

export interface Note {
  number: number;
  citation: Citation;
  /** The source's title, e.g. "XIM MATRIX User Guide". */
  sourceTitle: string;
  /** Where on the source: "Aim Settings › Standard". Empty when the source is one page. */
  location: string;
}

const key = (c: Citation) => `${c.source}\u0000${c.url}\u0000${c.quote}`;

/** Words the guide's headings spell their own way. */
const SPELLING: Record<string, string> = {
  ads: 'ADS',
  cm360: 'cm/360',
  dpi: 'DPI',
  mkc: 'MKC',
  pc: 'PC',
  playstation: 'PlayStation',
  sab: 'SAB',
  usb: 'USB',
  vs: 'vs',
};

/** "Aim-Settings" → "Aim Settings"; "ensure-mouse-dpi" → "Ensure Mouse DPI". */
function words(slug: string): string {
  return decodeURIComponent(slug)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => SPELLING[w.toLowerCase()] ?? (w.length <= 3 && w === w.toUpperCase() ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');
}

/** The page (and section) a citation points at, as a reader would name it. */
export function locationOf(url: string): string {
  const u = new URL(url);
  if (u.hostname !== 'guide.xim.tech') return '';
  const page = u.pathname.split('/').filter(Boolean).at(-1);
  const parts = [page ? words(page) : 'Home'];
  // The guide numbers a repeated heading's anchor ("#normal_4" is a heading that reads "Normal").
  if (u.hash.length > 1) parts.push(words(u.hash.slice(1).replace(/_\d+$/, '')));
  return parts.join(' › ');
}

export class Notes {
  readonly list: Note[] = [];
  private readonly byKey = new Map<string, Note>();
  /** Each caveat's first statement on the page, which prints it in full; later ones point back. */
  private readonly caveatOwners = new Map<string, { statement: Statement; number: number }>();

  /** Registers each statement's citations, in order. */
  add(...statements: (Statement | null | undefined)[]): this {
    for (const statement of statements) {
      if (statement?.caveat && !this.caveatOwners.has(statement.caveat)) {
        this.caveatOwners.set(statement.caveat, { statement, number: this.caveatOwners.size + 1 });
      }
      for (const citation of statement?.citations ?? []) {
        if (this.byKey.has(key(citation))) continue;
        const note: Note = {
          number: this.list.length + 1,
          citation,
          sourceTitle: sourceById(citation.source)?.title ?? citation.source,
          location: locationOf(citation.url),
        };
        this.byKey.set(key(citation), note);
        this.list.push(note);
      }
    }
    return this;
  }

  /**
   * How a statement shows its caveat: in full the first time on the page (`full`), or as a link
   * back to that first one. `id` is the anchor the full caveat carries.
   */
  caveatFor(statement: Statement): { full: boolean; id: string } | null {
    if (!statement.caveat) return null;
    const owner = this.caveatOwners.get(statement.caveat);
    if (!owner) throw new Error('Caveat not registered before rendering');
    return { full: owner.statement === statement, id: `caveat-${owner.number}` };
  }

  /** The footnote numbers for a statement, in citation order, without repeats. */
  numbersFor(statement: Statement): number[] {
    const numbers = statement.citations.map((c) => {
      const note = this.byKey.get(key(c));
      if (!note) throw new Error(`Citation not registered before rendering: ${c.url}`);
      return note.number;
    });
    return [...new Set(numbers)];
  }
}

/** Footnote numbers as runs, so 1, 2, 3, 4, 7 prints as 1–4, 7. A run of two stays two numbers. */
export function runs(numbers: readonly number[]): [first: number, last: number][] {
  const out: [number, number][] = [];
  for (const n of [...numbers].sort((a, b) => a - b)) {
    const last = out.at(-1);
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out.flatMap(([a, b]) => (b === a + 1 ? [[a, a] as [number, number], [b, b] as [number, number]] : [[a, b] as [number, number]]));
}
