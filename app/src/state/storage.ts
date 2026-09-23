/**
 * Reading and writing the phone's copy of the profile and loadouts.
 *
 * All data lives in localStorage under one versioned key. Every access is wrapped in
 * try/catch: unavailable storage, corrupt JSON or invalid data fall back to defaults
 * (keeping whatever is still valid) and report an issue instead of throwing.
 */
import {
  AppData,
  BackupFile,
  CurrentConfig,
  InGameSettings,
  Loadout,
  LoadoutId,
  Profile,
  ProgressState,
  STORAGE_VERSION,
  defaultData,
  emptyInGame,
  normalizeProfile,
} from './schema';

export const STORAGE_KEY = 'dialed:v1';
/** Where unreadable data is copied before it can be overwritten, so it isn't silently lost. */
export const UNREADABLE_KEY = 'dialed:v1:unreadable';

export type LoadIssue = 'unavailable' | 'corrupt' | 'invalid';

export interface LoadResult {
  data: AppData;
  issue: LoadIssue | null;
  /** The stored text that couldn't be used, when `issue` is 'corrupt' or 'invalid'. */
  unreadable?: string;
}

/**
 * localStorage, or null when the browser blocks reading it (private modes, disabled cookies…).
 * Only reading is probed: storage that can be read but not written (a full quota, for example)
 * is still returned, so saved data stays visible and a failed write shows up through `saveData`.
 */
export function getBrowserStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    storage.getItem(STORAGE_KEY);
    return storage;
  } catch {
    return null;
  }
}

/**
 * After a load that found unreadable data: copies it aside under UNREADABLE_KEY, then
 * replaces it with what could be recovered, so the problem is reported once rather than on
 * every launch. If the copy can't be made, the original is left alone so nothing is lost.
 * Safe to call more than once.
 */
export function setAsideUnreadable(storage: Storage | null, result: LoadResult): void {
  if (!storage || result.unreadable === undefined) return;
  try {
    storage.setItem(UNREADABLE_KEY, result.unreadable);
  } catch {
    return;
  }
  saveData(storage, result.data);
}

/** Keeps the valid parts of stored data whose overall shape is wrong. */
function salvage(value: unknown): AppData {
  const data = defaultData();
  if (!value || typeof value !== 'object') return data;
  const record = value as Record<string, unknown>;
  // Field by field, so one bad value doesn't reset the whole profile. Every field has a
  // default, which `defaultData()` has already filled in.
  const storedProfile = record.profile;
  if (storedProfile && typeof storedProfile === 'object') {
    const fields = storedProfile as Record<string, unknown>;
    const profile = data.profile as Record<keyof Profile, unknown>;
    for (const key of Object.keys(Profile.shape) as (keyof Profile)[]) {
      const field = Profile.shape[key].safeParse(fields[key]);
      if (field.success) profile[key] = field.data;
    }
    // Fields that are valid one by one can still disagree (an Xbox profile with a PC output).
    data.profile = normalizeProfile(data.profile);
  }
  if (Array.isArray(record.loadouts)) {
    const seen = new Set<string>();
    for (const item of record.loadouts) {
      const loadout = Loadout.safeParse(item);
      if (loadout.success && !seen.has(loadout.data.id)) {
        seen.add(loadout.data.id);
        data.loadouts.push(loadout.data);
      }
    }
  }
  // Field by field, like the profile.
  const storedInGame = record.inGame;
  if (storedInGame && typeof storedInGame === 'object' && !Array.isArray(storedInGame)) {
    const fields = storedInGame as Record<string, unknown>;
    const inGame = data.inGame as Record<keyof InGameSettings, unknown>;
    for (const key of Object.keys(InGameSettings.shape) as (keyof InGameSettings)[]) {
      const field = InGameSettings.shape[key].safeParse(fields[key]);
      if (field.success) inGame[key] = field.data;
    }
  }
  // Entry by entry, like the loadouts: settings for a loadout that no longer exists are dropped.
  if (record.configs && typeof record.configs === 'object' && !Array.isArray(record.configs)) {
    const ids = new Set(data.loadouts.map((l) => l.id));
    for (const [id, value] of Object.entries(record.configs as Record<string, unknown>)) {
      const config = CurrentConfig.safeParse(value);
      if (LoadoutId.safeParse(id).success && ids.has(id) && config.success) data.configs[id] = config.data;
    }
  }
  if (record.progress && typeof record.progress === 'object' && !Array.isArray(record.progress)) {
    for (const [key, value] of Object.entries(record.progress as Record<string, unknown>)) {
      const state = ProgressState.safeParse(value);
      if (key.length > 0 && key.length <= 200 && state.success) data.progress[key] = state.data;
    }
  }
  return data;
}

/** Reads the saved data without changing storage (see `setAsideUnreadable`). */
export function loadData(storage: Storage | null): LoadResult {
  if (!storage) return { data: defaultData(), issue: 'unavailable' };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: defaultData(), issue: 'unavailable' };
  }
  if (raw === null) return { data: defaultData(), issue: null };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { data: defaultData(), issue: 'corrupt', unreadable: raw };
  }

  const migrated = migrateToCurrent(json);
  if (typeof migrated === 'string') return { data: salvage(json), issue: 'invalid', unreadable: raw };
  const parsed = AppData.safeParse(migrated);
  if (parsed.success) return { data: parsed.data, issue: null };
  return { data: salvage(migrated), issue: 'invalid', unreadable: raw };
}

// ---------------------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------------------

type Versioned = Record<string, unknown> & { version: number };
export type Migration = (data: Versioned) => Versioned;

/**
 * One step per storage version: MIGRATIONS[n] turns version-n data (stored data or a backup)
 * into version n + 1. Add a step with every STORAGE_VERSION bump, so data and backups made by
 * older versions of Dialed still load.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // Version 2 adds current settings (Destiny 2's game-wide settings and each loadout's Config)
  // and checklist progress, all empty at first.
  1: (data) => ({ ...data, inGame: emptyInGame(), configs: {}, progress: {} }),
};

/**
 * Brings stored data or a backup up to `target`, one step at a time. Returns an error message
 * when it can't: no version number, a version newer than this build, or a missing step.
 */
export function migrateToCurrent(
  value: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  target: number = STORAGE_VERSION,
): Versioned | string {
  if (!value || typeof value !== 'object') return 'no data';
  let current = value as Record<string, unknown>;
  const version = current.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return 'no valid version number';
  if (version > target) return 'newer';
  let at = version;
  while (at < target) {
    const step = migrations[at];
    if (!step) return `no migration from version ${at}`;
    current = step({ ...current, version: at });
    at += 1;
    current = { ...current, version: at };
  }
  return current as Versioned;
}

/** Returns false when the data couldn't be written (storage unavailable or full). */
export function saveData(storage: Storage | null, data: AppData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------
// Backup and restore
// ---------------------------------------------------------------------------------------

export function createBackup(data: AppData, now: Date = new Date()): string {
  const backup: BackupFile = {
    app: 'dialed',
    version: STORAGE_VERSION,
    exportedAt: now.toISOString(),
    profile: data.profile,
    loadouts: data.loadouts,
    inGame: data.inGame,
    configs: data.configs,
    progress: data.progress,
  };
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `dialed-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export type RestoreResult = { ok: true; data: AppData; exportedAt: string } | { ok: false; error: string };

/** Validates a backup file's text. Nothing is changed until the caller applies `data`. */
export function parseBackup(text: string): RestoreResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON, so it can’t be a Dialed backup.' };
  }
  if (!json || typeof json !== 'object' || (json as { app?: unknown }).app !== 'dialed') {
    return { ok: false, error: 'That file isn’t a Dialed backup.' };
  }
  const migrated = migrateToCurrent(json);
  if (migrated === 'newer') {
    return { ok: false, error: 'That backup is from a newer version of Dialed. Update Dialed, then restore it.' };
  }
  if (typeof migrated === 'string') {
    return { ok: false, error: 'That backup is from a version of Dialed this build can’t read, so it can’t be restored here.' };
  }
  const parsed = BackupFile.safeParse(migrated);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? ` (${first.path.join('.')})` : '';
    return { ok: false, error: `That backup is damaged and can’t be restored: ${first?.message ?? 'invalid data'}${where}.` };
  }
  const { profile, loadouts, inGame, configs, progress, exportedAt } = parsed.data;
  return { ok: true, data: { version: STORAGE_VERSION, profile, loadouts, inGame, configs, progress }, exportedAt };
}
