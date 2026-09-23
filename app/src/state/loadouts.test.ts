import { describe, expect, it } from 'vitest';
import { sampleLoadout } from '../test/fixtures';
import {
  createLoadout,
  deleteLoadout,
  draftFromLoadout,
  emptyDraft,
  newLoadoutId,
  setDraftMainSlot,
  setDraftName,
  setDraftWeapon,
  updateLoadout,
  validateDraft,
  type LoadoutDraft,
} from './loadouts';
import { Loadout } from './schema';

const now = new Date('2026-09-22T12:00:00.000Z');

type DraftParts = Omit<Partial<LoadoutDraft>, 'weapons'> & { weapons?: Partial<LoadoutDraft['weapons']> };

function draft(parts: DraftParts = {}): LoadoutDraft {
  const base = emptyDraft();
  return { ...base, ...parts, weapons: { ...base.weapons, ...parts.weapons } };
}

describe('loadout drafts', () => {
  it('makes the first weapon picked the main weapon', () => {
    const d = setDraftWeapon(emptyDraft(), 'energy', 'hand-cannon');
    expect(d.mainSlot).toBe('energy');
    const d2 = setDraftWeapon(d, 'kinetic', 'pulse-rifle');
    expect(d2.mainSlot).toBe('energy');
  });

  it('only lets a filled slot be the main weapon', () => {
    const d = draft({ weapons: { kinetic: 'pulse-rifle' }, mainSlot: 'kinetic' });
    expect(setDraftMainSlot(d, 'power')).toBe(d);
    const withPower = setDraftWeapon(d, 'power', 'shotgun');
    expect(setDraftMainSlot(withPower, 'power').mainSlot).toBe('power');
  });

  it('clearing the main weapon moves "main" to the only weapon left', () => {
    const d = draft({ weapons: { kinetic: 'pulse-rifle', energy: 'shotgun' }, mainSlot: 'kinetic' });
    const cleared = setDraftWeapon(d, 'kinetic', null);
    expect(cleared.weapons.kinetic).toBeNull();
    expect(cleared.mainSlot).toBe('energy');
  });

  it('clearing the main weapon unsets "main" when two or more weapons are left', () => {
    const d = draft({
      name: 'Three',
      weapons: { kinetic: 'pulse-rifle', energy: 'shotgun', power: 'hand-cannon' },
      mainSlot: 'energy',
    });
    const cleared = setDraftWeapon(d, 'energy', null);
    expect(cleared.mainSlot).toBeNull();
    expect(validateDraft(cleared)).toEqual({ ok: false, errors: { mainSlot: 'Choose which weapon is the main one.' } });
  });

  it('clearing the last weapon leaves nothing to be main', () => {
    const d = setDraftWeapon(draft({ weapons: { power: 'shotgun' }, mainSlot: 'power' }), 'power', null);
    expect(d.mainSlot).toBeNull();
    expect(validateDraft(setDraftName(d, 'x'))).toEqual({ ok: false, errors: { weapons: 'Pick at least one weapon.' } });
  });

  it('clearing a slot that is not main keeps the main weapon', () => {
    const d = draft({ weapons: { kinetic: 'pulse-rifle', energy: 'shotgun' }, mainSlot: 'kinetic' });
    expect(setDraftWeapon(d, 'energy', null).mainSlot).toBe('kinetic');
  });

  it('validates the name', () => {
    const ok = draft({ name: 'x', weapons: { kinetic: 'pulse-rifle' }, mainSlot: 'kinetic' });
    expect(validateDraft({ ...ok, name: '   ' })).toEqual({ ok: false, errors: { name: 'Give the loadout a name.' } });
    expect(validateDraft({ ...ok, name: 'x'.repeat(41) }).ok).toBe(false);
    expect(validateDraft({ ...ok, name: '  Trimmed  ' })).toMatchObject({ ok: true, value: { name: 'Trimmed' } });
  });

  it('rejects a main slot that is empty', () => {
    const d = draft({ name: 'x', weapons: { kinetic: 'pulse-rifle' }, mainSlot: 'energy' });
    expect(validateDraft(d)).toEqual({ ok: false, errors: { mainSlot: 'Choose which weapon is the main one.' } });
  });
});

describe('loadout list changes', () => {
  const valid = draft({ name: 'Peek', weapons: { kinetic: 'hand-cannon', power: 'shotgun' }, mainSlot: 'kinetic' });

  it('creates a loadout that passes the storage schema', () => {
    const result = createLoadout([], valid, { now, id: 'abc' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.loadout).toEqual({
      id: 'abc',
      name: 'Peek',
      weapons: { kinetic: 'hand-cannon', energy: null, power: 'shotgun' },
      mainSlot: 'kinetic',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    expect(Loadout.safeParse(result.value.loadout).success).toBe(true);
    expect(result.value.list).toEqual([result.value.loadout]);
  });

  it('does not create an invalid loadout', () => {
    const result = createLoadout([], emptyDraft(), { now });
    expect(result).toEqual({
      ok: false,
      errors: { name: 'Give the loadout a name.', weapons: 'Pick at least one weapon.' },
    });
  });

  it('edits a loadout in place and keeps createdAt', () => {
    const existing = sampleLoadout();
    const other = sampleLoadout({ id: 'l2', name: 'Other' });
    const edited = setDraftMainSlot(setDraftWeapon(draftFromLoadout(existing), 'power', 'scout-rifle'), 'power');
    const result = updateLoadout([existing, other], existing.id, edited, { now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.list.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(result.value.loadout).toMatchObject({
      id: 'l1',
      mainSlot: 'power',
      weapons: { kinetic: 'pulse-rifle', energy: 'shotgun', power: 'scout-rifle' },
      createdAt: existing.createdAt,
      updatedAt: now.toISOString(),
    });
  });

  it('refuses to edit a loadout that does not exist, or with an invalid draft', () => {
    expect(updateLoadout([], 'missing', valid, { now }).ok).toBe(false);
    const cleared = setDraftWeapon(setDraftWeapon(valid, 'kinetic', null), 'power', null);
    expect(updateLoadout([sampleLoadout()], 'l1', cleared, { now }).ok).toBe(false);
  });

  it('deletes by id', () => {
    const list = [sampleLoadout(), sampleLoadout({ id: 'l2' })];
    expect(deleteLoadout(list, 'l1').map((l) => l.id)).toEqual(['l2']);
    expect(deleteLoadout(list, 'nope')).toEqual(list);
  });

  it('generates distinct ids without crypto.randomUUID', () => {
    const ids = new Set(Array.from({ length: 50 }, newLoadoutId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{24}$/);
  });
});
