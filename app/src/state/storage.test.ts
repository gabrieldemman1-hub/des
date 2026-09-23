import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../test/memory-storage';
import { sampleData, sampleLoadout } from '../test/fixtures';
import { STORAGE_VERSION, defaultData, emptyConfig, emptyInGame } from './schema';
import {
  STORAGE_KEY,
  UNREADABLE_KEY,
  backupFileName,
  createBackup,
  getBrowserStorage,
  loadData,
  migrateToCurrent,
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
      outputType: null,
      aimingSources: ['mouse'],
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

  it('keeps every valid profile field when one field is invalid', () => {
    const profile = {
      platform: 'pc',
      mouseModel: 'Test Mouse',
      mouseDpi: 1600,
      pollingRate: 4000,
      focus: 'crucible',
      style: 'precise',
      feel: 9, // out of range
      sensitivity: 'high',
    };
    const storage = new MemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, profile, loadouts: [] }) });
    const result = loadData(storage);
    expect(result.issue).toBe('invalid');
    expect(result.data.profile).toEqual({ ...defaultData().profile, ...profile, feel: null });
  });

  it('clears an output type that does not fit the stored platform', () => {
    const profile = { ...defaultData().profile, platform: 'xbox', outputType: 'pc-dualsense' };
    const storage = new MemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, profile, loadouts: [] }) });
    const result = loadData(storage);
    expect(result.issue).toBe('invalid');
    expect(result.data.profile).toMatchObject({ platform: 'xbox', outputType: 'xbox-controller' });
  });

  it('drops stored loadouts whose id could not be used in a link', () => {
    const good = sampleLoadout({ id: 'abc123' });
    const loadouts = ['new', 'a/b', 'x?y', '..', 'UPPER', ''].map((id) => sampleLoadout({ id }));
    const storage = new MemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, profile: defaultData().profile, loadouts: [good, ...loadouts] }),
    });
    const result = loadData(storage);
    expect(result.issue).toBe('invalid');
    expect(result.data.loadouts).toEqual([good]);
  });

  it('treats data that is not an object, or from a newer version, as invalid', () => {
    for (const raw of ['42', 'null', '"text"', JSON.stringify({ version: STORAGE_VERSION + 1, profile: {}, loadouts: [] })]) {
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

  it('getBrowserStorage still returns storage that can be read but not written (full quota)', () => {
    const data = sampleData({ profile: { ...defaultData().profile, platform: 'pc' }, loadouts: [sampleLoadout()] });
    const full = new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) }, { write: true });
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => full });
    try {
      const storage = getBrowserStorage();
      expect(storage).toBe(full);
      // The saved data stays visible; the failed write is reported when something is saved.
      expect(loadData(storage)).toEqual({ data, issue: null });
      expect(saveData(storage, data)).toBe(false);
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
    expect(json).toMatchObject({ app: 'dialed', version: STORAGE_VERSION, exportedAt: now.toISOString() });
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

  it('rejects a backup from a newer version, and one with no usable version', () => {
    const newer = parseBackup(JSON.stringify({ ...JSON.parse(createBackup(data, now)), version: STORAGE_VERSION + 1 }));
    expect(newer.ok).toBe(false);
    if (!newer.ok) expect(newer.error).toMatch(/newer version of Dialed/);
    for (const version of [0, 1.5, '1', undefined]) {
      const result = parseBackup(JSON.stringify({ ...JSON.parse(createBackup(data, now)), version }));
      expect(result.ok, String(version)).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/can’t read/);
    }
  });

  it('brings older data up to date one version at a time', () => {
    const steps = {
      1: (d: Record<string, unknown> & { version: number }) => ({ ...d, configs: [] }),
      2: (d: Record<string, unknown> & { version: number }) => ({ ...d, renamed: true }),
    };
    expect(migrateToCurrent({ version: 1, profile: {} }, steps, 3)).toEqual({ version: 3, profile: {}, configs: [], renamed: true });
    expect(migrateToCurrent({ version: 2 }, steps, 3)).toEqual({ version: 3, renamed: true });
    expect(migrateToCurrent({ version: 3 }, steps, 3)).toEqual({ version: 3 });
    expect(migrateToCurrent({ version: 1 }, {}, 2)).toBe('no migration from version 1');
    expect(migrateToCurrent({ version: 4 }, steps, 3)).toBe('newer');
    expect(migrateToCurrent(null, steps, 3)).toBe('no data');
  });

  it('rejects a damaged backup and says where', () => {
    const backup = JSON.parse(createBackup(data, now)) as { loadouts: { weapons: Record<string, unknown> }[] };
    backup.loadouts[0]!.weapons.kinetic = null; // the main slot is now empty
    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/damaged.*loadouts\.0\.mainSlot/);
  });

  it('rejects loadout ids that could not be used in a link', () => {
    for (const id of ['new', 'a/b', 'x?y', '..', 'with space', 'x'.repeat(65)]) {
      const backup = JSON.parse(createBackup({ ...data, loadouts: [sampleLoadout({ id })] }, now)) as object;
      const result = parseBackup(JSON.stringify(backup));
      expect(result.ok, id).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/Invalid loadout id.*loadouts\.0\.id/);
    }
  });

  it('rejects duplicate loadout ids', () => {
    const backup = JSON.parse(createBackup({ ...data, loadouts: [sampleLoadout(), sampleLoadout()] }, now)) as object;
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
  });
});

describe('version 2: current settings and checklist progress', () => {
  it('loads version 1 data with empty settings and progress', () => {
    const loadout = sampleLoadout();
    const storage = new MemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, profile: defaultData().profile, loadouts: [loadout] }),
    });
    const { data, issue } = loadData(storage);
    expect(issue).toBeNull();
    expect(data).toEqual({ ...defaultData(), loadouts: [loadout] });
  });

  it('restores a version 1 backup', () => {
    const v1 = { app: 'dialed', version: 1, exportedAt: '2026-09-22T12:00:00.000Z', profile: defaultData().profile, loadouts: [] };
    const result = parseBackup(JSON.stringify(v1));
    expect(result).toEqual({ ok: true, data: defaultData(), exportedAt: v1.exportedAt });
  });

  it('adds empty Destiny 2 settings when bringing version 1 data up to date', () => {
    expect(migrateToCurrent({ version: 1, profile: {}, loadouts: [] })).toEqual({
      version: 2,
      profile: {},
      loadouts: [],
      inGame: emptyInGame(),
      configs: {},
      progress: {},
    });
    expect(emptyInGame()).toEqual({
      movementControls: null,
      buttonLayout: null,
      lookSensitivity: null,
      adsSensitivityModifier: null,
      axialDeadzone: null,
      radialDeadzone: null,
    });
  });

  it('round-trips settings and progress through a backup', () => {
    const data = sampleData({
      loadouts: [sampleLoadout()],
      inGame: { ...emptyInGame(), lookSensitivity: 20, movementControls: 'default' },
      configs: { l1: { ...emptyConfig(), aim: { ...emptyConfig().aim, easing: 40, smoothing: 'standard' } } },
      progress: { 'check:firmware': 'done', 'loadout:l1:aim:lever:tracking:precision': 'problem' },
    });
    const text = createBackup(data);
    expect((JSON.parse(text) as { inGame: unknown }).inGame).toEqual(data.inGame);
    const result = parseBackup(text);
    expect(result.ok && result.data).toEqual(data);
  });

  it('keeps each valid Destiny 2 setting when another is damaged', () => {
    const storage = new MemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: STORAGE_VERSION,
        profile: defaultData().profile,
        loadouts: [],
        inGame: { lookSensitivity: 20, radialDeadzone: 'lots', buttonLayout: 'default', axialDeadzone: -4 },
      }),
    });
    const { data, issue } = loadData(storage);
    expect(issue).toBe('invalid');
    expect(data.inGame).toEqual({ ...emptyInGame(), lookSensitivity: 20, buttonLayout: 'default' });
  });

  it('keeps valid settings and progress when other stored data is damaged', () => {
    const good = sampleLoadout();
    const storage = new MemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: STORAGE_VERSION,
        profile: { platform: 'nope' },
        loadouts: [good],
        configs: { l1: emptyConfig(), gone: emptyConfig(), l2: { aim: { easing: 'high' } } },
        progress: { 'check:firmware': 'done', 'check:dpi': 'maybe' },
      }),
    });
    const { data, issue } = loadData(storage);
    expect(issue).toBe('invalid');
    expect(Object.keys(data.configs)).toEqual(['l1']);
    expect(data.progress).toEqual({ 'check:firmware': 'done' });
  });
});
