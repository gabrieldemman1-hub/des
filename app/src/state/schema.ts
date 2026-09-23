/**
 * What Dialed keeps on this phone: the profile (CONCEPT.md §7), the loadouts, the player's
 * current settings for each loadout (the starting point for Tune my config), and checklist
 * progress. Everything read back from storage or from a backup file is validated with these
 * schemas.
 */
import { z } from 'zod';
import { AimingSource, OUTPUT_TYPES_BY_PLATFORM, OutputType, Platform, WeaponSlot } from '../../../knowledge/schema';

export const STORAGE_VERSION = 2;

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

// ---------------------------------------------------------------------------------------
// Current settings (Tune my config)
// ---------------------------------------------------------------------------------------

/** A number the player typed in, or null when left blank. Bounds only reject nonsense. */
const Num = (min: number, max: number) => z.number().min(min).max(max).nullable().default(null);

/**
 * The player's current settings for one loadout's Config, as they see them in Destiny 2 and
 * XIM MATRIX Manager. Every field is optional: Tune my config works with whatever is filled in.
 */
export const CurrentConfig = z.object({
  inGame: z
    .object({
      movementControls: z.enum(['default', 'other']).nullable().default(null),
      buttonLayout: z.enum(['default', 'other']).nullable().default(null),
      lookSensitivity: Num(0, 1000),
      adsSensitivityModifier: Num(0, 100),
      axialDeadzone: Num(0, 100),
      radialDeadzone: Num(0, 100),
    })
    .default({
      movementControls: null,
      buttonLayout: null,
      lookSensitivity: null,
      adsSensitivityModifier: null,
      axialDeadzone: null,
      radialDeadzone: null,
    }),
  matrix: z
    .object({
      /** The DPI entered in the Config (it must match the mouse). */
      configDpi: z.number().int().positive().max(1_000_000).nullable().default(null),
      syncMethod: z.enum(['standard', 'custom', 'manual']).nullable().default(null),
      /** Manager shows a warning on the Config when its Smart Translator is out of date. */
      translatorWarning: z.boolean().nullable().default(null),
    })
    .default({ configDpi: null, syncMethod: null, translatorWarning: null }),
  aim: z
    .object({
      /** Mouse sensitivity in cm/360 (lower is faster). */
      hipSensitivity: Num(0, 10_000),
      adsSensitivity: Num(0, 10_000),
      adsInheritance: z.enum(['inherit-all', 'sensitivity-only', 'inherit-nothing']).nullable().default(null),
      /** A preset (its name in presetName), custom Standard, custom Classic, or smoothing off. */
      smoothing: z.enum(['preset', 'standard', 'classic', 'off']).nullable().default(null),
      presetName: z.string().max(40).default(''),
      precision: Num(0, 100),
      response: Num(0, 100),
      easing: Num(0, 100),
      smooth: Num(0, 1000),
      decay: Num(0, 1000),
      synch: Num(0, 1000),
      aimingCurve: z.enum(['linear', 'custom']).nullable().default(null),
      yScale: Num(0, 1000),
      quantization: z.boolean().nullable().default(null),
      quantizationMagnitude: Num(0, 100),
      quantizationAngle: Num(0, 100),
      velocityMapping: z.enum(['standard', 'other']).nullable().default(null),
    })
    .default({
      hipSensitivity: null,
      adsSensitivity: null,
      adsInheritance: null,
      smoothing: null,
      presetName: '',
      precision: null,
      response: null,
      easing: null,
      smooth: null,
      decay: null,
      synch: null,
      aimingCurve: null,
      yScale: null,
      quantization: null,
      quantizationMagnitude: null,
      quantizationAngle: null,
      velocityMapping: null,
    }),
  updatedAt: z.iso.datetime().nullable().default(null),
});
export type CurrentConfig = z.infer<typeof CurrentConfig>;

export function emptyConfig(): CurrentConfig {
  return CurrentConfig.parse({});
}

/** Current settings, one per loadout id. */
const Configs = z.record(LoadoutId, CurrentConfig);

/**
 * Checklist progress for Build my config and Troubleshoot by feel, by item id (see
 * `progressKey` in progress.ts). 'done': checked and fine. 'problem': checked and needs fixing.
 */
export const ProgressState = z.enum(['done', 'problem']);
export type ProgressState = z.infer<typeof ProgressState>;
const Progress = z.record(z.string().min(1).max(200), ProgressState);

export const AppData = z.object({
  version: z.literal(STORAGE_VERSION),
  profile: Profile,
  loadouts: Loadouts,
  configs: Configs.default({}),
  progress: Progress.default({}),
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
  configs: Configs.default({}),
  progress: Progress.default({}),
});
export type BackupFile = z.infer<typeof BackupFile>;

export function defaultProfile(): Profile {
  return Profile.parse({});
}

export function defaultData(): AppData {
  return { version: STORAGE_VERSION, profile: defaultProfile(), loadouts: [], configs: {}, progress: {} };
}
