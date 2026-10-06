import { useId } from 'react';
import { Link } from 'react-router';
import { PLAY_MOMENTS, type PlayFramework } from '../../../../knowledge/index';
import { EmptyState } from '../../components/EmptyState';
import { ChevronIcon } from '../../components/icons';
import { Screen } from '../../components/Screen';
import { PLAY_MOMENT_LABELS } from '../../content/labels';
import { useKnowledge } from '../../state/knowledge-context';
import { BasisLegend } from './BasisTag';
import { playPath } from './paths';
import { totalDeaths, useSessionLog } from './session-log';

function FrameworkCard({ framework }: { framework: PlayFramework }) {
  return (
    <li>
      <Link className="flow-card" to={playPath.framework(framework.id)}>
        <span className="flow-card-text">
          <span className="flow-card-title">{framework.title}</span>
          <span className="flow-card-summary">{framework.summary}</span>
          {framework.timeBudget && <span className="flow-card-status">{framework.timeBudget}</span>}
        </span>
        <ChevronIcon />
      </Link>
    </li>
  );
}

/** What Play is and what its basis tags mean, a tap away under the lede (like "How this works"). */
function AboutPlay({ what, basisNote }: { what: string; basisNote: string }) {
  return (
    <details className="why how-this-works">
      <summary>How this works</summary>
      <section className="prose">
        <p>{what}</p>
        <h3>Where it comes from</h3>
        <p>{basisNote}</p>
        <BasisLegend />
      </section>
    </details>
  );
}

/** Flow E, Play: frameworks by moment, the loadout plans, the map cards and the mindset behind them. */
export function PlayIndexScreen() {
  const { kb, playFrameworkById } = useKnowledge();
  const { log } = useSessionLog();
  const id = useId();
  const { play } = kb;
  const deaths = totalDeaths(log);
  const start = play.about.startWith ? playFrameworkById(play.about.startWith) : undefined;
  const groups = PLAY_MOMENTS.map((moment) => ({
    moment,
    frameworks: play.frameworks.filter((f) => f.moment === moment && f.id !== start?.id),
  })).filter((g) => g.frameworks.length > 0);

  if (play.frameworks.length === 0) {
    return (
      <Screen title="Play">
        <EmptyState title="The coaching material isn’t ready yet">
          <p>Play is built from the frameworks in Dialed’s knowledge base, and that part hasn’t loaded.</p>
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen
      title="Play"
      intro={
        <>
          <p className="lede">
            Frameworks to run while you play, and the mindset behind them. Decisions, not settings.
          </p>
          <AboutPlay what={play.about.what} basisNote={play.about.basisNote} />
        </>
      }
    >
      {start && (
        <section className="learn-section" aria-labelledby={`${id}-start`}>
          <h2 className="section-title" id={`${id}-start`}>
            Start here
          </h2>
          <Link className="flow-card play-featured" to={playPath.framework(start.id)}>
            <span className="flow-card-text">
              <span className="flow-card-title">{start.title}</span>
              <span className="flow-card-summary">{start.goal}</span>
              <span className="flow-card-status">{start.rule}</span>
            </span>
            <ChevronIcon />
          </Link>
        </section>
      )}

      <section className="learn-section" aria-labelledby={`${id}-session`}>
        <h2 className="section-title" id={`${id}-session`}>
          This session
        </h2>
        <Link className="flow-card" to={playPath.session}>
          <span className="flow-card-text">
            <span className="flow-card-title">Death tally</span>
            <span className="flow-card-summary">Tag each death by its cause; the count picks your next focus.</span>
            <span className="flow-card-status">
              {deaths === 0 ? 'No deaths tagged yet' : `${deaths} ${deaths === 1 ? 'death' : 'deaths'} tagged`}
            </span>
          </span>
          <ChevronIcon />
        </Link>
      </section>

      {groups.map(({ moment, frameworks }) => (
        <section className="learn-section" key={moment} aria-labelledby={`${id}-${moment}`}>
          <h2 className="section-title" id={`${id}-${moment}`}>
            {PLAY_MOMENT_LABELS[moment].title}
          </h2>
          <p className="hint">{PLAY_MOMENT_LABELS[moment].sub}</p>
          <ul className="flow-cards">
            {frameworks.map((framework) => (
              <FrameworkCard key={framework.id} framework={framework} />
            ))}
          </ul>
        </section>
      ))}

      {play.loadoutPlans.length > 0 && (
        <section className="learn-section" aria-labelledby={`${id}-loadouts`}>
          <h2 className="section-title" id={`${id}-loadouts`}>
            Loadout plans
          </h2>
          <p className="hint">How to play a weapon combination: its range bands and the rules that follow from them.</p>
          <ul className="flow-cards">
            {play.loadoutPlans.map((plan) => (
              <li key={plan.id}>
                <Link className="flow-card" to={playPath.loadoutPlan(plan.id)}>
                  <span className="flow-card-text">
                    <span className="flow-card-title">{plan.name}</span>
                    <span className="flow-card-summary">{plan.role}</span>
                  </span>
                  <ChevronIcon />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {play.maps.length > 0 && (
        <section className="learn-section" aria-labelledby={`${id}-maps`}>
          <h2 className="section-title" id={`${id}-maps`}>
            Maps
          </h2>
          <p className="hint">Callouts, the spots to hold, and the plan for each phase of a round.</p>
          <ul className="flow-cards">
            {play.maps.map((map) => (
              <li key={map.id}>
                <Link className="flow-card" to={playPath.map(map.id)}>
                  <span className="flow-card-text">
                    <span className="flow-card-title">{map.name}</span>
                    <span className="flow-card-summary">{map.summary}</span>
                  </span>
                  <ChevronIcon />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {play.principles.length > 0 && (
        <section className="learn-section" aria-labelledby={`${id}-mindset`}>
          <h2 className="section-title" id={`${id}-mindset`}>
            Mindset: how strong players think
          </h2>
          <p className="hint">The ideas the frameworks come from. Read these once, calmly, away from a match.</p>
          <ul className="flow-cards">
            {play.principles.map((principle) => (
              <li key={principle.id}>
                <Link className="flow-card" to={playPath.principle(principle.id)}>
                  <span className="flow-card-text">
                    <span className="flow-card-title">{principle.title}</span>
                    <span className="flow-card-summary">{principle.oneLiner}</span>
                  </span>
                  <ChevronIcon />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}
