import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DataContext, type DataApi, type NoticeKind, type SaveLoadoutResult, type SaveState } from './data-context';
import { createLoadout, deleteLoadout as removeLoadout, updateLoadout, type LoadoutDraft } from './loadouts';
import { Profile, normalizeProfile, type AppData } from './schema';
import { STORAGE_KEY, getBrowserStorage, loadData, saveData, setAsideUnreadable } from './storage';

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
  const [saveState, setSaveState] = useState<SaveState>(storage ? 'idle' : 'failed');
  const [revision, setRevision] = useState(0);
  // The latest data, so several changes in one event build on each other.
  const latest = useRef<AppData>(initial.data);

  // Loading is side-effect free; unreadable data is copied aside once the app has mounted.
  useEffect(() => setAsideUnreadable(storage, initial), [storage, initial]);

  // Every change saves the whole data set, so take in what Dialed saves in another tab or
  // window (or the installed app next to a browser tab). Otherwise this copy's next save would
  // overwrite it with older data.
  useEffect(() => {
    if (!storage) return;
    const onStorage = (event: StorageEvent) => {
      // Only Dialed's own key. Removals and clear() are ignored: Dialed never does either, and on a
      // shared origin (such as GitHub Pages) another site could, so the data in memory is kept and
      // written back by the next change.
      if (event.storageArea !== storage || event.key !== STORAGE_KEY || event.newValue === null) return;
      const next = loadData(storage);
      if (next.issue !== null) return;
      latest.current = next.data;
      setData(next.data);
      setRevision((r) => r + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storage]);

  const commit = useCallback(
    (next: AppData) => {
      latest.current = next;
      setData(next);
      if (saveData(storage, next)) {
        setSaveState('saved');
      } else {
        setSaveState('failed');
        setNotice((current) => (current === 'unavailable' ? current : 'save-failed'));
      }
    },
    [storage],
  );

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      // Only valid profiles are saved, so the next launch can read everything back. A platform
      // change also sets or clears the output type, so the two always agree.
      const profile = Profile.safeParse(normalizeProfile({ ...latest.current.profile, ...patch }));
      if (profile.success) commit({ ...latest.current, profile: profile.data });
    },
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

  const replaceData = useCallback(
    (next: AppData) => {
      commit(next);
      setRevision((r) => r + 1);
    },
    [commit],
  );
  const dismissNotice = useCallback(() => setNotice(null), []);

  const api = useMemo<DataApi>(
    () => ({ data, notice, dismissNotice, saveState, revision, updateProfile, saveLoadout, deleteLoadout, replaceData }),
    [data, notice, dismissNotice, saveState, revision, updateProfile, saveLoadout, deleteLoadout, replaceData],
  );

  return <DataContext value={api}>{children}</DataContext>;
}
