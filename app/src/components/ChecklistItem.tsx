import { useId, type ReactNode } from 'react';
import { useData } from '../state/data-context';
import type { ProgressState } from '../state/schema';

interface Props {
  /** The progress key (see state/progress.ts). */
  itemKey: string;
  title: ReactNode;
  /** What to do, why, and how to fix it: shown under the title. */
  children?: ReactNode;
}

const LABELS: Record<ProgressState, string> = { done: 'Done', problem: 'Needs fixing' };

/**
 * One checklist step with two toggles: "Done" and "Needs fixing". Tapping the active one
 * again clears it. The state is saved on the phone, so Build my config and Troubleshoot by
 * feel share it.
 */
export function ChecklistItem({ itemKey, title, children }: Props) {
  const { data, setProgress } = useData();
  const state = data.progress[itemKey] ?? null;
  const titleId = useId();

  return (
    <li className={`card checklist-item${state ? ` is-${state}` : ''}`} aria-labelledby={titleId}>
      <p className="checklist-title" id={titleId}>
        {title}
      </p>
      {children && <div className="checklist-body">{children}</div>}
      <div className="checklist-actions" role="group" aria-label="Status">
        {(Object.keys(LABELS) as ProgressState[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`button small ${state === s ? 'primary' : 'secondary'}`}
            aria-pressed={state === s}
            onClick={() => setProgress(itemKey, state === s ? null : s)}
          >
            {LABELS[s]}
          </button>
        ))}
      </div>
    </li>
  );
}
