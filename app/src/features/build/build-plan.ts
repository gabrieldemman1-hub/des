/**
 * What Build my config asks a player to do for one loadout, worked out from the knowledge base
 * and the profile. Kept free of React so the walkthrough, the build index and the config sheet
 * share one definition (and one progress count), and so it can be tested directly.
 *
 * Nothing here adds advice: every item points at statements from the knowledge base.
 */
import type {
  AimStyle,
  Confidence,
  FoundationCheck,
  GlossaryTerm,
  Lever,
  Statement,
  WeaponArchetype,
} from '../../../../knowledge/index';
import { CURVE_LABELS, QUANTIZATION_LABELS, VELOCITY_LABELS } from '../../state/current-values';
import type { KnowledgeApi } from '../../state/knowledge-context';
import { aimsWithMouse, checksForProfile, leversForProfile } from '../../state/guidance';
import {
  REQUIRED_SETTINGS_CHECK_ID,
  countProgress,
  progressKey,
  type ProgressCount,
  type ProgressMap,
} from '../../state/progress';
import type { Loadout, Profile } from '../../state/schema';

export type { ProgressCount } from '../../state/progress';

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
export const GAME_NOTE_IDS = [
  'max-sensitivity-and-defaults',
  'sync-method',
  'confirm-in-manager',
  'bungie-adapter-policy',
] as const;

/** Further game notes that bear on the Destiny 2 settings, shown on request. */
export function moreGameNoteIds(platform: Profile['platform']): string[] {
  return ['simulate-analog-behavior', 'xbox-vs-pc', ...(platform === 'xbox' ? [] : ['pc-destiny-specific'])];
}

/**
 * Mechanics whose defaults the glossary's official guidance covers, checked after the levers.
 * A loadout whose aim style has a lever for one of them gets that lever instead of the row.
 */
export const MECHANICS_TERM_IDS = ['aiming-curve', 'quantization', 'velocity-mapping'] as const;
export type MechanicsTermId = (typeof MECHANICS_TERM_IDS)[number];

function isMechanicsTerm(termId: string): termId is MechanicsTermId {
  return (MECHANICS_TERM_IDS as readonly string[]).includes(termId);
}

/**
 * Each mechanic's default, as XIM's official guidance on the term states it ("The default is
 * linear", "It is off by default", "The default is Standard"). Where no lever of the loadout's
 * aim style covers the setting, the sheet shows it as the value to keep: XIM's advice is to
 * start with Sensitivity alone and change the rest only if necessary, and the guidance on each
 * term says when that is. Where a lever covers it, the lever row names it as XIM's default
 * beside the lever's direction. Spelled as the player's own values are, so the two read alike.
 * `build-plan.test.ts` checks them against the guidance.
 */
export const MECHANICS_DEFAULTS: Readonly<Record<MechanicsTermId, string>> = {
  'aiming-curve': CURVE_LABELS.linear,
  quantization: QUANTIZATION_LABELS.off,
  'velocity-mapping': VELOCITY_LABELS.standard,
};

/** Where no source gives a number, the sheet's value says what to do instead. */
const BY_FEEL = 'by feel';

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

/**
 * What the config sheet shows as a glossary setting's value: what to set, in a word or two,
 * the way the Destiny 2 rows show XIM's value. Never a number the sources don't give.
 */
export interface GuidanceValue {
  /** "Linear", "A preset", "Your cm/360". */
  text: string;
  /** How to read it: keep XIM's default, or pick it by feel because no source gives a number. */
  caption?: 'default' | typeof BY_FEEL;
  /** The confidence of the guidance the value comes from. */
  confidence: Confidence;
}

/** A glossary setting and XIM's guidance on it. */
export interface GuidanceItem {
  key: string;
  term: GlossaryTerm;
  value: GuidanceValue;
  /** Shown straight away. */
  lead: Statement[];
  /** The rest of the guidance, kept one tap away. */
  more: Statement[];
}

export interface LeverItem {
  key: string;
  lever: Lever;
  /**
   * For a lever on one of the mechanics (the aiming curve): XIM's default and official guidance
   * on the setting, which the lever row carries in place of a row of its own.
   */
  guidance?: GuidanceItem;
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
  /**
   * Aim items left out because they are for another aiming source: levers (e.g. gyro-only), and
   * the cm/360 Sensitivity without a mouse.
   */
  hiddenLevers: number;
  mechanics: GuidanceItem[];
}

type Lookups = Pick<KnowledgeApi, 'kb' | 'termById' | 'archetypeById' | 'aimStyleById'>;

function guidanceItem(
  lookups: Lookups,
  termId: string,
  key: string,
  value: Omit<GuidanceValue, 'confidence'>,
  extraLead: readonly Statement[] = [],
): GuidanceItem | undefined {
  const term = lookups.termById(termId);
  if (!term) return undefined;
  const [first, ...rest] = term.guidance;
  const lead = [...(first ? [first] : []), ...extraLead];
  if (lead.length === 0) return undefined;
  // A gap in the lead is what the value answers ("by feel"), so it sets the value's confidence.
  const source = lead.find((s) => s.confidence === 'gap') ?? lead[0]!;
  return { key, term, value: { ...value, confidence: source.confidence }, lead, more: rest };
}

export function buildPlan(lookups: Lookups, profile: Profile, loadout: Loadout): BuildPlan {
  const { kb } = lookups;
  const mainId = loadout.weapons[loadout.mainSlot];
  const main = mainId === null ? undefined : lookups.archetypeById(mainId);
  const style = main?.aimStyle ? lookups.aimStyleById(main.aimStyle) : undefined;
  // Profile-filtered, so a hidden lever never takes a mechanics row away.
  const levers = style ? leversForProfile(style.levers, profile) : [];
  const leverTerms = new Set(levers.map((lever) => lever.termId));
  const mechanicsItem = (termId: MechanicsTermId, key: string) =>
    guidanceItem(lookups, termId, key, { text: MECHANICS_DEFAULTS[termId], caption: 'default' });

  // Where no source gives a sensitivity number, the knowledge base says so: show that gap
  // next to XIM's advice rather than leave the player expecting a number.
  const sensitivityGaps = kb.game.preferences
    .filter((p) => p.input === 'sensitivity' && p.statement.confidence === 'gap')
    .map((p) => p.statement);
  // Mouse sensitivity is set in cm/360, so the row is for players who aim with a mouse.
  const sensitivity = guidanceItem(
    lookups,
    'sensitivity',
    progressKey.aim.sensitivity(loadout.id),
    { text: 'Your cm/360', caption: BY_FEEL },
    sensitivityGaps,
  );
  const withMouse = aimsWithMouse(profile);

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
    // The Destiny 2 settings check is layer 1, which the first step covers setting by setting.
    checks: checksForProfile(kb.foundation, profile)
      .filter((check) => check.id !== REQUIRED_SETTINGS_CHECK_ID)
      .map((check) => ({ key: progressKey.check(check.id), check })),
    sensitivity: withMouse ? sensitivity : undefined,
    smoothing: guidanceItem(lookups, 'smoothing', progressKey.aim.smoothing(loadout.id), {
      text: 'A preset',
      caption: BY_FEEL,
    }),
    levers: style
      ? levers.map((lever): LeverItem => {
          const key = progressKey.aim.lever(loadout.id, style.id, lever.termId);
          const guidance = isMechanicsTerm(lever.termId) ? mechanicsItem(lever.termId, key) : undefined;
          return guidance ? { key, lever, guidance } : { key, lever };
        })
      : [],
    hiddenLevers: (style ? style.levers.length - levers.length : 0) + (sensitivity && !withMouse ? 1 : 0),
    mechanics: MECHANICS_TERM_IDS.filter((termId) => !leverTerms.has(termId)).flatMap((termId) => {
      const item = mechanicsItem(termId, progressKey.aim.term(loadout.id, termId));
      return item ? [item] : [];
    }),
  };
}

/**
 * "XIM’s default: Linear": what a lever row adds after its direction when it carries XIM's
 * guidance on the setting (see `LeverItem.guidance`). Undefined for other levers.
 */
export function leverDefaultCaption(item: LeverItem): string | undefined {
  return item.guidance ? `XIM’s default: ${item.guidance.value.text}` : undefined;
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

/**
 * Progress for each checklist step. Pass the effective progress (`effectiveProgress`), as every
 * checklist shows it.
 */
export function stepProgress(plan: BuildPlan, progress: ProgressMap): Record<ChecklistStepId, ProgressCount> {
  const keys = stepKeys(plan);
  return {
    'destiny-2': countProgress(keys['destiny-2'], progress),
    matrix: countProgress(keys.matrix, progress),
    aim: countProgress(keys.aim, progress),
  };
}

/** Progress over the whole walkthrough (the shared steps count for every loadout). */
export function planProgress(plan: BuildPlan, progress: ProgressMap): ProgressCount {
  const keys = stepKeys(plan);
  return countProgress([...keys['destiny-2'], ...keys.matrix, ...keys.aim], progress);
}

/**
 * Where /build/<loadout> picks up: the first checklist step that isn't fully done, or the
 * config sheet step when everything is.
 */
export function resumeStep(plan: BuildPlan, progress: ProgressMap): BuildStepId {
  const counts = stepProgress(plan, progress);
  return CHECKLIST_STEPS.find((id) => counts[id].done < counts[id].total) ?? 'sheet';
}
