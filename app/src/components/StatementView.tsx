import { Fragment, type ReactNode } from 'react';
import type { Citation, Source, Statement } from '../../../knowledge/index';
import { SOURCE_PROVENANCE_LABELS, reasonedLabel } from '../content/labels';
import { useKnowledge } from '../state/knowledge-context';
import { ConfidenceBadge } from './ConfidenceBadge';
import { guideLocation, normalizeQuote, siteOf } from './statements';

interface Props {
  statement: Statement;
  /** Hide the badge when the surrounding UI already shows it. */
  showBadge?: boolean;
  /** Hide the text when the card shows it above (see `StatementLine`), so a disclosure opens onto the reasons. */
  showText?: boolean;
  /** Hide the caveat when the card, or a note above every card, already shows it. */
  showCaveat?: boolean;
  /** Quotes (normalised) a statement higher on the page already shows in full: see `quotesShownAbove`. */
  shownAbove?: ReadonlySet<string>;
}

/** A caveat shared by the statements below it, in Dialed's voice (not a quotation). */
export function SharedCaveatNote({ children }: { children: ReactNode }) {
  return (
    <p className="shared-caveat" role="note">
      <strong>Caveat:</strong> {children}
    </p>
  );
}

/** One quoted passage, with every page it was found on. */
interface Passage {
  key: string;
  quote: string;
  urls: string[];
  notes: string[];
}

interface SourceGroup {
  id: string;
  source: Source | undefined;
  passages: Passage[];
  matrixEra: boolean;
}

/** Citations by source, in order of first appearance; a passage quoted twice is one passage with both links. */
function groupBySource(citations: readonly Citation[], sourceById: (id: string) => Source | undefined): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const c of citations) {
    let group = groups.get(c.source);
    if (!group) {
      group = { id: c.source, source: sourceById(c.source), passages: [], matrixEra: false };
      groups.set(c.source, group);
    }
    if (c.matrixEra) group.matrixEra = true;
    const key = normalizeQuote(c.quote);
    const passage = group.passages.find((p) => p.key === key);
    if (!passage) {
      group.passages.push({ key, quote: c.quote, urls: [c.url], notes: c.note ? [c.note] : [] });
    } else {
      if (!passage.urls.includes(c.url)) passage.urls.push(c.url);
      if (c.note && !passage.notes.includes(c.note)) passage.notes.push(c.note);
    }
  }
  return [...groups.values()];
}

/** The first words of a quote: enough to recognise it where it is already shown in full. */
function excerpt(quote: string, max = 48): string {
  if (quote.length <= max) return quote;
  const cut = quote.lastIndexOf(' ', max);
  return `${quote.slice(0, cut > 20 ? cut : max)}…`;
}

/** Opens in a new tab; `context` names the source when the link text is only a place in it. */
function SourceLink({ href, context, children }: { href: string; context?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {context && <span className="visually-hidden">{context}: </span>}
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

/** A knowledge-base statement with its confidence, reasoning, caveat and citations. */
export function StatementView({ statement, showBadge = true, showText = true, showCaveat = true, shownAbove }: Props) {
  const { sourceById } = useKnowledge();
  const text = normalizeQuote(statement.text);
  const groups = groupBySource(statement.citations, sourceById);
  // With the badge right above, the page's legend says what Reasoned means. In a disclosure
  // (the badge is elsewhere), or with nothing cited (Dialed's own reading), the reasoning says so.
  const leadIn = statement.confidence === 'reasoned' && (!showBadge || statement.citations.length === 0);
  const reasoning = [leadIn ? reasonedLabel(statement) : '', statement.reasoning ?? '']
    .filter((s) => s !== '')
    .join(' ');

  return (
    <div className="statement">
      {showBadge && (
        <p className="statement-badge">
          <ConfidenceBadge level={statement.confidence} />
        </p>
      )}
      {showText && <p>{statement.text}</p>}
      {reasoning && <p className="statement-reasoning">{reasoning}</p>}
      {showCaveat && statement.caveat && (
        <p className="statement-caveat">
          <strong>Caveat:</strong> {statement.caveat}
        </p>
      )}
      {groups.length > 0 && (
        <ul className="citations" aria-label="Sources">
          {groups.map((group) => {
            const title = group.source?.title ?? group.id;
            const tier = group.source?.tier;
            const urls = group.passages.flatMap((p) => p.urls);
            // Every passage from one page: the source's line is the link, and says where in the
            // guide when there are several passages. Otherwise each passage links to its own page.
            const onePage = new Set(urls).size === 1;
            const many = group.passages.length > 1;
            const where = onePage && many ? guideLocation(urls[0]!) : undefined;
            return (
              <li key={group.id}>
                <p className="citation-source">
                  {onePage ? <SourceLink href={urls[0]!}>{title}</SourceLink> : <span>{title}</span>}
                  {/* The tag says where the words live only when that differs from the badge. */}
                  {tier && tier !== statement.confidence && <span className="tag">{SOURCE_PROVENANCE_LABELS[tier]}</span>}
                  {group.matrixEra && <span className="tag">XIM MATRIX era</span>}
                  {where && <span className="citation-where">{where}</span>}
                  {many && <span className="citation-count">{group.passages.length} passages</span>}
                </p>
                <ol className={`citation-passages${many ? ' is-many' : ''}`}>
                  {group.passages.map((p) => (
                    <li key={p.key}>
                      {p.key === text ? (
                        <p className="citation-repeat">The line above, quoted in full.</p>
                      ) : shownAbove?.has(p.key) ? (
                        <p className="citation-repeat">Quoted above: “{excerpt(p.quote)}”</p>
                      ) : (
                        <blockquote>“{p.quote}”</blockquote>
                      )}
                      {/* The note says where the quote comes from when that changes its meaning,
                          e.g. a line quoted from another game's entry. */}
                      {p.notes.map((note) => (
                        <p className="citation-note" key={note}>
                          {note}
                        </p>
                      ))}
                      {!onePage && (
                        <p className="citation-link">
                          {p.urls.map((url, i) => (
                            <Fragment key={url}>
                              {i > 0 && ' · '}
                              <SourceLink href={url} context={title}>
                                {guideLocation(url) ?? siteOf(url)}
                              </SourceLink>
                            </Fragment>
                          ))}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
