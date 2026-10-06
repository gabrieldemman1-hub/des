import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../test/memory-storage';
import {
  SESSION_KEY,
  clearSessionStores,
  newSession,
  readSession,
  tallied,
  topCauses,
  totalDeaths,
  untallied,
  useSessionLog,
  writeSession,
} from './session-log';

describe('session log', () => {
  beforeEach(() => clearSessionStores());

  it('starts a new session when nothing valid is saved', () => {
    expect(readSession(null).counts).toEqual({});
    expect(readSession(new MemoryStorage()).counts).toEqual({});
    expect(readSession(new MemoryStorage({ [SESSION_KEY]: '{oops' })).counts).toEqual({});
    expect(readSession(new MemoryStorage({ [SESSION_KEY]: JSON.stringify({ counts: { x: -1 } }) })).counts).toEqual({});
  });

  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const log = tallied(tallied(newSession(), 'alone'), 'alone');
    expect(writeSession(storage, log)).toBe(true);
    expect(readSession(storage)).toEqual(log);
    expect(writeSession(null, log)).toBe(false);
    expect(writeSession(new MemoryStorage({}, { write: true }), log)).toBe(false);
  });

  it('counts, uncounts and finds the top causes', () => {
    let log = newSession();
    expect(totalDeaths(log)).toBe(0);
    expect(topCauses(log)).toEqual([]);
    log = tallied(tallied(tallied(log, 'alone'), 'wrong-band'), 'alone');
    expect(totalDeaths(log)).toBe(3);
    expect(topCauses(log)).toEqual(['alone']);
    log = untallied(log, 'alone');
    expect(topCauses(log)).toEqual(['alone', 'wrong-band']);
    log = untallied(untallied(log, 'alone'), 'alone');
    expect(log.counts).toEqual({ 'wrong-band': 1 });
    expect(untallied(log, 'never')).toBe(log);
  });

  it('shares one store between hooks on the same storage, and saves every change', () => {
    const storage = new MemoryStorage();
    const a = renderHook(() => useSessionLog(storage));
    const b = renderHook(() => useSessionLog(storage));
    act(() => a.result.current.tally('overexposed'));
    expect(b.result.current.log.counts).toEqual({ overexposed: 1 });
    expect(readSession(storage).counts).toEqual({ overexposed: 1 });
    act(() => b.result.current.reset());
    expect(a.result.current.log.counts).toEqual({});
    expect(a.result.current.saved).toBe(true);
  });

  it('keeps counting when the phone cannot save, and says so', () => {
    const { result } = renderHook(() => useSessionLog(null));
    act(() => result.current.tally('alone'));
    expect(result.current.log.counts).toEqual({ alone: 1 });
    expect(result.current.saved).toBe(false);
  });
});
