/**
 * Reading and writing the phone's copy of the profile and loadouts.
 *
 * All data lives in localStorage under one versioned key. Every access is wrapped in
 * try/catch: unavailable storage, corrupt JSON or invalid data fall back to defaults
 * (keeping whatever is still valid) and report an issue instead of throwing.
 */
import { AppData, BackupFile, Loadout, Profile, STORAGE_VERSION, defaultData } from './schema';

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

/** localStorage, or null when the browser blocks it (private modes, disabled cookies…). */
export function getBrowserStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = `${STORAGE_KEY}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
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
  const profile = Profile.safeParse(record.profile);
  if (profile.success) data.profile = profile.data;
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

  const parsed = AppData.safeParse(json);
  if (parsed.success) return { data: parsed.data, issue: null };
  return { data: salvage(json), issue: 'invalid', unreadable: raw };
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
  if ((json as { version?: unknown }).version !== STORAGE_VERSION) {
    return { ok: false, error: 'That backup is from a different version of Dialed and can’t be restored here.' };
  }
  const parsed = BackupFile.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? ` (${first.path.join('.')})` : '';
    return { ok: false, error: `That backup is damaged and can’t be restored: ${first?.message ?? 'invalid data'}${where}.` };
  }
  const { profile, loadouts, exportedAt } = parsed.data;
  return { ok: true, data: { version: STORAGE_VERSION, profile, loadouts }, exportedAt };
}
