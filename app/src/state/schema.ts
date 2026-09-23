/**
 * What Dialed keeps on this phone: the profile (CONCEPT.md §7) and the loadouts.
 * Everything read back from storage or from a backup file is validated with these schemas.
 */
import { z } from 'zod';
import { Platform, WeaponSlot } from '../../../knowledge/schema';

export const STORAGE_VERSION = 1;

export const POLLING_RATES = [125, 250, 500, 1000, 2000, 4000, 8000] as const;
export type PollingRate = (typeof POLLING_RATES)[number];

export const MAX_MOUSE_MODEL_LENGTH = 80;
export const MAX_LOADOUT_NAME_LENGTH = 40;

export const PlayFocus = z.enum(['crucible', 'pve', 'both']);
export const PlayStyle = z.enum(['aggressive', 'balanced', 'precise']);
export const SensitivityPreference = z.enum(['low', 'medium', 'high']);

/** Every field starts unset (null): nothing is assumed about the player. */
export const Profile = z.object({
  platform: Platform.nullable().default(null),
  mouseModel: z.string().max(MAX_MOUSE_MODEL_LENGTH).default(''),
  mouseDpi: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().default(null),
  pollingRate: z.literal(POLLING_RATES).nullable().default(null),
  focus: PlayFocus.nullable().default(null),
  style: PlayStyle.nullable().default(null),
  /** 1 = snappy … 5 = smooth. */
  feel: z.number().int().min(1).max(5).nullable().default(null),
  sensitivity: SensitivityPreference.nullable().default(null),
});
export type Profile = z.infer<typeof Profile>;

/** A weapon archetype id from knowledge/destiny2/weapons.json, or null for an empty slot. */
const ArchetypeRef = z.string().min(1).max(64).nullable();

export const Loadout = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(MAX_LOADOUT_NAME_LENGTH),
    weapons: z.object({ kinetic: ArchetypeRef, energy: ArchetypeRef, power: ArchetypeRef }),
    /** The main weapon's slot. It must hold a weapon. */
    mainSlot: WeaponSlot,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine((l) => l.weapons[l.mainSlot] !== null, {
    message: 'The main weapon must be in a filled slot',
    path: ['mainSlot'],
  });
export type Loadout = z.infer<typeof Loadout>;

const Loadouts = z.array(Loadout).refine((list) => new Set(list.map((l) => l.id)).size === list.length, {
  message: 'Loadout ids must be unique',
});

export const AppData = z.object({
  version: z.literal(STORAGE_VERSION),
  profile: Profile,
  loadouts: Loadouts,
});
export type AppData = z.infer<typeof AppData>;

/** The file written by "Download backup". */
export const BackupFile = z.object({
  app: z.literal('dialed'),
  version: z.literal(STORAGE_VERSION),
  exportedAt: z.iso.datetime(),
  profile: Profile,
  loadouts: Loadouts,
});
export type BackupFile = z.infer<typeof BackupFile>;

export function defaultProfile(): Profile {
  return Profile.parse({});
}

export function defaultData(): AppData {
  return { version: STORAGE_VERSION, profile: defaultProfile(), loadouts: [] };
}
