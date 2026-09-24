/**
 * Checklist item ids for `AppData.progress`, and how progress is counted and described.
 *
 * - Global items (Destiny 2 settings, setup checks) are shared by Build my config and
 *   Troubleshoot by feel, so ticking one shows in both.
 * - Loadout items start with `loadout:<id>:`, so deleting a loadout can remove them. The aim
 *   items start with `loadout:<id>:aim:` and are shared by Build my config (step 3 and the
 *   config sheet) and Tune my config ("Done: show the next change").
 */
import type { KnowledgeBase } from '../../../knowledge/index';
import { checkContext, currentRequiredValue } from './current-values';
import type { CurrentConfig, InGameSettings, Profile, ProgressState } from './schema';

export type ProgressMap = Readonly<Record<string, ProgressState>>;

/** A checklist item's state, as the toggles, the status chips and the config sheet's text name it. */
export const STATUS_TEXT: Record<ProgressState | 'none', string> = {
  done: 'Done',
  problem: 'Needs fixing',
  none: 'Not checked yet',
};

/**
 * The setup check that covers Destiny 2's required in-game settings. That is layer 1, which
 * Build my config covers setting by setting, so its state follows those settings unless the
 * player marks it themselves (see `effectiveProgress`).
 */
export const REQUIRED_SETTINGS_CHECK_ID = 'destiny2-required-settings';

/**
 * Setup checks about one specific Config. The marks are global, but each loadout has its own
 * Config, so wherever these checks are shown they say to check every Config.
 */
export const PER_CONFIG_CHECK_IDS: ReadonlySet<string> = new Set([
  'mouse-dpi-matches',
  'smart-translator-current',
  'light-notifications',
  'clean-sensitivity-test',
]);

export const PER_CONFIG_CHECK_NOTE = 'Check this in every Config you use — each loadout has its own.';

export function loadoutPrefix(loadoutId: string): string {
  return `loadout:${loadoutId}:`;
}

/** Every aim item of one loadout starts with this, so clearing it clears them all (and nothing else). */
export function aimProgressPrefix(loadoutId: string): string {
  return `${loadoutPrefix(loadoutId)}aim:`;
}

export const progressKey = {
  /** A Destiny 2 required in-game setting, by its name as the knowledge base spells it. */
  requiredSetting: (name: string) => `required:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  /** A setup check (FoundationCheck id). */
  check: (checkId: string) => `check:${checkId}`,
  /** A loadout's aim items, shared by Build my config and Tune my config. */
  aim: {
    sensitivity: (loadoutId: string) => `${aimProgressPrefix(loadoutId)}sensitivity`,
    smoothing: (loadoutId: string) => `${aimProgressPrefix(loadoutId)}smoothing`,
    /** A glossary setting the build asks the player to check (e.g. the aiming curve). */
    term: (loadoutId: string, termId: string) => `${aimProgressPrefix(loadoutId)}term:${termId}`,
    /**
     * An aim-style lever. The aim style is part of the key, so a lever ticked for one main
     * weapon's style doesn't count once the main weapon has another style.
     */
    lever: (loadoutId: string, aimStyleId: string, termId: string) =>
      `${aimProgressPrefix(loadoutId)}lever:${aimStyleId}:${termId}`,
  },
};

/**
 * What the player's values are held against, to work out the marks that follow from them: the
 * profile and what was entered in Tune my config.
 */
export interface ProgressContext {
  /** Destiny 2's in-game settings (one record for every loadout). */
  inGame: InGameSettings | undefined;
  profile: Pick<Profile, 'mouseDpi' | 'pollingRate'>;
  /** Every saved Config: the per-Config checks are about each of them. */
  configs: readonly CurrentConfig[];
}

/**
 * The items that need fixing whatever the player ticked: a Destiny 2 setting whose current
 * value differs from XIM's list, and a setup check whose context shows a difference in any
 * saved Config (e.g. a Config's DPI differs from the mouse's). A wrong value in a lower layer
 * breaks everything above it (CONCEPT.md §6), so a tick can't say Done until the values match.
 */
export function derivedProblemKeys(
  kb: Pick<KnowledgeBase, 'game' | 'foundation'>,
  context: ProgressContext,
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const setting of kb.game.requiredSettings) {
    if (currentRequiredValue(context.inGame, setting.name, setting.value)?.comparison === 'differs') {
      keys.add(progressKey.requiredSetting(setting.name));
    }
  }
  for (const check of kb.foundation) {
    const differs = context.configs.some((config) =>
      checkContext(check.id, context.profile, config).some((line) => line.differs),
    );
    if (differs) keys.add(progressKey.check(check.id));
  }
  return keys;
}

/** The line under an item shown as Needs fixing because its values differ: the tick it overrides, and what differs. */
export function derivedProblemNote(saved: ProgressState | null | undefined, differs: string): string {
  return saved === 'done' ? `You marked this Done, but ${differs}.` : `Shown as Needs fixing because ${differs}.`;
}

/**
 * The progress as the checklists show it: the saved marks, with the items whose values differ
 * (`derivedProblemKeys`, when a context is given) as Needs fixing, plus the Destiny 2 settings
 * check worked out from the required settings when the player hasn't marked it themselves. That
 * check is Needs fixing when any required setting is, and Done when every one is; a setting
 * whose value differs makes it Needs fixing whatever the player marked on it.
 */
export function effectiveProgress(
  progress: ProgressMap,
  kb: Pick<KnowledgeBase, 'game' | 'foundation'>,
  context?: ProgressContext,
): ProgressMap {
  const derived = context ? derivedProblemKeys(kb, context) : undefined;
  const marks: ProgressMap =
    derived && derived.size > 0
      ? { ...progress, ...Object.fromEntries([...derived].map((key) => [key, 'problem' as const])) }
      : progress;
  const key = progressKey.check(REQUIRED_SETTINGS_CHECK_ID);
  const settingKeys = kb.game.requiredSettings.map((s) => progressKey.requiredSetting(s.name));
  if (derived && settingKeys.some((k) => derived.has(k))) return { ...marks, [key]: 'problem' };
  if (marks[key] !== undefined || settingKeys.length === 0) return marks;
  const states = settingKeys.map((k) => marks[k]);
  if (states.includes('problem')) return { ...marks, [key]: 'problem' };
  if (states.every((s) => s === 'done')) return { ...marks, [key]: 'done' };
  return marks;
}

export interface ProgressCount {
  total: number;
  done: number;
  problem: number;
}

export function countProgress(keys: readonly string[], progress: ProgressMap): ProgressCount {
  let done = 0;
  let problem = 0;
  for (const key of keys) {
    if (progress[key] === 'done') done += 1;
    else if (progress[key] === 'problem') problem += 1;
  }
  return { total: keys.length, done, problem };
}

/**
 * Every checklist's summary: "4 of 17 done" (or "4 of 17 items done" with `unit` "items"),
 * plus " · 1 needs fixing" when something does.
 */
export function progressSummary({ total, done, problem }: ProgressCount, unit?: string): string {
  const base = `${done} of ${total}${unit ? ` ${unit}` : ''} done`;
  return problem > 0 ? `${base} · ${problem} ${problem === 1 ? 'needs' : 'need'} fixing` : base;
}
