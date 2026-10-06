import { Link } from 'react-router';
import { useKnowledge } from '../../state/knowledge-context';
import { playPath } from './paths';
import { useSessionLog } from './session-log';

/**
 * The death causes as tally buttons, with this session's count on each. Shown on "Tag the
 * death" (one tap after dying) and on the session review (where a tap can be taken back).
 */
export function DeathTally({ editable = false }: { editable?: boolean }) {
  const { kb } = useKnowledge();
  const { log, saved, tally, untally } = useSessionLog();
  const causes = kb.play.deathCauses;

  if (causes.length === 0) return <p className="hint">The death causes haven’t loaded.</p>;

  return (
    <div className="play-tally">
      <ul className="play-tally-list">
        {causes.map((cause) => {
          const count = log.counts[cause.id] ?? 0;
          return (
            <li className="card play-tally-row" key={cause.id}>
              <div className="play-tally-text">
                <p className="play-tally-label">
                  {cause.label}
                  <span className="play-tally-count" aria-label={`${count} tagged`}>
                    {count}
                  </span>
                </p>
                <p className="hint">
                  {cause.meaning}{' '}
                  <Link to={playPath.framework(cause.frameworkId)}>Open the framework</Link>
                </p>
              </div>
              <div className="play-tally-actions">
                {editable && (
                  <button
                    type="button"
                    className="button small secondary"
                    onClick={() => untally(cause.id)}
                    disabled={count === 0}
                    aria-label={`Remove one ${cause.label}`}
                  >
                    −1
                  </button>
                )}
                <button
                  type="button"
                  className="button small primary"
                  onClick={() => tally(cause.id)}
                  aria-label={`Tag a death as ${cause.label}`}
                >
                  +1
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {!saved && (
        <p className="hint" role="status">
          This tally couldn’t be saved on this phone, so it will be gone when you close Dialed.
        </p>
      )}
    </div>
  );
}
