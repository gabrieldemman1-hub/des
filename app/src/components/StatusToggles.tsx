import { useData } from '../state/data-context';
import { STATUS_TEXT } from '../state/progress';
import type { ProgressState } from '../state/schema';

/**
 * A checklist state as a shape, never a colour alone: a ticked box for Done, a box with a mark
 * for Needs fixing, an empty box for not checked yet. A rounded square, so it never looks like a
 * confidence badge (those are circles, diamonds and triangles).
 */
export function StatusMark({ state }: { state: ProgressState | 'none' }) {
  return (
    <svg className="status-mark" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {state === 'done' && (
        <path d="m3.8 7.3 2.2 2.2 4.4-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {state === 'problem' && (
        <>
          <path d="M7 3.6v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="7" cy="10.3" r="1.1" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** The state as a word with its mark, where it can't be changed (a derived row, a card's head). */
export function StatusChip({ state }: { state: ProgressState | 'none' }) {
  return (
    <span className={`status-chip is-${state}`}>
      <StatusMark state={state} />
      {STATUS_TEXT[state]}
    </span>
  );
}

const TOGGLE_STATES: readonly ProgressState[] = ['done', 'problem'];

/**
 * The "Done" and "Needs fixing" pair every checklist uses, bound to a progress key that Build my
 * config, Tune my config and Troubleshoot by feel share. Tapping the active one again clears it.
 * `state` is the item's effective state (see `effectiveProgress`), which may differ from the
 * saved mark; tapping a toggle then marks the item itself.
 */
export function StatusToggles({
  itemKey,
  state,
  describedBy,
  className,
}: {
  itemKey: string;
  state: ProgressState | null;
  /** The id of the item's title, so each toggle says what it marks. */
  describedBy: string;
  className?: string;
}) {
  const { data, setProgress } = useData();
  const saved = data.progress[itemKey] ?? null;
  return (
    <div className={`checklist-actions${className ? ` ${className}` : ''}`} role="group" aria-label="Status">
      {TOGGLE_STATES.map((s) => (
        <button
          key={s}
          type="button"
          className={`button small secondary status-toggle is-${s}`}
          aria-pressed={state === s}
          aria-describedby={describedBy}
          onClick={() => setProgress(itemKey, saved === s ? null : s)}
        >
          <StatusMark state={state === s ? s : 'none'} />
          {STATUS_TEXT[s]}
        </button>
      ))}
    </div>
  );
}
