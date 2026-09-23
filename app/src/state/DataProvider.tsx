import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DataContext,
  type ConfigPatch,
  type DataApi,
  type NoticeKind,
  type SaveLoadoutResult,
  type SaveState,
} from './data-context';
import { createLoadout, deleteLoadout as removeLoadout, updateLoadout, type LoadoutDraft } from './loadouts';
import { loadoutPrefix } from './progress';
import { CurrentConfig, InGameSettings, Profile, ProgressState, emptyConfig, normalizeProfile, type AppData } from './schema';
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
    (id: string) => {
      const current = latest.current;
      const configs = { ...current.configs };
      delete configs[id];
      const prefix = loadoutPrefix(id);
      const progress = Object.fromEntries(Object.entries(current.progress).filter(([key]) => !key.startsWith(prefix)));
      commit({ ...current, loadouts: removeLoadout(current.loadouts, id), configs, progress });
    },
    [commit],
  );

  const updateConfig = useCallback(
    (loadoutId: string, patch: ConfigPatch) => {
      const current = latest.current;
      if (!current.loadouts.some((l) => l.id === loadoutId)) return;
      const base = current.configs[loadoutId] ?? emptyConfig();
      // Only valid settings are saved, like the profile.
      const next = CurrentConfig.safeParse({
        matrix: { ...base.matrix, ...patch.matrix },
        aim: { ...base.aim, ...patch.aim },
        updatedAt: new Date().toISOString(),
      });
      if (next.success) commit({ ...current, configs: { ...current.configs, [loadoutId]: next.data } });
    },
    [commit],
  );

  const updateInGame = useCallback(
    (patch: Partial<InGameSettings>) => {
      // Only valid settings are saved, like the profile.
      const next = InGameSettings.safeParse({ ...latest.current.inGame, ...patch });
      if (next.success) commit({ ...latest.current, inGame: next.data });
    },
    [commit],
  );

  const setProgress = useCallback(
    (key: string, state: ProgressState | null) => {
      const current = latest.current;
      const progress = { ...current.progress };
      if (state === null) delete progress[key];
      else if (ProgressState.safeParse(state).success && key.length > 0 && key.length <= 200) progress[key] = state;
      else return;
      commit({ ...current, progress });
    },
    [commit],
  );

  const clearProgress = useCallback(
    (prefix: string) => {
      const current = latest.current;
      const progress = Object.fromEntries(Object.entries(current.progress).filter(([key]) => !key.startsWith(prefix)));
      commit({ ...current, progress });
    },
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
    () => ({
      data,
      notice,
      dismissNotice,
      saveState,
      revision,
      updateProfile,
      saveLoadout,
      deleteLoadout,
      updateConfig,
      updateInGame,
      setProgress,
      clearProgress,
      replaceData,
    }),
    [
      data,
      notice,
      dismissNotice,
      saveState,
      revision,
      updateProfile,
      saveLoadout,
      deleteLoadout,
      updateConfig,
      updateInGame,
      setProgress,
      clearProgress,
      replaceData,
    ],
  );

  return <DataContext value={api}>{children}</DataContext>;
}
