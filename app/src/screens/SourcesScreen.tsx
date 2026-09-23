import { CONFIDENCE_LEVELS } from '../../../knowledge/index';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { NoticeBanner } from '../components/NoticeBanner';
import { Screen } from '../components/Screen';
import { SOURCE_TIER_LABELS } from '../content/labels';
import { useKnowledge } from '../state/knowledge-context';

export function SourcesScreen() {
  const { kb, issues } = useKnowledge();

  return (
    <Screen
      title="Sources"
      intro={
        <p className="lede">
          Dialed only uses the sources below, and only material written for the XIM MATRIX: nothing for XIM APEX or XIM4.
          Adding a source requires a logged decision.
        </p>
      }
    >
      {issues.length > 0 && (
        <NoticeBanner>
          Part of the knowledge base failed its checks and was left out of this build ({issues.length}{' '}
          {issues.length === 1 ? 'problem' : 'problems'}).
        </NoticeBanner>
      )}

      <h2 className="section-title">Whitelist</h2>
      {kb.sources.length === 0 ? (
        <p className="hint">The source list hasn’t been loaded.</p>
      ) : (
        <ul className="source-list">
          {kb.sources.map((source) => (
            <li className="card source-card" key={source.id}>
              <p className="source-tier">
                <span className="tag">{SOURCE_TIER_LABELS[source.tier]}</span>
              </p>
              <h3>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              </h3>
              <p className="source-publisher">{source.publisher}</p>
              {source.notes && <p className="source-notes">{source.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">Confidence labels</h2>
      <p className="hint">Every recommendation and explanation carries one of these, with its source.</p>
      <ul className="legend">
        {CONFIDENCE_LEVELS.map((level) => (
          <li key={level}>
            <ConfidenceBadge level={level} withMeaning />
          </li>
        ))}
      </ul>
    </Screen>
  );
}
