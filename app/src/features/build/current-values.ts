/**
 * The player's current settings (entered in Tune my config), read for display next to what
 * the build asks for. Only Destiny 2's required settings have a value to compare against;
 * aim settings are shown as they are, since the knowledge base gives directions, not numbers.
 */
import type { CurrentConfig } from '../../state/schema';

/** How a current value relates to the required one. `unknown`: it can't be told apart. */
export type Comparison = 'same' | 'differs' | 'unknown';

export interface CurrentRequiredValue {
  text: string;
  comparison: Comparison;
}

type InGameField = keyof CurrentConfig['inGame'];

/** Destiny 2 required settings by name (lower-case, dashed), to the field Tune my config stores. */
const IN_GAME_FIELDS: Record<string, InGameField> = {
  'movement-controls': 'movementControls',
  'button-layout': 'buttonLayout',
  'look-sensitivity': 'lookSensitivity',
  'ads-sensitivity-modifier': 'adsSensitivityModifier',
  'axial-deadzone': 'axialDeadzone',
  'radial-deadzone': 'radialDeadzone',
};

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

const DEFAULT_TEXT = 'Default';
const NOT_DEFAULT_TEXT = 'Not Default';

/**
 * The player's current value for a Destiny 2 required setting, or null when it isn't entered
 * (or the setting isn't one Tune my config asks for). Values are compared exactly, after
 * trimming, with the value the knowledge base gives.
 */
export function currentRequiredValue(
  config: CurrentConfig | undefined,
  name: string,
  required: string,
): CurrentRequiredValue | null {
  const field = IN_GAME_FIELDS[slug(name)];
  if (!config || !field) return null;
  const value = config.inGame[field];
  if (value === null) return null;
  const want = required.trim();
  if (value === 'default') return { text: DEFAULT_TEXT, comparison: want === DEFAULT_TEXT ? 'same' : 'differs' };
  // "Not default" can only be told apart from a required "Default".
  if (value === 'other') return { text: NOT_DEFAULT_TEXT, comparison: want === DEFAULT_TEXT ? 'differs' : 'unknown' };
  const text = String(value);
  return { text, comparison: text.trim() === want ? 'same' : 'differs' };
}

const SMOOTHING_TEXT: Record<NonNullable<CurrentConfig['aim']['smoothing']>, string> = {
  preset: 'Preset',
  standard: 'Custom Standard',
  classic: 'Custom Classic',
  off: 'Off',
};

function num(value: number | null): string | null {
  return value === null ? null : String(value);
}

function joined(parts: (string | null)[]): string | null {
  const present = parts.filter((p): p is string => p !== null);
  return present.length > 0 ? present.join(' · ') : null;
}

/**
 * The player's current value for an aim setting (glossary term id), as text, or null when it
 * isn't entered or Tune my config doesn't ask for it.
 */
export function currentAimValue(config: CurrentConfig | undefined, termId: string): string | null {
  if (!config) return null;
  const aim = config.aim;
  switch (termId) {
    case 'sensitivity':
      return joined([
        aim.hipSensitivity === null ? null : `Hip ${aim.hipSensitivity} cm/360`,
        aim.adsSensitivity === null ? null : `ADS ${aim.adsSensitivity} cm/360`,
      ]);
    case 'smoothing':
      if (aim.smoothing === null) return null;
      return aim.smoothing === 'preset' && aim.presetName.trim()
        ? `${SMOOTHING_TEXT.preset}: ${aim.presetName.trim()}`
        : SMOOTHING_TEXT[aim.smoothing];
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
      return aim.aimingCurve === null ? null : aim.aimingCurve === 'linear' ? 'Linear' : 'Custom';
    case 'velocity-mapping':
      return aim.velocityMapping === null ? null : aim.velocityMapping === 'standard' ? 'Standard' : 'Not Standard';
    case 'quantization':
      return joined([
        aim.quantization === null ? null : aim.quantization ? 'On' : 'Off',
        aim.quantizationMagnitude === null ? null : `Magnitude ${aim.quantizationMagnitude}`,
        aim.quantizationAngle === null ? null : `Angle ${aim.quantizationAngle}`,
      ]);
    case 'quantization-magnitude':
      return num(aim.quantizationMagnitude);
    case 'quantization-angle':
      return num(aim.quantizationAngle);
    default:
      return null;
  }
}

/**
 * The smoothing the player says they use, when it isn't custom Standard (the aim-style
 * directions assume Standard). Null when it is Standard or not entered.
 */
export function nonStandardSmoothing(config: CurrentConfig | undefined): string | null {
  const smoothing = config?.aim.smoothing ?? null;
  if (smoothing === null || smoothing === 'standard') return null;
  return currentAimValue(config, 'smoothing');
}
