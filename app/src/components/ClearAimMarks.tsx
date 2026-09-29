import { useState } from 'react';
import { useData } from '../state/data-context';
import { aimProgressPrefix } from '../state/progress';
import type { Loadout } from '../state/schema';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Clears a loadout's aim marks, which Build my config's Aim settings step and Tune my config
 * share, after a confirmation. The Destiny 2 and setup-check marks, shared by every loadout,
 * stay. Nothing to clear leaves the button in place (focus returns to it) but inert.
 */
export function ClearAimMarks({ loadout }: { loadout: Loadout }) {
  const { data, clearProgress } = useData();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const prefix = aimProgressPrefix(loadout.id);
  const canClear = Object.keys(data.progress).some((key) => key.startsWith(prefix));

  return (
    <div className="clear-marks">
      <button
        type="button"
        className="button small danger"
        aria-disabled={!canClear}
        onClick={() => {
          if (canClear) setOpen(true);
        }}
      >
        Clear aim marks
      </button>
      <p className="hint" role="status">
        {message}
      </p>
      <ConfirmDialog
        open={open}
        title={`Clear the aim marks for “${loadout.name}”?`}
        confirmLabel="Clear marks"
        danger
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          clearProgress(prefix);
          setOpen(false);
          setMessage(`Cleared the aim marks for “${loadout.name}”.`);
        }}
      >
        <p>
          This clears the Done and Needs fixing marks on the aim settings for this loadout. Build my config and Tune
          my config share these marks, so they are cleared in both.
        </p>
        <p>
          The Destiny 2 settings and MATRIX setup marks are shared with your other loadouts and with Troubleshoot by
          feel, so they stay as they are.
        </p>
      </ConfirmDialog>
    </div>
  );
}
