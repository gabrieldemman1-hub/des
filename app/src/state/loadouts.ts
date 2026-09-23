/**
 * Loadout editing rules, kept free of React so they can be tested directly.
 *
 * A loadout has a name, an optional weapon archetype per slot, and a main slot that must
 * hold a weapon. When the main weapon's slot is cleared, the main weapon becomes unset,
 * unless exactly one weapon is left, which then becomes the main weapon.
 */
import type { WeaponSlot } from '../../../knowledge/index';
import { MAX_LOADOUT_NAME_LENGTH, type Loadout } from './schema';

export const SLOTS: readonly WeaponSlot[] = ['kinetic', 'energy', 'power'];

export type SlotWeapons = Record<WeaponSlot, string | null>;

export interface LoadoutDraft {
  name: string;
  weapons: SlotWeapons;
  mainSlot: WeaponSlot | null;
}

export type DraftErrors = Partial<Record<'name' | 'weapons' | 'mainSlot', string>>;

export type DraftResult<T> = { ok: true; value: T } | { ok: false; errors: DraftErrors };

export function emptyDraft(): LoadoutDraft {
  return { name: '', weapons: { kinetic: null, energy: null, power: null }, mainSlot: null };
}

export function draftFromLoadout(loadout: Loadout): LoadoutDraft {
  return { name: loadout.name, weapons: { ...loadout.weapons }, mainSlot: loadout.mainSlot };
}

export function filledSlots(weapons: SlotWeapons): WeaponSlot[] {
  return SLOTS.filter((slot) => weapons[slot] !== null);
}

export function setDraftName(draft: LoadoutDraft, name: string): LoadoutDraft {
  return { ...draft, name };
}

/** Sets or clears one slot, keeping the main slot valid. */
export function setDraftWeapon(draft: LoadoutDraft, slot: WeaponSlot, archetypeId: string | null): LoadoutDraft {
  const weapons = { ...draft.weapons, [slot]: archetypeId };
  const filled = filledSlots(weapons);
  let mainSlot = draft.mainSlot;
  if (mainSlot !== null && weapons[mainSlot] === null) {
    // The main weapon was cleared.
    mainSlot = filled.length === 1 ? (filled[0] ?? null) : null;
  } else if (mainSlot === null && filled.length === 1) {
    // The first weapon picked becomes the main one.
    mainSlot = filled[0] ?? null;
  }
  return { ...draft, weapons, mainSlot };
}

/** Makes `slot` the main weapon. Ignored if that slot is empty. */
export function setDraftMainSlot(draft: LoadoutDraft, slot: WeaponSlot): LoadoutDraft {
  return draft.weapons[slot] === null ? draft : { ...draft, mainSlot: slot };
}

export interface ValidDraft {
  name: string;
  weapons: SlotWeapons;
  mainSlot: WeaponSlot;
}

export function validateDraft(draft: LoadoutDraft): DraftResult<ValidDraft> {
  const errors: DraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Give the loadout a name.';
  else if (name.length > MAX_LOADOUT_NAME_LENGTH) {
    errors.name = `Keep the name to ${MAX_LOADOUT_NAME_LENGTH} characters or fewer.`;
  }

  const filled = filledSlots(draft.weapons);
  if (filled.length === 0) errors.weapons = 'Pick at least one weapon.';
  else if (draft.mainSlot === null || draft.weapons[draft.mainSlot] === null) {
    errors.mainSlot = 'Choose which weapon is the main one.';
  }

  if (Object.keys(errors).length > 0 || draft.mainSlot === null) return { ok: false, errors };
  return { ok: true, value: { name, weapons: { ...draft.weapons }, mainSlot: draft.mainSlot } };
}

/** A random id that works outside secure contexts too (crypto.randomUUID needs HTTPS). */
export function newLoadoutId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ChangeOptions {
  now?: Date;
  id?: string;
}

export function createLoadout(
  list: readonly Loadout[],
  draft: LoadoutDraft,
  { now = new Date(), id = newLoadoutId() }: ChangeOptions = {},
): DraftResult<{ list: Loadout[]; loadout: Loadout }> {
  const valid = validateDraft(draft);
  if (!valid.ok) return valid;
  const stamp = now.toISOString();
  const loadout: Loadout = { id, ...valid.value, createdAt: stamp, updatedAt: stamp };
  return { ok: true, value: { list: [...list, loadout], loadout } };
}

export function updateLoadout(
  list: readonly Loadout[],
  id: string,
  draft: LoadoutDraft,
  { now = new Date() }: ChangeOptions = {},
): DraftResult<{ list: Loadout[]; loadout: Loadout }> {
  const existing = list.find((l) => l.id === id);
  if (!existing) return { ok: false, errors: { name: 'This loadout no longer exists.' } };
  const valid = validateDraft(draft);
  if (!valid.ok) return valid;
  const loadout: Loadout = { ...existing, ...valid.value, updatedAt: now.toISOString() };
  return { ok: true, value: { list: list.map((l) => (l.id === id ? loadout : l)), loadout } };
}

export function deleteLoadout(list: readonly Loadout[], id: string): Loadout[] {
  return list.filter((l) => l.id !== id);
}
