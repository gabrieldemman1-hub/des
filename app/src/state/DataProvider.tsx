import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DataContext, type DataApi, type NoticeKind, type SaveLoadoutResult } from './data-context';
import { createLoadout, deleteLoadout as removeLoadout, updateLoadout, type LoadoutDraft } from './loadouts';
import type { AppData, Profile } from './schema';
import { getBrowserStorage, loadData, saveData, setAsideUnreadable } from './storage';

interface Props {
  /** Defaults to the browser's localStorage (null when it's unavailable). Tests pass their own. */
  storage?: Storage | null;
  children: ReactNode;
}

export function DataProvider({ storage: storageProp, children }: Props) {
  const [storage] = useState(() => (storageProp === undefined ? getBrowserStorage() : storageProp));
  const [initial] = useState(() => loadData(storage));
  const [data, setData] = useState<AppData>(initial.data);
  const [notice, setNotice] = useState<NoticeKind | null>(initial.issue);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // The latest data, so several changes in one event build on each other.
  const latest = useRef<AppData>(initial.data);

  // Loading is side-effect free; unreadable data is copied aside once the app has mounted.
  useEffect(() => setAsideUnreadable(storage, initial), [storage, initial]);

  const commit = useCallback(
    (next: AppData) => {
      latest.current = next;
      setData(next);
      if (saveData(storage, next)) {
        setLastSavedAt(new Date());
      } else {
        setNotice((current) => (current === 'unavailable' ? current : 'save-failed'));
      }
    },
    [storage],
  );

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => commit({ ...latest.current, profile: { ...latest.current.profile, ...patch } }),
    [commit],
  );

  const saveLoadout = useCallback(
    (draft: LoadoutDraft, id?: string): SaveLoadoutResult => {
      const current = latest.current.loadouts;
      const result = id === undefined ? createLoadout(current, draft) : updateLoadout(current, id, draft);
      if (!result.ok) return result;
      commit({ ...latest.current, loadouts: result.value.list });
      return { ok: true, loadout: result.value.loadout };
    },
    [commit],
  );

  const deleteLoadout = useCallback(
    (id: string) => commit({ ...latest.current, loadouts: removeLoadout(latest.current.loadouts, id) }),
    [commit],
  );

  const replaceData = useCallback((next: AppData) => commit(next), [commit]);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const api = useMemo<DataApi>(
    () => ({ data, notice, dismissNotice, lastSavedAt, updateProfile, saveLoadout, deleteLoadout, replaceData }),
    [data, notice, dismissNotice, lastSavedAt, updateProfile, saveLoadout, deleteLoadout, replaceData],
  );

  return <DataContext value={api}>{children}</DataContext>;
}
