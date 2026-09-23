/**
 * Destiny 2's required in-game settings compared with what the player entered in Tune my
 * config. Shared by Tune my config and Build my config, so both always agree. The in-game
 * settings are one record for every loadout (`AppData.inGame`).
 */
import type { KnowledgeBase, Statement } from '../../../knowledge/index';
import type { InGameSettings } from './schema';

type InGame = InGameSettings;
export type InGameField = keyof InGame;

/** The knowledge base's setting names (lower case, single spaces) and the fields they fill. */
const REQUIRED_FIELDS: Readonly<Record<string, InGameField>> = {
  'movement controls': 'movementControls',
  'button layout': 'buttonLayout',
  'look sensitivity': 'lookSensitivity',
  'ads sensitivity modifier': 'adsSensitivityModifier',
  'axial deadzone': 'axialDeadzone',
  'radial deadzone': 'radialDeadzone',
};

/** Glossary terms that explain each in-game field. */
export const IN_GAME_TERMS: Readonly<Record<InGameField, readonly string[]>> = {
  movementControls: ['required-game-settings'],
  buttonLayout: ['required-game-settings'],
  lookSensitivity: ['required-game-settings'],
  adsSensitivityModifier: ['required-game-settings'],
  axialDeadzone: ['required-game-settings', 'deadzone'],
  radialDeadzone: ['required-game-settings', 'deadzone'],
};

/** How the player's Default / not-Default choices read. */
export const CHOICE_LABELS = { default: 'Default', other: 'Not default' } as const;

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** The in-game field a required setting's name fills, or null when Dialed has no field for it. */
export function requiredSettingField(name: string): InGameField | null {
  return REQUIRED_FIELDS[normalizeName(name)] ?? null;
}

/** The knowledge base's name for an in-game field, when it lists a required setting for it. */
export function inGameFieldName(kb: Pick<KnowledgeBase, 'game'>, field: InGameField): string | undefined {
  return kb.game.requiredSettings.find((s) => requiredSettingField(s.name) === field)?.name;
}

/** True when the player has entered any of Destiny 2's in-game settings. */
export function hasInGameValues(inGame: InGame | undefined): boolean {
  return inGame !== undefined && Object.values(inGame).some((value) => value !== null);
}

function formatInGame(field: InGameField, config: InGame): string | null {
  if (field === 'movementControls' || field === 'buttonLayout') {
    const value = config[field];
    return value === null ? null : CHOICE_LABELS[value];
  }
  const value = config[field];
  return value === null ? null : String(value);
}

/** A plain decimal number, as the required values are written ("20", "1.5", "0.13"). */
function parseRequiredNumber(text: string): number | null {
  const trimmed = text.trim();
  return /^-?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : null;
}

export type RequiredSettingState = 'ok' | 'mismatch' | 'missing' | 'unknown';

export interface RequiredSettingStatus {
  /** As the knowledge base spells it. */
  name: string;
  /** The required value, as the knowledge base spells it. */
  required: string;
  statement: Statement;
  /** The field that holds the player's value, or null when Dialed has no field for this setting. */
  field: InGameField | null;
  /** The player's value as text, or null when not entered. */
  current: string | null;
  /**
   * ok: matches. mismatch: differs. missing: not entered yet. unknown: Dialed can't compare it
   * (no field for the setting, or a required value it can't read).
   */
  state: RequiredSettingState;
}

function compareRequired(field: InGameField, required: string, config: InGame): RequiredSettingState {
  if (field === 'movementControls' || field === 'buttonLayout') {
    const value = config[field];
    if (value === null) return 'missing';
    // The player can only say Default or not, so only a "Default" requirement can be compared.
    if (normalizeName(required) !== 'default') return 'unknown';
    return value === 'default' ? 'ok' : 'mismatch';
  }
  const value = config[field];
  if (value === null) return 'missing';
  const target = parseRequiredNumber(required);
  if (target === null) return 'unknown';
  return value === target ? 'ok' : 'mismatch';
}

/** Each of Destiny 2's required settings, compared with what the player entered. */
export function checkRequiredSettings(kb: KnowledgeBase, inGame: InGame | undefined): RequiredSettingStatus[] {
  return kb.game.requiredSettings.map((setting) => {
    const field = requiredSettingField(setting.name);
    const base = { name: setting.name, required: setting.value, statement: setting.statement, field };
    if (field === null || inGame === undefined) {
      return { ...base, current: null, state: field === null ? 'unknown' : 'missing' };
    }
    return {
      ...base,
      current: formatInGame(field, inGame),
      state: compareRequired(field, setting.value, inGame),
    };
  });
}

/**
 * One required setting compared with what the player entered: null when Dialed has no field
 * for it or the player hasn't entered it yet.
 */
export function compareRequiredSetting(
  inGame: InGame | undefined,
  name: string,
  required: string,
): { current: string; state: Exclude<RequiredSettingState, 'missing'> } | null {
  const field = requiredSettingField(name);
  if (!inGame || field === null) return null;
  const current = formatInGame(field, inGame);
  if (current === null) return null;
  const state = compareRequired(field, required, inGame);
  return state === 'missing' ? null : { current, state };
}
