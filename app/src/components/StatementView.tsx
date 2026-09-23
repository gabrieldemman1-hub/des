import type { Statement } from '../../../knowledge/index';
import { useKnowledge } from '../state/knowledge-context';
import { ConfidenceBadge } from './ConfidenceBadge';

interface Props {
  statement: Statement;
  /** Hide the badge when the surrounding UI already shows it. */
  showBadge?: boolean;
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
          <strong>Worked out from XIM’s definitions, not stated by a source.</strong>
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
          {statement.citations.map((c, i) => (
            <li key={`${c.url}-${i}`}>
              <blockquote>“{c.quote}”</blockquote>
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                {sourceById(c.source)?.title ?? c.source}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
