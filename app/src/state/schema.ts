/**
 * What Dialed keeps on this phone: the profile (CONCEPT.md §7) and the loadouts.
 * Everything read back from storage or from a backup file is validated with these schemas.
 *
 * Not stored yet: the player's current Config values (CONCEPT.md §7 "Current config", the
 * starting point for Flow B, including the smoothing mode that decides whether weapon-aware
 * directions apply). They arrive with Flow B as `configs` (one per loadout), together with a
 * STORAGE_VERSION bump and a step in `migrateBackup` (storage.ts), so older backups still
 * restore.
 */
import { z } from 'zod';
import { AimingSource, OUTPUT_TYPES_BY_PLATFORM, OutputType, Platform, WeaponSlot } from '../../../knowledge/schema';

export const STORAGE_VERSION = 1;

export const POLLING_RATES = [125, 250, 500, 1000, 2000, 4000, 8000] as const;
export type PollingRate = (typeof POLLING_RATES)[number];

export const MAX_MOUSE_MODEL_LENGTH = 80;
export const MAX_LOADOUT_NAME_LENGTH = 40;

export const PlayFocus = z.enum(['crucible', 'pve', 'both']);
export const PlayStyle = z.enum(['aggressive', 'balanced', 'precise']);
export const SensitivityPreference = z.enum(['low', 'medium', 'high']);

/** True when the output type is one that platform offers (or not set). */
export function outputTypeFits(platform: Platform | null, outputType: OutputType | null): boolean {
  if (outputType === null) return true;
  return platform !== null && OUTPUT_TYPES_BY_PLATFORM[platform].includes(outputType);
}

/**
 * Every field starts unset (null), so nothing is assumed about the player, except the aiming
 * sources: Dialed is built around mouse aim, so they start as mouse only.
 */
export const Profile = z
  .object({
    platform: Platform.nullable().default(null),
    /** Controller output only. Xbox has one output type; on PC the player picks one. */
    outputType: OutputType.nullable().default(null),
    /** What the player aims with: decides whether gyro-only guidance applies. */
    aimingSources: z
      .array(AimingSource)
      .min(1)
      .refine((list) => new Set(list).size === list.length, 'Aiming sources must be unique')
      .default(['mouse']),
    mouseModel: z.string().max(MAX_MOUSE_MODEL_LENGTH).default(''),
    mouseDpi: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().default(null),
    pollingRate: z.literal(POLLING_RATES).nullable().default(null),
    focus: PlayFocus.nullable().default(null),
    style: PlayStyle.nullable().default(null),
    /** 1 = snappy … 5 = smooth. */
    feel: z.number().int().min(1).max(5).nullable().default(null),
    sensitivity: SensitivityPreference.nullable().default(null),
  })
  .refine((p) => outputTypeFits(p.platform, p.outputType), {
    message: 'The output type must be one the platform offers',
    path: ['outputType'],
  });
export type Profile = z.infer<typeof Profile>;

/**
 * Keeps the output type consistent with the platform: Xbox has exactly one output type, and
 * one that doesn't fit the platform is cleared. Apply before saving a changed profile.
 */
export function normalizeProfile<T extends Pick<Profile, 'platform' | 'outputType'>>(profile: T): T {
  if (profile.platform === 'xbox') return { ...profile, outputType: 'xbox-controller' };
  if (!outputTypeFits(profile.platform, profile.outputType)) return { ...profile, outputType: null };
  return profile;
}

/** A weapon archetype id from knowledge/destiny2/weapons.json, or null for an empty slot. */
const ArchetypeRef = z.string().min(1).max(64).nullable();

/**
 * A loadout id, as `newLoadoutId` makes them. It becomes part of the loadout's URL, so it is
 * limited to characters that are safe there, and can't be "new" (the create screen's path).
 */
export const LoadoutId = z
  .string()
  .regex(/^[a-z0-9]{1,64}$/, 'Invalid loadout id')
  .refine((id) => id !== 'new', 'Invalid loadout id');

export const Loadout = z
  .object({
    id: LoadoutId,
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

/**
 * The file written by "Download backup", in the current version. Older versions are brought
 * up to date by `migrateBackup` (storage.ts) before they are validated with this.
 */
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
