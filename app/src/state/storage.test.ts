import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../test/memory-storage';
import { sampleData, sampleLoadout } from '../test/fixtures';
import { defaultData } from './schema';
import {
  STORAGE_KEY,
  UNREADABLE_KEY,
  backupFileName,
  createBackup,
  getBrowserStorage,
  loadData,
  parseBackup,
  saveData,
  setAsideUnreadable,
} from './storage';

describe('loadData / saveData', () => {
  it('starts from defaults when nothing is stored', () => {
    const result = loadData(new MemoryStorage());
    expect(result).toEqual({ data: defaultData(), issue: null });
    expect(result.data.profile).toEqual({
      platform: null,
      mouseModel: '',
      mouseDpi: null,
      pollingRate: null,
      focus: null,
      style: null,
      feel: null,
      sensitivity: null,
    });
  });

  it('round-trips data under one versioned key', () => {
    const storage = new MemoryStorage();
    const data = sampleData({
      profile: { ...defaultData().profile, platform: 'pc', mouseDpi: 1600, pollingRate: 4000, feel: 2 },
      loadouts: [sampleLoadout()],
    });
    expect(saveData(storage, data)).toBe(true);
    expect(STORAGE_KEY).toBe('dialed:v1');
    expect(storage.json(STORAGE_KEY)).toEqual(data);
    expect(loadData(storage)).toEqual({ data, issue: null });
  });

  it('fills in fields that older saved data is missing', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, profile: { platform: 'xbox' }, loadouts: [] }),
    });
    const { data, issue } = loadData(storage);
    expect(issue).toBeNull();
    expect(data.profile.platform).toBe('xbox');
    expect(data.profile.pollingRate).toBeNull();
  });

  it('falls back to defaults on corrupt JSON and keeps a copy of it', () => {
    const raw = '{"version":1,"prof';
    const storage = new MemoryStorage({ [STORAGE_KEY]: raw });
    const result = loadData(storage);
    expect(result).toEqual({ data: defaultData(), issue: 'corrupt', unreadable: raw });
    expect(storage.getItem(STORAGE_KEY)).toBe(raw); // loading changes nothing

    setAsideUnreadable(storage, result);
    expect(storage.getItem(UNREADABLE_KEY)).toBe(raw);
    // Reported once: the next launch reads the recovered data cleanly.
    expect(loadData(storage)).toEqual({ data: defaultData(), issue: null });
  });

  it('leaves unreadable data in place if it cannot be copied aside', () => {
    const storage = new MemoryStorage({ [STORAGE_KEY]: '{oops' }, { write: true });
    const result = loadData(storage);
    expect(result.issue).toBe('corrupt');
    setAsideUnreadable(storage, result);
    expect(storage.getItem(STORAGE_KEY)).toBe('{oops');
  });

  it('reports unavailable storage without throwing', () => {
    expect(loadData(null)).toEqual({ data: defaultData(), issue: 'unavailable' });
    expect(loadData(new MemoryStorage({}, { read: true }))).toEqual({ data: defaultData(), issue: 'unavailable' });
  });

  it('returns false instead of throwing when a write fails', () => {
    expect(saveData(new MemoryStorage({}, { write: true }), defaultData())).toBe(false);
    expect(saveData(null, defaultData())).toBe(false);
  });

  it('keeps the valid parts of schema-invalid data', () => {
    const good = sampleLoadout({ id: 'good' });
    const badMain = sampleLoadout({ id: 'bad', weapons: { kinetic: null, energy: 'shotgun', power: null } });
    const stored = {
      version: 1,
      profile: { platform: 'switch', mouseDpi: -5 },
      loadouts: [good, badMain, { id: 'junk' }, good],
    };
    const storage = new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(stored) });
    const result = loadData(storage);
    expect(result.issue).toBe('invalid');
    expect(result.data.profile).toEqual(defaultData().profile);
    expect(result.data.loadouts).toEqual([good]);

    setAsideUnreadable(storage, result);
    expect(storage.getItem(UNREADABLE_KEY)).toBe(JSON.stringify(stored));
    expect(loadData(storage)).toEqual({ data: result.data, issue: null });
  });

  it('treats data that is not an object, or from another version, as invalid', () => {
    for (const raw of ['42', 'null', '"text"', JSON.stringify({ version: 2, profile: {}, loadouts: [] })]) {
      const { data, issue } = loadData(new MemoryStorage({ [STORAGE_KEY]: raw }));
      expect(issue).toBe('invalid');
      expect(data).toEqual(defaultData());
    }
  });

  it('getBrowserStorage returns null when localStorage throws', () => {
    expect(getBrowserStorage()).toBe(window.localStorage);
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    try {
      expect(getBrowserStorage()).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});

describe('backup and restore', () => {
  const now = new Date('2026-09-22T12:34:56.000Z');
  const data = sampleData({
    profile: { ...defaultData().profile, platform: 'xbox', mouseModel: 'Test Mouse', mouseDpi: 800 },
    loadouts: [sampleLoadout()],
  });

  it('writes a JSON backup that restores to the same data', () => {
    const text = createBackup(data, now);
    const json = JSON.parse(text) as Record<string, unknown>;
    expect(json).toMatchObject({ app: 'dialed', version: 1, exportedAt: now.toISOString() });
    expect(parseBackup(text)).toEqual({ ok: true, data, exportedAt: now.toISOString() });
  });

  it('names the file after the date', () => {
    expect(backupFileName(new Date(2026, 8, 5))).toBe('dialed-backup-2026-09-05.json');
  });

  it('rejects text that is not JSON', () => {
    const result = parseBackup('not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/isn’t valid JSON/);
  });

  it('rejects JSON that is not a Dialed backup', () => {
    for (const text of ['{}', '[]', '42', JSON.stringify({ app: 'other', version: 1 })]) {
      const result = parseBackup(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('That file isn’t a Dialed backup.');
    }
  });

  it('rejects a backup from another version', () => {
    const text = JSON.stringify({ ...JSON.parse(createBackup(data, now)), version: 2 });
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/different version/);
  });

  it('rejects a damaged backup and says where', () => {
    const backup = JSON.parse(createBackup(data, now)) as { loadouts: { weapons: Record<string, unknown> }[] };
    backup.loadouts[0]!.weapons.kinetic = null; // the main slot is now empty
    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/damaged.*loadouts\.0\.mainSlot/);
  });

  it('rejects duplicate loadout ids', () => {
    const backup = JSON.parse(createBackup({ ...data, loadouts: [sampleLoadout(), sampleLoadout()] }, now)) as object;
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
  });
});
