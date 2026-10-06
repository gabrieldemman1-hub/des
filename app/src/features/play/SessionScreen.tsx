import { useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Screen } from '../../components/Screen';
import { useKnowledge } from '../../state/knowledge-context';
import { DeathTally } from './DeathTally';
import { playPath } from './paths';
import { topCauses, totalDeaths, useSessionLog } from './session-log';

function startedText(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** The session review: the tally, the top cause and its framework, and a fresh start. */
export function SessionScreen() {
  const { kb, playDeathCauseById, playFrameworkById } = useKnowledge();
  const { log, reset } = useSessionLog();
  const [confirming, setConfirming] = useState(false);
  const deaths = totalDeaths(log);
  const top = topCauses(log).flatMap((id) => {
    const cause = playDeathCauseById(id);
    return cause ? [cause] : [];
  });
  const review = kb.play.frameworks.find((f) => f.moment === 'post-session');
  const focusLabel = top.length === 1 ? 'Next focus' : 'Next focus (tied)';

  return (
    <Screen
      title="Death tally"
      back={{ to: playPath.index, label: 'Play' }}
      intro={
        <>
          <p className="lede">Each death, tagged by what you got wrong. The biggest count is the next focus.</p>
          <p className="hint">
            {deaths === 0 ? 'Nothing tagged yet this session' : `${deaths} ${deaths === 1 ? 'death' : 'deaths'} tagged`}
            {log.startedAt && ` · session started ${startedText(log.startedAt)}`}
          </p>
        </>
      }
    >
      {top.length > 0 && (
        <section className="card play-focus" aria-label={focusLabel}>
          <p className="play-rule-label">{focusLabel}</p>
          <ul className="play-focus-list">
            {top.map((cause) => {
              const framework = playFrameworkById(cause.frameworkId);
              return (
                <li key={cause.id}>
                  <strong>{cause.label}</strong>
                  {framework && (
                    <>
                      {' · '}
                      <Link to={playPath.framework(framework.id)}>{framework.title}</Link>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {review && (
            <p className="hint">
              <Link to={playPath.framework(review.id)}>{review.title}</Link> says what to do with it.
            </p>
          )}
        </section>
      )}

      <DeathTally editable />

      <div className="form-actions">
        <button type="button" className="button secondary block" onClick={() => setConfirming(true)} disabled={deaths === 0}>
          Start a new session
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Start a new session?"
        confirmLabel="Start new session"
        danger
        onConfirm={() => {
          reset();
          setConfirming(false);
        }}
        onCancel={() => setConfirming(false)}
      >
        <p>This clears the tally. Write your one line from the review first if you haven’t.</p>
      </ConfirmDialog>
    </Screen>
  );
}
