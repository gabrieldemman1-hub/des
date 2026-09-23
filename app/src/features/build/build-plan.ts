/**
 * What Build my config asks a player to do for one loadout, worked out from the knowledge base
 * and the profile. Kept free of React so the walkthrough, the build index and the config sheet
 * share one definition (and one progress count), and so it can be tested directly.
 *
 * Nothing here adds advice: every item points at statements from the knowledge base.
 */
import type {
  AimStyle,
  FoundationCheck,
  GlossaryTerm,
  Lever,
  Statement,
  WeaponArchetype,
} from '../../../../knowledge/index';
import type { KnowledgeApi } from '../../state/knowledge-context';
import { checksForProfile, leversForProfile } from '../../state/guidance';
import { progressKey } from '../../state/progress';
import type { Loadout, Profile, ProgressState } from '../../state/schema';

export type BuildStepId = 'destiny-2' | 'matrix' | 'aim' | 'sheet';
/** The steps that are checklists (the last step is the summary). */
export type ChecklistStepId = Exclude<BuildStepId, 'sheet'>;

export interface BuildStepInfo {
  id: BuildStepId;
  title: string;
  /** For the step indicator. */
  short: string;
}

/** In dependency order (CONCEPT.md §6): upper layers mean nothing if the lower ones are wrong. */
export const BUILD_STEPS: readonly BuildStepInfo[] = [
  { id: 'destiny-2', title: 'Destiny 2 settings', short: 'Destiny 2' },
  { id: 'matrix', title: 'MATRIX setup', short: 'MATRIX' },
  { id: 'aim', title: 'Aim settings', short: 'Aim' },
  { id: 'sheet', title: 'Your config sheet', short: 'Sheet' },
];

export const CHECKLIST_STEPS: readonly ChecklistStepId[] = ['destiny-2', 'matrix', 'aim'];

export function stepById(id: string | undefined): BuildStepInfo | undefined {
  return BUILD_STEPS.find((s) => s.id === id);
}

/** Game notes shown before the Destiny 2 settings, in this order (missing ones are skipped). */
export const GAME_NOTE_IDS = ['max-sensitivity-and-defaults', 'sync-method', 'confirm-in-manager'] as const;

/** Further game notes that bear on the Destiny 2 settings, shown on request. */
export function moreGameNoteIds(platform: Profile['platform']): string[] {
  return ['simulate-analog-behavior', 'xbox-vs-pc', ...(platform === 'xbox' ? [] : ['pc-destiny-specific'])];
}

/** Mechanics whose defaults the glossary's official guidance covers, checked after the levers. */
export const MECHANICS_TERM_IDS = ['aiming-curve', 'quantization', 'velocity-mapping'] as const;

export interface RequiredSettingItem {
  key: string;
  name: string;
  value: string;
  statement: Statement;
}

export interface CheckItem {
  key: string;
  check: FoundationCheck;
}

/** A glossary setting and XIM's guidance on it. */
export interface GuidanceItem {
  key: string;
  term: GlossaryTerm;
  /** Shown straight away. */
  lead: Statement[];
  /** The rest of the guidance, kept one tap away. */
  more: Statement[];
}

export interface LeverItem {
  key: string;
  lever: Lever;
}

export interface BuildPlan {
  loadout: Loadout;
  /** The main weapon's archetype; undefined when it is no longer in the knowledge base. */
  main: WeaponArchetype | undefined;
  /** The main weapon's aim style; undefined when it has none or the style is missing. */
  style: AimStyle | undefined;
  settings: RequiredSettingItem[];
  checks: CheckItem[];
  sensitivity: GuidanceItem | undefined;
  smoothing: GuidanceItem | undefined;
  levers: LeverItem[];
  /** Levers left out because they are for another aiming source (e.g. gyro-only). */
  hiddenLevers: number;
  mechanics: GuidanceItem[];
}

type Lookups = Pick<KnowledgeApi, 'kb' | 'termById' | 'archetypeById' | 'aimStyleById'>;

function guidanceItem(
  lookups: Lookups,
  loadoutId: string,
  termId: string,
  item: string,
  extraLead: readonly Statement[] = [],
): GuidanceItem | undefined {
  const term = lookups.termById(termId);
  if (!term) return undefined;
  const [first, ...rest] = term.guidance;
  const lead = [...(first ? [first] : []), ...extraLead];
  if (lead.length === 0) return undefined;
  return { key: progressKey.loadout(loadoutId, item), term, lead, more: rest };
}

export function buildPlan(lookups: Lookups, profile: Profile, loadout: Loadout): BuildPlan {
  const { kb } = lookups;
  const mainId = loadout.weapons[loadout.mainSlot];
  const main = mainId === null ? undefined : lookups.archetypeById(mainId);
  const style = main?.aimStyle ? lookups.aimStyleById(main.aimStyle) : undefined;
  const levers = style ? leversForProfile(style.levers, profile) : [];

  // Where no source gives a sensitivity number, the knowledge base says so: show that gap
  // next to XIM's advice rather than leave the player expecting a number.
  const sensitivityGaps = kb.game.preferences
    .filter((p) => p.input === 'sensitivity' && p.statement.confidence === 'gap')
    .map((p) => p.statement);

  return {
    loadout,
    main,
    style,
    settings: kb.game.requiredSettings.map((s) => ({
      key: progressKey.requiredSetting(s.name),
      name: s.name,
      value: s.value,
      statement: s.statement,
    })),
    checks: checksForProfile(kb.foundation, profile).map((check) => ({ key: progressKey.check(check.id), check })),
    sensitivity: guidanceItem(lookups, loadout.id, 'sensitivity', 'sensitivity', sensitivityGaps),
    smoothing: guidanceItem(lookups, loadout.id, 'smoothing', 'term:smoothing'),
    levers: levers.map((lever) => ({ key: progressKey.loadout(loadout.id, `lever:${lever.termId}`), lever })),
    hiddenLevers: style ? style.levers.length - levers.length : 0,
    mechanics: MECHANICS_TERM_IDS.flatMap((termId) => {
      const item = guidanceItem(lookups, loadout.id, termId, `term:${termId}`);
      return item ? [item] : [];
    }),
  };
}

/** The progress keys each checklist step asks the player to tick. */
export function stepKeys(plan: BuildPlan): Record<ChecklistStepId, string[]> {
  return {
    'destiny-2': plan.settings.map((s) => s.key),
    matrix: plan.checks.map((c) => c.key),
    aim: [
      ...(plan.sensitivity ? [plan.sensitivity.key] : []),
      ...(plan.smoothing ? [plan.smoothing.key] : []),
      ...plan.levers.map((l) => l.key),
      ...plan.mechanics.map((m) => m.key),
    ],
  };
}

export interface ProgressCount {
  total: number;
  done: number;
  problem: number;
}

export function countProgress(keys: readonly string[], progress: Readonly<Record<string, ProgressState>>): ProgressCount {
  let done = 0;
  let problem = 0;
  for (const key of keys) {
    if (progress[key] === 'done') done += 1;
    else if (progress[key] === 'problem') problem += 1;
  }
  return { total: keys.length, done, problem };
}

/** Progress for each checklist step. */
export function stepProgress(
  plan: BuildPlan,
  progress: Readonly<Record<string, ProgressState>>,
): Record<ChecklistStepId, ProgressCount> {
  const keys = stepKeys(plan);
  return {
    'destiny-2': countProgress(keys['destiny-2'], progress),
    matrix: countProgress(keys.matrix, progress),
    aim: countProgress(keys.aim, progress),
  };
}

/** Progress over the whole walkthrough (the shared steps count for every loadout). */
export function planProgress(plan: BuildPlan, progress: Readonly<Record<string, ProgressState>>): ProgressCount {
  const keys = stepKeys(plan);
  return countProgress([...keys['destiny-2'], ...keys.matrix, ...keys.aim], progress);
}

/**
 * Where /build/<loadout> picks up: the first checklist step that isn't fully done, or the
 * config sheet step when everything is.
 */
export function resumeStep(plan: BuildPlan, progress: Readonly<Record<string, ProgressState>>): BuildStepId {
  const counts = stepProgress(plan, progress);
  return CHECKLIST_STEPS.find((id) => counts[id].done < counts[id].total) ?? 'sheet';
}

/** "4 of 17 steps done" (with `unit` "steps") or "4 of 17 done", plus how many need fixing. */
export function progressText({ total, done, problem }: ProgressCount, unit?: string): string {
  const base = `${done} of ${total}${unit ? ` ${unit}` : ''} done`;
  return problem > 0 ? `${base}, ${problem} ${problem === 1 ? 'needs' : 'need'} fixing` : base;
}
