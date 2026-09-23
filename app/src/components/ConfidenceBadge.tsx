import type { Confidence } from '../../../knowledge/index';
import { CONFIDENCE_INFO } from '../content/labels';

/** A distinct shape per level, so the badge never relies on colour alone (the text label leads). */
function Shape({ level }: { level: Confidence }) {
  switch (level) {
    case 'official':
      return <circle cx="5" cy="5" r="4" />;
    case 'expert':
      return <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" />;
    case 'contested':
      return (
        <>
          <circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5 1.6a3.4 3.4 0 0 1 0 6.8Z" />
        </>
      );
    case 'reasoned':
      return <path d="M5 1 9.3 8.8H0.7Z" />;
    case 'gap':
      return <circle cx="5" cy="5" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.4" />;
  }
}

interface Props {
  level: Confidence;
  /** Show the one-line meaning after the label (used in the legend). */
  withMeaning?: boolean;
}

export function ConfidenceBadge({ level, withMeaning = false }: Props) {
  const info = CONFIDENCE_INFO[level];
  return (
    <span className="confidence">
      <span className={`badge badge-${level}`}>
        <svg className="badge-shape" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" fill="currentColor">
          <Shape level={level} />
        </svg>
        <span className="visually-hidden">Confidence: </span>
        {info.label}
      </span>
      {withMeaning && <span className="confidence-meaning">{info.meaning}</span>}
    </span>
  );
}
