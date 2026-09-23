import { createContext, use } from 'react';
import type { DraftErrors, LoadoutDraft } from './loadouts';
import type { AppData, CurrentConfig, InGameSettings, Loadout, Profile, ProgressState } from './schema';

export type NoticeKind = 'unavailable' | 'corrupt' | 'invalid' | 'save-failed';

export const NOTICE_TEXT: Record<NoticeKind, string> = {
  unavailable:
    'This browser isn’t letting Dialed save anything, so what you enter will be gone when you close it. Private browsing can cause this.',
  corrupt:
    'Your saved data couldn’t be read, so Dialed started fresh. If you have a backup, you can restore it on the Profile screen.',
  invalid:
    'Some saved data couldn’t be used and was reset. Everything that was still valid was kept.',
  'save-failed':
    'Dialed couldn’t save on this phone, so recent changes will be lost when you close it. Download a backup from the Profile screen to keep a copy.',
};

/**
 * Whether the latest change reached the phone's storage: 'idle' before any change, 'saved'
 * after a successful write, 'failed' when the latest write failed or storage is unavailable.
 */
export type SaveState = 'idle' | 'saved' | 'failed';

export type ConfigPatch = {
  matrix?: Partial<CurrentConfig['matrix']>;
  aim?: Partial<CurrentConfig['aim']>;
};

export type SaveLoadoutResult = { ok: true; loadout: Loadout } | { ok: false; errors: DraftErrors };

export interface DataApi {
  data: AppData;
  /** A storage problem to show the user, if any. */
  notice: NoticeKind | null;
  dismissNotice: () => void;
  saveState: SaveState;
  /**
   * Goes up whenever the data is replaced from outside the current form: a restored backup,
   * or a change saved by Dialed in another tab or window. Forms that keep their own copy of a
   * value use it as a `key` so they start again from the new data.
   */
  revision: number;
  updateProfile: (patch: Partial<Profile>) => void;
  /** Creates a loadout, or updates it when `id` is given. */
  saveLoadout: (draft: LoadoutDraft, id?: string) => SaveLoadoutResult;
  /** Also removes the loadout's current settings and checklist progress. */
  deleteLoadout: (id: string) => void;
  /**
   * Saves (part of) a loadout's current settings. Nested groups are merged, so
   * `{ aim: { easing: 40 } }` changes only Easing. Ignored for an unknown loadout.
   */
  updateConfig: (loadoutId: string, patch: ConfigPatch) => void;
  /** Saves (part of) Destiny 2's in-game settings, which every loadout shares. */
  updateInGame: (patch: Partial<InGameSettings>) => void;
  /** Sets a checklist item (see progress.ts), or clears it with null. */
  setProgress: (key: string, state: ProgressState | null) => void;
  /** Clears every checklist item whose key starts with `prefix`. */
  clearProgress: (prefix: string) => void;
  /** Replaces everything, e.g. from a backup. */
  replaceData: (data: AppData) => void;
}

export const DataContext = createContext<DataApi | null>(null);

export function useData(): DataApi {
  const api = use(DataContext);
  if (!api) throw new Error('useData must be used inside <DataProvider>');
  return api;
}
