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
}

const LABELS: Record<ProgressState, string> = { done: 'Done', problem: 'Needs fixing' };

/** Why an item is marked when the player hasn't marked it (only the Destiny 2 settings check). */
const DERIVED_NOTE: Record<ProgressState, string> = {
  done: 'Shown as Done because every Destiny 2 setting is marked Done in Build my config.',
  problem: 'Shown as Needs fixing because a Destiny 2 setting is marked Needs fixing in Build my config.',
};

/**
 * One checklist step with two toggles: "Done" and "Needs fixing". Tapping the active one
 * again clears it. The state is saved on the phone, so Build my config, Tune my config and
 * Troubleshoot by feel share it. Some items show a state worked out from others (see
 * `effectiveProgress`); tapping a toggle then marks the item itself.
 */
export function ChecklistItem({ itemKey, title, children }: Props) {
  const { data, setProgress } = useData();
  const progress = useEffectiveProgress();
  const saved = data.progress[itemKey] ?? null;
  const state = progress[itemKey] ?? null;
  const titleId = useId();

  return (
    <li className={`card checklist-item${state ? ` is-${state}` : ''}`} aria-labelledby={titleId}>
      <p className="checklist-title" id={titleId}>
        {title}
      </p>
      {children && <div className="checklist-body">{children}</div>}
      {saved === null && state !== null && <p className="hint">{DERIVED_NOTE[state]}</p>}
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
    </li>
  );
}
