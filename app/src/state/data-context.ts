import { createContext, use } from 'react';
import type { DraftErrors, LoadoutDraft } from './loadouts';
import type { AppData, Loadout, Profile } from './schema';

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

export type SaveLoadoutResult = { ok: true; loadout: Loadout } | { ok: false; errors: DraftErrors };

export interface DataApi {
  data: AppData;
  /** A storage problem to show the user, if any. */
  notice: NoticeKind | null;
  dismissNotice: () => void;
  /** When the last change was written to the phone (null before the first change). */
  lastSavedAt: Date | null;
  updateProfile: (patch: Partial<Profile>) => void;
  /** Creates a loadout, or updates it when `id` is given. */
  saveLoadout: (draft: LoadoutDraft, id?: string) => SaveLoadoutResult;
  deleteLoadout: (id: string) => void;
  /** Replaces everything, e.g. from a backup. */
  replaceData: (data: AppData) => void;
}

export const DataContext = createContext<DataApi | null>(null);

export function useData(): DataApi {
  const api = use(DataContext);
  if (!api) throw new Error('useData must be used inside <DataProvider>');
  return api;
}
