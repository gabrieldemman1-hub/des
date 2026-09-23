/**
 * The player's current settings (entered in Tune my config), read for display next to what
 * the build asks for. Only Destiny 2's required settings have a value to compare against;
 * aim settings are shown as they are, since the knowledge base gives directions, not numbers.
 */
import { compareRequiredSetting } from '../../state/required-settings';
import type { CurrentConfig } from '../../state/schema';

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
 * config (state/required-settings.ts), so the two flows always agree.
 */
export function currentRequiredValue(
  config: CurrentConfig | undefined,
  name: string,
  required: string,
): CurrentRequiredValue | null {
  const result = compareRequiredSetting(config, name, required);
  return result && { text: result.current, comparison: COMPARISON[result.state] };
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

export interface CheckContextLine {
  label: string;
  value: string;
  /** True when this value and the one before it should match but don't. */
  differs?: boolean;
}

/**
 * What the player has told Dialed that a setup check is about: the mouse DPI and polling rate
 * from the profile, and the DPI entered for the Config in Tune my config.
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
        label: 'Your Config (current settings)',
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

/**
 * The smoothing the player says they use, when it isn't custom Standard (the aim-style
 * directions assume Standard). Null when it is Standard or not entered.
 */
export function nonStandardSmoothing(config: CurrentConfig | undefined): string | null {
  const smoothing = config?.aim.smoothing ?? null;
  if (smoothing === null || smoothing === 'standard') return null;
  return currentAimValue(config, 'smoothing');
}
