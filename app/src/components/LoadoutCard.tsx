import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { aimStyleName } from '../features/build/format';
import { useKnowledge } from '../state/knowledge-context';
import type { Loadout } from '../state/schema';
import { ConfidenceBadge } from './ConfidenceBadge';
import { ChevronIcon } from './icons';
import { settingsStatus, useLoadoutSummary, weaponsLine } from './loadout-summary';
import { TickRuler } from './TickRuler';

interface Props {
  loadout: Loadout;
  /** Where the whole card leads (the Build and Tune pickers). Without it, the card holds `children`. */
  to?: string;
  /** The heading level of the name (only without `to`): 2 on its own screen, 3 under a section heading. */
  level?: 2 | 3;
  /** Shown beside the name (the Loadouts screen's Edit link). Only without `to`. */
  aside?: ReactNode;
  /** The card's actions, under the status line. Only without `to`. */
  children?: ReactNode;
}

/**
 * One loadout, the same way in every list: its weapons on one line, its main weapon's aim style
 * with the confidence of that mapping, and where the player is with it (the config sheet's
 * progress as a tick ruler, and whether its settings are entered). The why behind the aim style stays on the
 * sheet and in the build's aim step.
 */
export function LoadoutCard({ loadout, to, level = 2, aside, children }: Props) {
  const knowledge = useKnowledge();
  const summary = useLoadoutSummary(loadout);
  const Name = level === 3 ? 'h3' : 'h2';

  const body = (
    <>
      <span className="loadout-card-weapons">{weaponsLine(loadout, knowledge)}</span>
      {summary.main ? (
        <span className="loadout-card-style">
          <span className="visually-hidden">Aim style: </span>
          <span className="tag">{aimStyleName(summary.main, summary.style)}</span>
          <ConfidenceBadge level={summary.main.mapping.confidence} />
        </span>
      ) : (
        <span className="hint">The main weapon isn’t in the knowledge base any more, so its aim style is unknown.</span>
      )}
      {summary.sheet.total > 0 && <TickRuler count={summary.sheet} prefix="Sheet" />}
      <span className="loadout-card-status">{settingsStatus(summary)}</span>
    </>
  );

  if (to) {
    return (
      <li>
        <Link className="flow-card" to={to}>
          <span className="flow-card-text">
            <span className="flow-card-title">{loadout.name}</span>
            {body}
          </span>
          <ChevronIcon />
        </Link>
      </li>
    );
  }

  return (
    <li className="card loadout-card">
      <div className="loadout-card-head">
        <Name className="loadout-card-name">{loadout.name}</Name>
        {aside}
      </div>
      {body}
      {children}
    </li>
  );
}
