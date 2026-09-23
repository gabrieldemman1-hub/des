/**
 * How the player's current settings (entered in Tune my config) read, wherever they are shown:
 * Tune my config, Build my config, the config sheet and its plain-text copy. One module, so
 * they always agree.
 *
 * Only Destiny 2's required settings have a value to compare against. Aim settings are shown
 * as they are, since the knowledge base gives directions, not numbers: a value is never called
 * too high or too low.
 */
import { compareRequiredSetting } from './required-settings';
import type { CurrentConfig, InGameSettings } from './schema';

type Aim = CurrentConfig['aim'];
export type SmoothingMode = NonNullable<Aim['smoothing']>;

export const SMOOTHING_LABELS: Readonly<Record<SmoothingMode, string>> = {
  preset: 'Preset',
  standard: 'Custom Standard',
  classic: 'Custom Classic',
  off: 'Off',
};

export const SYNC_LABELS = { standard: 'Standard', custom: 'Custom', manual: 'Manual' } as const;
export const CURVE_LABELS = { linear: 'Linear', custom: 'Custom' } as const;
export const VELOCITY_LABELS = { standard: 'Standard', other: 'Not Standard' } as const;

/** The settings of custom Standard smoothing, which the aim-style directions assume. */
export const STANDARD_SMOOTHING_TERMS: ReadonlySet<string> = new Set(['precision', 'response', 'easing', 'stability']);
/** The settings of custom Classic smoothing. */
export const CLASSIC_SMOOTHING_TERMS: ReadonlySet<string> = new Set(['smooth', 'decay', 'synch']);

/** True when the player has entered at least one setting in this loadout's Config. */
export function hasConfigValues(config: CurrentConfig | undefined): boolean {
  if (!config) return false;
  return [config.matrix, config.aim].some((group) =>
    Object.values(group).some((value) => value !== null && value !== ''),
  );
}

function num(value: number | null): string | null {
  return value === null ? null : String(value);
}

function named(parts: readonly [string, number | null][]): string[] {
  return parts.flatMap(([name, value]) => (value === null ? [] : [`${name} ${value}`]));
}

/** "Hip 30 cm/360 · ADS 28 cm/360", or null when neither is entered. */
export function describeSensitivity(aim: Aim): string | null {
  const parts = [
    aim.hipSensitivity === null ? null : `Hip ${aim.hipSensitivity} cm/360`,
    aim.adsSensitivity === null ? null : `ADS ${aim.adsSensitivity} cm/360`,
  ].filter((p) => p !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * The smoothing mode, with the values that belong to it: "Custom Standard (Precision 40)",
 * "Custom Classic (Smooth 10, Decay 5)", "Preset: Fast" or "Off". Null when not entered.
 */
export function describeSmoothing(aim: Aim): string | null {
  if (aim.smoothing === null) return null;
  const label = SMOOTHING_LABELS[aim.smoothing];
  if (aim.smoothing === 'preset') {
    const preset = aim.presetName.trim();
    return preset ? `${label}: ${preset}` : label;
  }
  const values =
    aim.smoothing === 'standard'
      ? named([
          ['Precision', aim.precision],
          ['Response', aim.response],
          ['Easing', aim.easing],
        ])
      : aim.smoothing === 'classic'
        ? named([
            ['Smooth', aim.smooth],
            ['Decay', aim.decay],
            ['Synch', aim.synch],
          ])
        : [];
  return values.length > 0 ? `${label} (${values.join(', ')})` : label;
}

/** "Off", "On" or "On (Magnitude 25, Angle 20)": Magnitude and Angle only while it is on. */
export function describeQuantization(aim: Aim): string | null {
  if (aim.quantization === null) return null;
  if (!aim.quantization) return 'Off';
  const values = named([
    ['Magnitude', aim.quantizationMagnitude],
    ['Angle', aim.quantizationAngle],
  ]);
  return values.length > 0 ? `On (${values.join(', ')})` : 'On';
}

/**
 * True when the Standard smoothing values (Precision, Response, Easing, Stability) belong to
 * the player's Config: custom Standard smoothing, or smoothing not entered.
 */
export function standardValuesApply(aim: Aim): boolean {
  return aim.smoothing === null || aim.smoothing === 'standard';
}

/**
 * The player's value for an aim setting (a glossary term id). undefined: Dialed has no field
 * for it, or it doesn't belong to the smoothing mode or quantization entered (Standard values
 * only with custom Standard smoothing or none entered, Classic values only with custom
 * Classic, Magnitude and Angle only while quantization is on). null: not entered.
 */
export function aimValue(aim: Aim, termId: string): string | null | undefined {
  if (STANDARD_SMOOTHING_TERMS.has(termId) && !standardValuesApply(aim)) return undefined;
  if (CLASSIC_SMOOTHING_TERMS.has(termId) && aim.smoothing !== 'classic') return undefined;
  switch (termId) {
    case 'sensitivity':
      return describeSensitivity(aim);
    case 'smoothing':
      return describeSmoothing(aim);
    case 'precision':
      return num(aim.precision);
    case 'response':
      return num(aim.response);
    case 'easing':
      return num(aim.easing);
    case 'smooth':
      return num(aim.smooth);
    case 'decay':
      return num(aim.decay);
    case 'synch':
      return num(aim.synch);
    case 'y-scale':
      return num(aim.yScale);
    case 'aiming-curve':
      return aim.aimingCurve === null ? null : CURVE_LABELS[aim.aimingCurve];
    case 'velocity-mapping':
      return aim.velocityMapping === null ? null : VELOCITY_LABELS[aim.velocityMapping];
    case 'quantization':
      return describeQuantization(aim);
    case 'quantization-magnitude':
      return aim.quantization === true ? num(aim.quantizationMagnitude) : undefined;
    case 'quantization-angle':
      return aim.quantization === true ? num(aim.quantizationAngle) : undefined;
    default:
      return undefined;
  }
}

/** The player's value for an aim setting as text, or null when there is none to show. */
export function currentAimValue(config: CurrentConfig | undefined, termId: string): string | null {
  return config ? (aimValue(config.aim, termId) ?? null) : null;
}

/** How a current value relates to the required one. `unknown`: it can't be told apart. */
export type Comparison = 'same' | 'differs' | 'unknown';

export interface CurrentRequiredValue {
  text: string;
  comparison: Comparison;
}

const COMPARISON = { ok: 'same', mismatch: 'differs', unknown: 'unknown' } as const;

/**
 * The player's current value for a Destiny 2 required setting, or null when it isn't entered
 * (or the setting isn't one Tune my config asks for). Uses the same comparison as Tune my
 * config (required-settings.ts), so the flows always agree.
 */
export function currentRequiredValue(
  inGame: InGameSettings | undefined,
  name: string,
  required: string,
): CurrentRequiredValue | null {
  const result = compareRequiredSetting(inGame, name, required);
  return result && { text: result.current, comparison: COMPARISON[result.state] };
}

export interface SmoothingNote {
  mode: Exclude<SmoothingMode, 'standard'>;
  /** The smoothing as the player entered it, e.g. "Preset: Fast". */
  current: string;
  /** What that means for the aim-style directions, the same wording everywhere. */
  text: string;
}

/**
 * When the player's smoothing isn't custom Standard: what that means for the aim-style
 * directions, which (in the knowledge base's words) assume Standard smoothing. Classic and Off
 * are named as they are. A preset doesn't rule the directions out, since Dialed can't tell
 * which mode it uses. Null for custom Standard, or when smoothing isn't entered.
 *
 * `scope` 'one' words it for a single direction (a Tune my config card).
 */
export function smoothingNote(aim: Aim | undefined, scope: 'all' | 'one' = 'all'): SmoothingNote | null {
  if (!aim || aim.smoothing === null || aim.smoothing === 'standard') return null;
  const current = describeSmoothing(aim) ?? SMOOTHING_LABELS[aim.smoothing];
  const assumes = scope === 'all' ? 'These directions assume Standard smoothing.' : 'This direction assumes Standard smoothing.';
  if (aim.smoothing === 'preset') {
    const preset = aim.presetName.trim();
    return {
      mode: 'preset',
      current,
      text: `Your smoothing is a preset${preset ? ` (${preset})` : ''}. Dialed can’t tell which mode a preset uses. ${assumes}`,
    };
  }
  return { mode: aim.smoothing, current, text: `Your smoothing is ${SMOOTHING_LABELS[aim.smoothing]}. ${assumes}` };
}

export interface CheckContextLine {
  label: string;
  value: string;
  /** True when this value and the one before it should match but don't. */
  differs?: boolean;
}

/**
 * What the player has told Dialed that a setup check is about: the mouse DPI and polling rate
 * from the profile, and the DPI entered for this loadout's Config in Tune my config.
 */
export function checkContext(
  checkId: string,
  profile: { mouseDpi: number | null; pollingRate: number | null },
  config: CurrentConfig | undefined,
): CheckContextLine[] {
  if (checkId === 'mouse-dpi-matches') {
    const lines: CheckContextLine[] = [];
    if (profile.mouseDpi !== null) lines.push({ label: 'Your mouse (profile)', value: `${profile.mouseDpi} DPI` });
    const configDpi = config?.matrix.configDpi ?? null;
    if (configDpi !== null) {
      lines.push({
        label: 'This loadout’s Config (current settings)',
        value: `${configDpi} DPI`,
        differs: profile.mouseDpi !== null && profile.mouseDpi !== configDpi,
      });
    }
    return lines;
  }
  if (checkId === 'mouse-polling-rate' && profile.pollingRate !== null) {
    return [{ label: 'Your mouse is set to (profile)', value: `${profile.pollingRate} Hz` }];
  }
  return [];
}
