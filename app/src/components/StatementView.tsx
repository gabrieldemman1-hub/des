import type { Statement } from '../../../knowledge/index';
import { SOURCE_TIER_LABELS } from '../content/labels';
import { useKnowledge } from '../state/knowledge-context';
import { ConfidenceBadge } from './ConfidenceBadge';

interface Props {
  statement: Statement;
  /** Hide the badge when the surrounding UI already shows it. */
  showBadge?: boolean;
}

/**
 * How a reasoned statement is introduced. With citations it applies XIM's definitions
 * (CONCEPT.md §8). Without any, it is Dialed's own reading, and the caveat says why.
 */
function reasonedLabel(statement: Statement): string {
  return statement.citations.length > 0
    ? 'Worked out from XIM’s definitions, not stated by a source.'
    : 'Worked out by Dialed, not stated by any source.';
}

/** A knowledge-base statement with its confidence, reasoning, caveat and citations. */
export function StatementView({ statement, showBadge = true }: Props) {
  const { sourceById } = useKnowledge();
  return (
    <div className="statement">
      {showBadge && (
        <p className="statement-badge">
          <ConfidenceBadge level={statement.confidence} />
        </p>
      )}
      <p>{statement.text}</p>
      {statement.confidence === 'reasoned' && (
        <p className="statement-reasoning">
          <strong>{reasonedLabel(statement)}</strong>
          {statement.reasoning ? ` ${statement.reasoning}` : null}
        </p>
      )}
      {statement.caveat && (
        <p className="statement-caveat">
          <strong>Caveat:</strong> {statement.caveat}
        </p>
      )}
      {statement.citations.length > 0 && (
        <ul className="citations" aria-label="Sources">
          {statement.citations.map((c, i) => {
            const source = sourceById(c.source);
            return (
              <li key={`${c.url}-${i}`}>
                <blockquote>“{c.quote}”</blockquote>
                {/* The note says where the quote comes from when that changes its meaning,
                    e.g. a line quoted from another game's entry. */}
                {c.note && <p className="citation-note">{c.note}</p>}
                <p className="citation-source">
                  <a href={c.url} target="_blank" rel="noopener noreferrer">
                    {source?.title ?? c.source}
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                  {source && <span className="tag">{SOURCE_TIER_LABELS[source.tier]}</span>}
                  {c.matrixEra && <span className="tag">XIM MATRIX era</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
