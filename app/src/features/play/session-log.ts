/**
 * The death tally for one playing session (Play, "Tag the death" and "Count the tags"). It is
 * kept apart from the app's main data: it is a scratch count that starts again every session,
 * so it has no place in a backup. Every access is wrapped in try/catch, like storage.ts.
 *
 * One store per storage, shared by every component on the page (the tally buttons and the
 * review's "next focus" read the same count), read from the phone on first use and saved on
 * every change.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { getBrowserStorage } from '../../state/storage';

export const SESSION_KEY = 'dialed:v1:play-session';

const SessionLog = z.object({
  startedAt: z.iso.datetime(),
  /** Tallies by death cause id (knowledge/destiny2/play.json). */
  counts: z.record(z.string().min(1).max(64), z.number().int().min(0).max(100_000)),
});
export type SessionLog = z.infer<typeof SessionLog>;

export function newSession(now = new Date()): SessionLog {
  return { startedAt: now.toISOString(), counts: {} };
}

/** The saved session, or a new one when nothing valid is saved. */
export function readSession(storage: Storage | null): SessionLog {
  if (!storage) return newSession();
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (raw === null) return newSession();
    const parsed = SessionLog.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : newSession();
  } catch {
    return newSession();
  }
}

/** True when the session reached storage. */
export function writeSession(storage: Storage | null, log: SessionLog): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(log));
    return true;
  } catch {
    return false;
  }
}

export function totalDeaths(log: SessionLog): number {
  return Object.values(log.counts).reduce((sum, n) => sum + n, 0);
}

/** The cause ids with the most tallies (several when tied), in tally order; empty with no tallies. */
export function topCauses(log: SessionLog): string[] {
  const max = Math.max(0, ...Object.values(log.counts));
  if (max === 0) return [];
  return Object.entries(log.counts)
    .filter(([, n]) => n === max)
    .map(([id]) => id);
}

export function tallied(log: SessionLog, causeId: string): SessionLog {
  return { ...log, counts: { ...log.counts, [causeId]: (log.counts[causeId] ?? 0) + 1 } };
}

export function untallied(log: SessionLog, causeId: string): SessionLog {
  const count = log.counts[causeId] ?? 0;
  if (count === 0) return log;
  const counts = { ...log.counts };
  if (count === 1) delete counts[causeId];
  else counts[causeId] = count - 1;
  return { ...log, counts };
}

// ---------------------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------------------

interface SessionState {
  log: SessionLog;
  /** False when the latest change couldn't be saved (the count still shows until the page closes). */
  saved: boolean;
}

interface SessionStore {
  state: SessionState;
  listeners: Set<() => void>;
}

const NO_STORAGE = Symbol('no storage');
const stores = new Map<Storage | typeof NO_STORAGE, SessionStore>();

function storeFor(storage: Storage | null): SessionStore {
  const key = storage ?? NO_STORAGE;
  let store = stores.get(key);
  if (!store) {
    store = { state: { log: readSession(storage), saved: true }, listeners: new Set() };
    stores.set(key, store);
  }
  return store;
}

function update(storage: Storage | null, next: SessionLog): void {
  const store = storeFor(storage);
  store.state = { log: next, saved: writeSession(storage, next) };
  for (const listener of store.listeners) listener();
}

/** Forgets every store, so the next use reads the storage again. For tests. */
export function clearSessionStores(): void {
  stores.clear();
}

export interface SessionApi extends SessionState {
  tally: (causeId: string) => void;
  untally: (causeId: string) => void;
  reset: () => void;
}

/** The session tally, shared by every component that uses it. */
export function useSessionLog(storage: Storage | null = getBrowserStorage()): SessionApi {
  const subscribe = useCallback(
    (listener: () => void) => {
      const store = storeFor(storage);
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    [storage],
  );
  const state = useSyncExternalStore(subscribe, () => storeFor(storage).state);

  const tally = useCallback((causeId: string) => update(storage, tallied(storeFor(storage).state.log, causeId)), [storage]);
  const untally = useCallback(
    (causeId: string) => update(storage, untallied(storeFor(storage).state.log, causeId)),
    [storage],
  );
  const reset = useCallback(() => update(storage, newSession()), [storage]);

  return { ...state, tally, untally, reset };
}
