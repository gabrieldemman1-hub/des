import { useId, type ReactElement } from 'react';
import { Link } from 'react-router';
import {
  ArrowIcon,
  BookIcon,
  ChevronIcon,
  CrosshairMark,
  SlidersIcon,
  StepsIcon,
  WaveIcon,
} from '../components/icons';
import { backLinkState } from '../components/back-link';
import { InstallCard } from '../components/Install';
import { mostRecentLoadout, useLoadoutSummary } from '../components/loadout-summary';
import { Screen } from '../components/Screen';
import { TickRuler } from '../components/TickRuler';
import { FLOWS, type FlowId } from '../content/flows';
import { weaponLines } from '../features/build/format';
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

const FLOW_ICONS: Record<FlowId, () => ReactElement> = {
  build: StepsIcon,
  tune: SlidersIcon,
  troubleshoot: WaveIcon,
  learn: BookIcon,
};

/**
 * Where the player is in each flow, from what is saved. A flow with nothing to say has no
 * status: Build's per-loadout progress is on the loadouts above, and Explain a concept keeps
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

/** First run: the one required step, in order, before the tools. */
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
          (optional). Platform and output type decide which setup checks apply to you. Your mouse DPI and polling rate are
          shown on the DPI and polling-rate checks in Build my config.
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

/** The weapons in slot order, the main one marked with the amber diamond. */
function Weapons({ loadout }: { loadout: Loadout }) {
  const knowledge = useKnowledge();
  const lines = weaponLines(loadout, knowledge);
  if (lines.length === 0) return null;
  return (
    <p className="home-weapons">
      {lines.map((w, i) => (
        <span key={w.slot}>
          {i > 0 && ' · '}
          {w.isMain ? (
            <>
              <span className="tag-main">{w.name}</span>
              <span className="visually-hidden"> (Main)</span>
            </>
          ) : (
            w.name
          )}
        </span>
      ))}
    </p>
  );
}

/**
 * The loadout Home leads with: its weapons, its sheet's progress as a ruler, and the next step
 * (the page's one amber button) beside its config sheet.
 */
function HeroLoadout({ loadout }: { loadout: Loadout }) {
  const { sheet } = useLoadoutSummary(loadout);
  const nameId = useId();
  const buildLabel =
    sheet.done + sheet.problem === 0 ? 'Start build' : sheet.done === sheet.total ? 'Review build' : 'Continue build';
  return (
    <li className="card home-hero" aria-labelledby={nameId}>
      <h3 className="home-hero-name" id={nameId}>
        {loadout.name}
      </h3>
      <Weapons loadout={loadout} />
      <TickRuler count={sheet} prefix="Sheet" />
      <div className="home-hero-actions">
        <Link className="button primary" to={buildPath(loadout.id)} aria-label={`${buildLabel} for ${loadout.name}`}>
          {buildLabel}
          <ArrowIcon />
        </Link>
        <Link className="button secondary" to={sheetPath(loadout.id)} aria-label={`Config sheet for ${loadout.name}`}>
          Config sheet
        </Link>
      </div>
    </li>
  );
}

/** Every other loadout: one row to its config sheet, with the sheet's ruler. */
function LoadoutRow({ loadout }: { loadout: Loadout }) {
  const { sheet } = useLoadoutSummary(loadout);
  return (
    <li>
      <Link className="home-loadout" to={sheetPath(loadout.id)}>
        <span className="home-loadout-name">{loadout.name}</span>
        <ChevronIcon />
        <TickRuler count={sheet} prefix="Sheet" />
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
  const recent = mostRecentLoadout(data);

  return (
    <Screen
      title="Dialed"
      icon={
        <span className="home-mark" aria-hidden="true">
          <CrosshairMark size={36} />
        </span>
      }
      intro={<p className="lede">Evidence-based XIM MATRIX setup for Destiny 2 on Xbox and PC.</p>}
    >
      {!recent ? (
        <StartHere />
      ) : (
        <>
          <div className="section-label">
            <h2 id={loadoutsId}>Your loadouts</h2>
            <span className="num">{loadouts.length}</span>
          </div>
          <ul className="home-loadouts" aria-labelledby={loadoutsId}>
            <HeroLoadout loadout={recent} />
            {loadouts
              .filter((l) => l.id !== recent.id)
              .map((loadout) => (
                <LoadoutRow key={loadout.id} loadout={loadout} />
              ))}
          </ul>
        </>
      )}

      <div className="section-label">
        <h2 id={flowsId}>Tools</h2>
      </div>
      <ul className="tool-tiles" aria-labelledby={flowsId}>
        {FLOWS.map((flow) => {
          const status = statuses[flow.id];
          const FlowIcon = FLOW_ICONS[flow.id];
          return (
            <li key={flow.id}>
              <Link className="tool-tile" to={flow.to}>
                <FlowIcon />
                <span className="tool-tile-title">{flow.title}</span>
                <span className="tool-tile-summary">{flow.summary}</span>
                {status && (
                  <span className={`tool-tile-status${status.problem ? ' is-problem' : ''}`}>{status.text}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <InstallCard />

      <p className="footnote">
        Every recommendation says how sure it is and why, with its source wherever one exists.{' '}
        <Link to="/sources" state={backLinkState({ to: '/', label: 'Home' })}>
          See the sources
        </Link>
      </p>
    </Screen>
  );
}
