import { useId } from 'react';
import { Link } from 'react-router';
import { ChevronIcon, CrosshairMark } from '../components/icons';
import { InstallCard } from '../components/Install';
import { sheetStatus, useLoadoutSummary } from '../components/loadout-summary';
import { Screen } from '../components/Screen';
import { FLOWS, type FlowId } from '../content/flows';
import { buildPath, sheetPath } from '../features/build/use-build-plan';
import { summarizeChecks } from '../features/troubleshoot/setup-progress';
import { hasConfigValues } from '../state/current-values';
import { useData } from '../state/data-context';
import { checksForProfile } from '../state/guidance';
import { useKnowledge } from '../state/knowledge-context';
import { progressSummary } from '../state/progress';
import { hasInGameValues } from '../state/required-settings';
import type { Loadout } from '../state/schema';
import { useEffectiveProgress } from '../state/use-progress';

interface FlowStatus {
  text: string;
  /** Shown in the warning colour: something needs fixing. */
  problem?: boolean;
}

/**
 * Where the player is in each flow, from what is saved. A flow with nothing to say has no
 * status: Build's per-loadout progress is in the loadouts strip, and Explain a concept keeps
 * no state.
 */
function useFlowStatuses(): Partial<Record<FlowId, FlowStatus>> {
  const { data } = useData();
  const { kb } = useKnowledge();
  const progress = useEffectiveProgress();
  const { loadouts, configs, inGame, profile } = data;
  const statuses: Partial<Record<FlowId, FlowStatus>> = {};

  if (loadouts.length === 0) {
    statuses.build = { text: 'Needs a loadout' };
    statuses.tune = { text: 'Needs a loadout' };
  } else {
    const entered = loadouts.filter((l) => hasConfigValues(configs[l.id])).length;
    statuses.tune = {
      text:
        entered === 0
          ? hasInGameValues(inGame)
            ? 'Only Destiny 2 settings entered'
            : 'No settings entered yet'
          : loadouts.length === 1
            ? 'Settings entered'
            : `Settings entered for ${entered} of ${loadouts.length} loadouts`,
    };
  }

  const checks = summarizeChecks(checksForProfile(kb.foundation, profile), progress);
  if (checks.done + checks.problem > 0) {
    statuses.troubleshoot = {
      text: progressSummary(checks, 'setup checks'),
      problem: checks.problem > 0,
    };
  }
  return statuses;
}

/** First run: the one required step, in order, before the four flows. */
function StartHere() {
  const titleId = useId();
  return (
    <section className="card start-here" aria-labelledby={titleId}>
      <h2 id={titleId}>Start here</h2>
      <ol className="start-here-steps">
        <li>
          <strong>Add a loadout.</strong> Build and Tune need one; each loadout gets its own config sheet.
        </li>
        <li>
          <strong>
            <Link to="/profile">Fill in your profile</Link>
          </strong>{' '}
          (optional). Platform, mouse DPI and polling rate narrow the setup checks to your hardware.
        </li>
        <li>
          <strong>Build my config.</strong> It ends in your config sheet.
        </li>
      </ol>
      <Link className="button primary block" to="/loadouts/new">
        Add your first loadout
      </Link>
    </section>
  );
}

/** One saved loadout: its config sheet (the page a returning player opens most), and the build behind it. */
function LoadoutRow({ loadout }: { loadout: Loadout }) {
  const { sheet } = useLoadoutSummary(loadout);
  const buildLabel =
    sheet.done + sheet.problem === 0 ? 'Start build' : sheet.done === sheet.total ? 'Review build' : 'Continue build';

  return (
    <li className="home-loadout">
      <Link className="home-loadout-link" to={sheetPath(loadout.id)}>
        <span className="home-loadout-text">
          <span className="home-loadout-name">{loadout.name}</span>
          <span className={`flow-card-status${sheet.problem > 0 ? ' is-problem' : ''}`}>{sheetStatus(sheet)}</span>
        </span>
        <ChevronIcon />
      </Link>
      <Link
        className="home-loadout-link is-build"
        to={buildPath(loadout.id)}
        aria-label={`${buildLabel} for ${loadout.name}`}
      >
        <span className="home-loadout-text">{buildLabel}</span>
        <ChevronIcon />
      </Link>
    </li>
  );
}

export function HomeScreen() {
  const { data } = useData();
  const flowsId = useId();
  const loadoutsId = useId();
  const statuses = useFlowStatuses();
  const { loadouts } = data;

  return (
    <Screen
      title="Dialed"
      icon={
        <span className="home-mark" aria-hidden="true">
          <CrosshairMark size={36} />
        </span>
      }
      intro={
        <p className="lede">
          Evidence-based XIM MATRIX setup for Destiny 2 on Xbox and PC, with the why and the source behind every value.
        </p>
      }
    >
      {loadouts.length === 0 ? (
        <StartHere />
      ) : (
        <>
          <h2 className="section-title" id={loadoutsId}>
            Your loadouts
          </h2>
          <ul className="home-loadouts" aria-labelledby={loadoutsId}>
            {loadouts.map((loadout) => (
              <LoadoutRow key={loadout.id} loadout={loadout} />
            ))}
          </ul>
        </>
      )}

      <h2 className="section-title" id={flowsId}>
        What do you want to do?
      </h2>
      <ul className="flow-cards" aria-labelledby={flowsId}>
        {FLOWS.map((flow) => {
          const status = statuses[flow.id];
          return (
            <li key={flow.id}>
              <Link className="flow-card" to={flow.to}>
                <span className="flow-card-text">
                  <span className="flow-card-title">{flow.title}</span>
                  <span className="flow-card-summary">{flow.summary}</span>
                  {status && (
                    <span className={`flow-card-status${status.problem ? ' is-problem' : ''}`}>{status.text}</span>
                  )}
                </span>
                <ChevronIcon />
              </Link>
            </li>
          );
        })}
      </ul>

      <InstallCard />

      <p className="footnote">
        Every recommendation comes with its reasoning, its source and a confidence label.{' '}
        <Link to="/sources">See the sources</Link>
      </p>
    </Screen>
  );
}
