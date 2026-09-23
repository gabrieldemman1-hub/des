/**
 * Tune my config (CONCEPT.md §5 Flow B): compares the player's current settings for one
 * loadout with the knowledge base and lists what to change, ordered by impact, in the layer
 * order of CONCEPT.md §6 (Destiny 2 settings, then MATRIX setup, then aim settings).
 *
 * Every finding carries the knowledge-base statement behind it. Nothing here states a fact of
 * its own: the only concrete targets are Destiny 2's required values, as the knowledge base
 * spells them, and aim settings get directions (raise, lower, it depends), never numbers. A
 * value is never called too high or too low. Kept free of React so it can be tested with the
 * real knowledge base.
 */
import type {
  AimStyle,
  FoundationCheck,
  GlossaryTerm,
  KnowledgeBase,
  LeverDirection,
  Statement,
  WeaponArchetype,
} from '../../../../knowledge/index';
import {
  CURVE_LABELS,
  STANDARD_SMOOTHING_TERMS,
  SYNC_LABELS,
  aimValue,
  describeQuantization,
  describeSensitivity,
  hasConfigValues,
  smoothingNote,
  type SmoothingNote,
} from '../../state/current-values';
import { checksForProfile, leversForProfile } from '../../state/guidance';
import { progressKey } from '../../state/progress';
import { hasInGameValues } from '../../state/required-settings';
import {
  emptyConfig,
  emptyInGame,
  type CurrentConfig,
  type InGameSettings,
  type Loadout,
  type Profile,
} from '../../state/schema';

/** In impact order: what the app shows first comes first. */
export const FINDING_GROUPS = ['fix', 'setup', 'aim', 'info'] as const;
/**
 * - fix: a Destiny 2 in-game setting that differs from XIM's required value.
 * - setup: the MATRIX setup under the aim config (DPI, Smart Translator, sync method).
 * - aim: the aim settings, with directions from the main weapon's aim style.
 * - info: not faults, but worth knowing (e.g. what changes real-world cm/360).
 */
export type FindingGroup = (typeof FINDING_GROUPS)[number];
export type FindingStatus = 'mismatch' | 'ok' | 'missing';

export interface Finding {
  /** Stable and unique within one analysis, e.g. `fix:lookSensitivity` or `aim:precision`. */
  id: string;
  group: FindingGroup;
  /** Short UI text. The statement says what the knowledge base says. */
  title: string;
  /** The knowledge-base statement that justifies the finding. */
  statement: Statement;
  /** Further knowledge-base statements that belong with it, such as a setup check's fix. */
  more: Statement[];
  /** The player's value, as text. */
  current?: string;
  /** fix only: the value XIM's Destiny 2 list gives, exactly as the knowledge base spells it. */
  required?: string;
  /** aim levers only: which way the aim style says to move the setting. */
  direction?: LeverDirection;
  /** mismatch: differs from the knowledge base. missing: the player hasn't entered the value yet. */
  status?: FindingStatus;
  /** Something to change (as opposed to something to know). "Change this first" picks from these. */
  actionable: boolean;
  /**
   * aim levers on a Standard smoothing setting, and the note about them, while the player's
   * smoothing isn't custom Standard: the directions assume Standard smoothing (the shared
   * wording from `smoothingNote`). With Classic or Off the lever isn't actionable; with a
   * preset it still is, since Dialed can't tell which mode a preset uses.
   */
  smoothing?: SmoothingNote;
  /**
   * aim items the player can mark done: the loadout's shared aim progress key, which Build my
   * config's Aim settings step and config sheet read too.
   */
  progressKey?: string;
  /** Glossary terms to link to. Only ids the knowledge base has. */
  termIds: string[];
}

// ---------------------------------------------------------------------------------------
// Destiny 2 required settings (shared with Build my config)
// ---------------------------------------------------------------------------------------

export {
  CHOICE_LABELS,
  checkRequiredSettings,
  requiredSettingField,
  type InGameField,
  type RequiredSettingState,
  type RequiredSettingStatus,
} from '../../state/required-settings';
import { IN_GAME_TERMS, checkRequiredSettings } from '../../state/required-settings';

// ---------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------

export { hasConfigValues } from '../../state/current-values';

/**
 * True when there is something to compare for this loadout: a setting in its Config, or one of
 * Destiny 2's in-game settings (shared by every loadout).
 */
export function hasEnteredSettings(config: CurrentConfig | undefined, inGame: InGameSettings | undefined): boolean {
  return hasConfigValues(config) || hasInGameValues(inGame);
}

/** The loadout's main weapon, and its aim style when the knowledge base has one. */
export function mainWeapon(
  kb: KnowledgeBase,
  loadout: Loadout,
): { archetype: WeaponArchetype | undefined; style: AimStyle | undefined } {
  const id = loadout.weapons[loadout.mainSlot];
  const archetype = id === null ? undefined : kb.weapons.archetypes.find((a) => a.id === id);
  const style =
    archetype?.aimStyle === null || archetype === undefined
      ? undefined
      : kb.aimStyles.find((s) => s.id === archetype.aimStyle);
  return { archetype, style };
}

/** The first thing to change: the first actionable finding not yet marked done. */
export function firstChange(findings: readonly Finding[], isDone: (finding: Finding) => boolean = () => false) {
  return findings.find((f) => f.actionable && !isDone(f));
}

export function groupFindings(findings: readonly Finding[]): Record<FindingGroup, Finding[]> {
  const groups: Record<FindingGroup, Finding[]> = { fix: [], setup: [], aim: [], info: [] };
  for (const finding of findings) groups[finding.group].push(finding);
  return groups;
}

/** The setup check with this id, or else the first one about all of these terms. */
function findCheck(
  checks: readonly FoundationCheck[],
  id: string,
  termIds: readonly string[],
): FoundationCheck | undefined {
  return checks.find((c) => c.id === id) ?? checks.find((c) => termIds.every((t) => c.termIds.includes(t)));
}

function statementsOf(...statements: (Statement | undefined)[]): Statement[] {
  return statements.filter((s): s is Statement => s !== undefined);
}

// ---------------------------------------------------------------------------------------
// The analysis
// ---------------------------------------------------------------------------------------

function fixFindings(kb: KnowledgeBase, inGame: InGameSettings, known: (ids: readonly string[]) => string[]) {
  return checkRequiredSettings(kb, inGame).flatMap((setting): Finding[] => {
    if (setting.state !== 'mismatch' || setting.field === null) return [];
    return [
      {
        id: `fix:${setting.field}`,
        group: 'fix',
        title: setting.name,
        statement: setting.statement,
        more: [],
        current: setting.current ?? undefined,
        required: setting.required,
        status: 'mismatch',
        actionable: true,
        termIds: known(IN_GAME_TERMS[setting.field]),
      },
    ];
  });
}

function setupFindings(
  kb: KnowledgeBase,
  profile: Profile,
  config: CurrentConfig,
  term: (id: string) => GlossaryTerm | undefined,
  known: (ids: readonly string[]) => string[],
): Finding[] {
  const findings: Finding[] = [];
  const checks = checksForProfile(kb.foundation, profile);
  const { matrix } = config;

  // An out-of-date Smart Translator is fixed by recreating the Config, so it comes first.
  if (matrix.translatorWarning === true) {
    const check = findCheck(checks, 'smart-translator-current', ['smart-translation', 'config']);
    if (check) {
      findings.push({
        id: 'setup:smart-translator',
        group: 'setup',
        title: 'Manager shows a Smart Translator warning on this Config',
        statement: check.why,
        more: statementsOf(check.fix),
        current: 'Warning shown',
        status: 'mismatch',
        actionable: true,
        termIds: known(check.termIds),
      });
    }
  }

  if (matrix.syncMethod === 'manual') {
    const [first, ...rest] = term('sync-manual')?.guidance ?? [];
    const plan = kb.game.notes.find((n) => n.id === 'sync-method');
    const statement = first ?? plan?.statement;
    if (statement) {
      findings.push({
        id: 'setup:sync-manual',
        group: 'setup',
        title: 'Your sync method is Manual',
        statement,
        more: first ? statementsOf(...rest, plan?.statement) : [],
        current: SYNC_LABELS.manual,
        status: 'mismatch',
        actionable: true,
        termIds: known(['sync-manual', 'game-settings-sync']),
      });
    }
  } else if (matrix.syncMethod === 'custom') {
    const plan = kb.game.notes.find((n) => n.id === 'sync-method');
    if (plan) {
      // Not a fault: Custom works if Manager offers it. The note says what Dialed plans for.
      findings.push({
        id: 'setup:sync-custom',
        group: 'setup',
        title: 'Your sync method is Custom',
        statement: plan.statement,
        more: [],
        current: SYNC_LABELS.custom,
        actionable: false,
        termIds: known(['sync-custom', 'sync-standard', 'game-settings-sync']),
      });
    }
  }

  if (matrix.configDpi !== null && profile.mouseDpi !== null && matrix.configDpi !== profile.mouseDpi) {
    const check = findCheck(checks, 'mouse-dpi-matches', ['mouse-dpi']);
    if (check) {
      findings.push({
        id: 'setup:dpi',
        group: 'setup',
        title: 'The DPI in your Config differs from your mouse DPI',
        statement: check.why,
        more: statementsOf(check.fix),
        current: `Config ${matrix.configDpi} · mouse ${profile.mouseDpi} (from your profile)`,
        status: 'mismatch',
        actionable: true,
        termIds: known(check.termIds),
      });
    }
  }

  return findings;
}

function aimFindings(
  kb: KnowledgeBase,
  profile: Profile,
  loadout: Loadout,
  config: CurrentConfig,
  term: (id: string) => GlossaryTerm | undefined,
  known: (ids: readonly string[]) => string[],
): Finding[] {
  const findings: Finding[] = [];
  const { aim } = config;

  // XIM's advice for mouse aim: start with Sensitivity alone, and change the rest only if needed.
  const sensitivity = term('sensitivity');
  const startWith = sensitivity?.guidance[0];
  if (sensitivity && startWith) {
    const current = describeSensitivity(aim);
    findings.push({
      id: 'aim:sensitivity',
      group: 'aim',
      title: sensitivity.name,
      statement: startWith,
      more: [],
      current: current ?? undefined,
      status: current === null ? 'missing' : undefined,
      actionable: true,
      progressKey: progressKey.aim.sensitivity(loadout.id),
      termIds: known(['sensitivity']),
    });
  }

  const { archetype, style } = mainWeapon(kb, loadout);
  if (!archetype) return findings; // an archetype the knowledge base no longer has

  if (!style) {
    findings.push({
      id: 'aim:no-style',
      group: 'aim',
      title:
        archetype.aimStyle === null
          ? `No aim style for ${archetype.name}`
          : `Dialed has no directions for ${archetype.name}’s aim style yet`,
      statement: archetype.mapping,
      more: [],
      actionable: false,
      termIds: [],
    });
    return findings;
  }

  const levers = leversForProfile(style.levers, profile);
  const note = smoothingNote(aim);
  if (note && levers.some((l) => STANDARD_SMOOTHING_TERMS.has(l.termId))) {
    // The style's own statement says its directions assume Standard smoothing.
    findings.push({
      id: 'aim:smoothing-mode',
      group: 'aim',
      title: 'These directions assume Standard smoothing',
      statement: style.favours,
      more: [],
      current: note.current,
      actionable: false,
      smoothing: note,
      termIds: known(['smoothing', 'smoothing-standard', 'smoothing-classic']),
    });
  }

  for (const lever of levers) {
    const standardSetting = STANDARD_SMOOTHING_TERMS.has(lever.termId);
    const leverNote = standardSetting ? smoothingNote(aim, 'one') : null;
    // Classic or Off: the direction is for a setting their Config doesn't use as it is. A preset
    // may be Standard, so its directions stay.
    const ruledOut = leverNote !== null && leverNote.mode !== 'preset';
    const value = aimValue(aim, lever.termId);
    findings.push({
      id: `aim:${lever.termId}`,
      group: 'aim',
      title: term(lever.termId)?.name ?? lever.termId,
      statement: lever.statement,
      more: [],
      current: value ?? undefined,
      direction: lever.direction,
      status: value === null ? 'missing' : undefined,
      actionable: !ruledOut,
      smoothing: leverNote ?? undefined,
      progressKey: ruledOut ? undefined : progressKey.aim.lever(loadout.id, style.id, lever.termId),
      termIds: known([lever.termId]),
    });
  }
  return findings;
}

function infoFindings(
  kb: KnowledgeBase,
  profile: Profile,
  config: CurrentConfig,
  term: (id: string) => GlossaryTerm | undefined,
  known: (ids: readonly string[]) => string[],
): Finding[] {
  const findings: Finding[] = [];
  const { aim } = config;

  // A custom curve and quantization both change real-world cm/360: features, not faults.
  const curve = aim.aimingCurve === 'custom';
  const quantization = aim.quantization === true;
  if (curve || quantization) {
    const on = [curve ? 'aiming-curve' : null, quantization ? 'quantization' : null].filter((t) => t !== null);
    const check = findCheck(checksForProfile(kb.foundation, profile), 'clean-sensitivity-test', [
      'aiming-curve',
      'quantization',
    ]);
    const current = [
      curve ? `Aiming Curve: ${CURVE_LABELS.custom}` : null,
      quantization ? `Quantization: ${describeQuantization(aim)}` : null,
    ]
      .filter((p) => p !== null)
      .join(' · ');
    const title =
      curve && quantization
        ? 'A custom aiming curve and quantization are on'
        : curve
          ? 'A custom aiming curve is on'
          : 'Quantization is on';
    if (check) {
      findings.push({
        id: 'info:cm360',
        group: 'info',
        title,
        statement: check.why,
        more: statementsOf(check.fix),
        current,
        actionable: false,
        termIds: known(on),
      });
    } else {
      // Without the setup check, fall back to each term's own guidance.
      for (const id of on) {
        const [first, ...rest] = term(id)?.guidance ?? [];
        if (!first) continue;
        findings.push({
          id: `info:${id}`,
          group: 'info',
          title,
          statement: first,
          more: rest,
          current,
          actionable: false,
          termIds: known([id]),
        });
      }
    }
  }

  if (aim.velocityMapping === 'other') {
    const [first, ...rest] = term('velocity-mapping')?.guidance ?? [];
    if (first) {
      findings.push({
        id: 'info:velocity-mapping',
        group: 'info',
        title: 'Your Velocity Mapping isn’t Standard',
        statement: first,
        more: rest,
        current: 'Not Standard',
        actionable: false,
        termIds: known(['velocity-mapping']),
      });
    }
  }
  return findings;
}

/**
 * What to change in this loadout's Config, ordered by impact: Destiny 2 settings that differ
 * from XIM's list, then setup problems, then the aim settings for the main weapon's aim style,
 * then things worth knowing. Destiny 2's in-game settings are shared by every loadout, so they
 * are passed on their own. Nothing entered gives only the aim guidance.
 */
export function analyzeConfig(
  kb: KnowledgeBase,
  profile: Profile,
  loadout: Loadout,
  config: CurrentConfig | undefined,
  inGame: InGameSettings | undefined,
): Finding[] {
  const current = config ?? emptyConfig();
  const terms = new Map(kb.glossary.terms.map((t) => [t.id, t] as const));
  const term = (id: string) => terms.get(id);
  const known = (ids: readonly string[]) => ids.filter((id) => terms.has(id));

  const findings = [
    ...fixFindings(kb, inGame ?? emptyInGame(), known),
    ...setupFindings(kb, profile, current, term, known),
    ...aimFindings(kb, profile, loadout, current, term, known),
    ...infoFindings(kb, profile, current, term, known),
  ];
  // Already in group order; the stable sort keeps it that way if the builders ever change.
  return findings.sort((a, b) => FINDING_GROUPS.indexOf(a.group) - FINDING_GROUPS.indexOf(b.group));
}
