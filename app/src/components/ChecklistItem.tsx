import { useId, type ReactNode } from 'react';
import { useData } from '../state/data-context';
import type { ProgressState } from '../state/schema';
import { useEffectiveProgress } from '../state/use-progress';

interface Props {
  /** The progress key (see state/progress.ts). */
  itemKey: string;
  title: ReactNode;
  /** What to do, why, and how to fix it: shown under the title. */
  children?: ReactNode;
  /**
   * Where the Done / Needs fixing pair goes: after everything (default), or right under the
   * title, so a long item can be marked without scrolling past its evidence.
   */
  actionsPlacement?: 'end' | 'header';
  /**
   * Why this item shows Needs fixing when the player's values differ (see `derivedProblemKeys`
   * and `derivedProblemNote`). The Destiny 2 settings check explains itself.
   */
  derivedNote?: string;
}

const LABELS: Record<ProgressState, string> = { done: 'Done', problem: 'Needs fixing' };

/** Why the Destiny 2 settings check shows a state the player didn't mark. */
const DERIVED_NOTE: Record<ProgressState, string> = {
  done: 'Shown as Done because every Destiny 2 setting is marked Done in Build my config.',
  problem: 'Shown as Needs fixing because a Destiny 2 setting needs fixing in Build my config.',
};

/**
 * One checklist step with two toggles: "Done" and "Needs fixing". Tapping the active one
 * again clears it. The state is saved on the phone, so Build my config, Tune my config and
 * Troubleshoot by feel share it. Some items show a state worked out from others (see
 * `effectiveProgress`); tapping a toggle then marks the item itself.
 */
export function ChecklistItem({ itemKey, title, children, actionsPlacement = 'end', derivedNote }: Props) {
  const { data, setProgress } = useData();
  const progress = useEffectiveProgress();
  const saved = data.progress[itemKey] ?? null;
  const state = progress[itemKey] ?? null;
  const titleId = useId();

  const actions = (
    <div className="checklist-actions" role="group" aria-label="Status">
      {(Object.keys(LABELS) as ProgressState[]).map((s) => (
        <button
          key={s}
          type="button"
          className={`button small ${state === s ? 'primary' : 'secondary'}`}
          aria-pressed={state === s}
          aria-describedby={titleId}
          onClick={() => setProgress(itemKey, saved === s ? null : s)}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  );

  return (
    <li className={`card checklist-item${state ? ` is-${state}` : ''}`} aria-labelledby={titleId}>
      <p className="checklist-title" id={titleId}>
        {title}
      </p>
      {actionsPlacement === 'header' && actions}
      {children && <div className="checklist-body">{children}</div>}
      {state !== null && state !== saved && <p className="hint">{derivedNote ?? DERIVED_NOTE[state]}</p>}
      {actionsPlacement === 'end' && actions}
    </li>
  );
}
