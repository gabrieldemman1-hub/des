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
import type { ProgressState } from './schema';

export type ProgressMap = Readonly<Record<string, ProgressState>>;

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
 * The progress as the checklists show it: the saved marks, plus the Destiny 2 settings check
 * worked out from the required settings when the player hasn't marked it themselves. It is
 * Needs fixing when any required setting is, and Done when every one is.
 */
export function effectiveProgress(progress: ProgressMap, kb: Pick<KnowledgeBase, 'game'>): ProgressMap {
  const key = progressKey.check(REQUIRED_SETTINGS_CHECK_ID);
  if (progress[key] !== undefined) return progress;
  const states = kb.game.requiredSettings.map((s) => progress[progressKey.requiredSetting(s.name)]);
  if (states.length === 0) return progress;
  if (states.includes('problem')) return { ...progress, [key]: 'problem' };
  if (states.every((s) => s === 'done')) return { ...progress, [key]: 'done' };
  return progress;
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
