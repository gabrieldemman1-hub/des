/**
 * Tune my config (CONCEPT.md §5 Flow B): compares the player's current settings for one
 * loadout with the knowledge base and lists what to change, ordered by impact, in the layer
 * order of CONCEPT.md §6 (Destiny 2 settings, then MATRIX setup, then aim settings).
 *
 * Every finding carries the knowledge-base statement behind it, or one of the two statements
 * below that belong to Tune alone (Custom sync, and the DPI fix); those quote only passages the
 * knowledge base already cites, from the same pages. The only concrete targets are Destiny 2's
 * required values, as the knowledge base spells them, and aim settings get directions (raise,
 * lower, it depends), never numbers. A value is never called too high or too low. Kept free of
 * React so it can be tested with the real knowledge base.
 */
import type {
  AimStyle,
  Citation,
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
import { aimsWithMouse, checksForProfile, leversForProfile } from '../../state/guidance';
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
   * smoothing isn't custom Standard: the directions are for custom Standard smoothing (the
   * shared wording from `smoothingNote`), so with a preset, Classic or Off the lever isn't
   * actionable.
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
import {
  IN_GAME_TERMS,
  checkRequiredSettings,
  type InGameField,
  type RequiredSettingStatus,
} from '../../state/required-settings';

// ---------------------------------------------------------------------------------------
// Tune's own statements
// ---------------------------------------------------------------------------------------

const GUIDE = 'xim-guide';
const GAME_SETTINGS = 'xim-game-settings';
const cite = (source: string, url: string, quote: string): Citation => ({ source, url, quote });

/**
 * Why Tune doesn't compare Look Sensitivity and ADS Sensitivity Modifier for a Config with
 * Custom sync. XIM names no Destiny 2 setting that Custom covers, so it is reasoned.
 */
export const CUSTOM_SYNC_STATEMENT: Statement = {
  text: "Your Config uses Custom sync, so Dialed doesn't compare Look Sensitivity or ADS Sensitivity Modifier with XIM's list. With Custom, XIM says you choose your game's Hip and ADS sensitivity and copy your game's aim settings into your Config, and Smart Translation must be synchronized with your game's aim settings. So your Config must hold the same values that Destiny 2 has for these two. If you change them in game, copy the new values into your Config. The other required settings, including the in-game deadzones, still apply, and all other aim settings stay default. If you switch this Config to Standard, use XIM's list: Look Sensitivity 20, ADS Sensitivity Modifier 1.5.",
  confidence: 'reasoned',
  reasoning:
    "XIM's Custom sync lets you choose Hip and ADS sensitivity in game, and you copy your game's aim settings into the Config. No source names which Destiny 2 settings those are. XIM's public Destiny 2 entry has no Custom line and marks no value as customizable. By their names, Look Sensitivity and ADS Sensitivity Modifier are the likely ones. Smart Translation must be synchronized with the game's aim settings, so the values in game and the values copied into the Config must match.",
  caveat:
    "Check which values your Config's Custom Game Settings in Manager asks for. Any Destiny 2 setting it doesn't ask for keeps XIM's list value. Dialed keeps one set of Destiny 2 settings for all your loadouts, so a loadout whose Config uses Standard sync still needs 20 and 1.5.",
  citations: [
    cite(
      GUIDE,
      'https://guide.xim.tech/Game-Settings/',
      "XIM MATRIX's Smart Translation input system must be synchronized with your game's aim settings for correctness to ensure optimal precision aim.",
    ),
    cite(
      GUIDE,
      'https://guide.xim.tech/Game-Settings/#custom',
      "Custom is a powerful synchronization option that let's you choose your game's aim settings including:",
    ),
    cite(GUIDE, 'https://guide.xim.tech/Game-Settings/#custom', 'Hip and ADS sensitivity'),
    cite(GUIDE, 'https://guide.xim.tech/Game-Settings/#custom', "To use, copy your game's aim settings into your Config:"),
    cite(
      GUIDE,
      'https://guide.xim.tech/Game-Settings/#custom',
      'Follow all additional required aim settings including in-game deadzone. All other aim settings should be default.',
    ),
    cite(
      GUIDE,
      'https://guide.xim.tech/Gaming-On-Xbox/#required-game-settings',
      'Or, if you are a controller gamer (and the game has support for it), aim is customized in your game and settings are copied to your Config.',
    ),
    cite(GAME_SETTINGS, 'https://community.xim.tech/pub/xim-game-settings#X10D7', 'Look Sensitivity: 20'),
    cite(GAME_SETTINGS, 'https://community.xim.tech/pub/xim-game-settings#X10D7', 'ADS Sensitivity Modifier: 1.5'),
  ],
};

/** How to set the Config's DPI, and how Check DPI reads: its value only has to be in range. */
export const DPI_FIX_STATEMENT: Statement = {
  text: "Set the DPI in your Config to your mouse's DPI. To check the DPI your mouse really runs at, use Check DPI: place a ruler under your mouse (a ruler phone app works too), then in Manager press and hold the mouse icon for 3 seconds, select Check DPI, move the mouse 1 inch sideways and look at the value shown. It's normal for that value not to match your DPI exactly, but it should be within range. If it isn't, make sure your DPI setting is really saving to your mouse.",
  confidence: 'official',
  citations: [
    cite(GUIDE, 'https://guide.xim.tech/Aim-Settings/#mouse-dpi', 'Make sure this value matches your mouse DPI.'),
    cite(
      GUIDE,
      'https://guide.xim.tech/Troubleshooting-Mice/#measuring-dpi',
      'Place a ruler below your mouse (a ruler phone app works too)',
    ),
    cite(GUIDE, 'https://guide.xim.tech/Troubleshooting-Mice/#measuring-dpi', 'Press and hold the mouse icon for 3 seconds'),
    cite(GUIDE, 'https://guide.xim.tech/Troubleshooting-Mice/#measuring-dpi', 'Move your mouse horizontally for 1 inch'),
    cite(
      GUIDE,
      'https://guide.xim.tech/Troubleshooting-Mice/#measuring-dpi',
      "Gaming mice use high resolution sensors, it's normal to not match your DPI exactly, but, it should be within the range. If it's not, verify that your DPI selection is saving correctly to your mouse.",
    ),
  ],
};

/** Every statement Tune adds to the knowledge base's own. */
export const TUNE_STATEMENTS: readonly Statement[] = [CUSTOM_SYNC_STATEMENT, DPI_FIX_STATEMENT];

// ---------------------------------------------------------------------------------------
// Destiny 2 required settings, for one loadout's Config
// ---------------------------------------------------------------------------------------

/**
 * The Destiny 2 settings a Config with Custom sync copies from the game (by their names, the
 * Hip and ADS sensitivity XIM says Custom lets you choose), so Tune doesn't compare them with
 * XIM's list. Destiny 2's other required settings still apply.
 */
export const CUSTOM_SYNC_FIELDS: ReadonlySet<InGameField> = new Set(['lookSensitivity', 'adsSensitivityModifier']);

/** A required setting as Tune shows it for one loadout's Config. */
export interface LoadoutRequiredSetting extends RequiredSettingStatus {
  /** True when the Config's Custom sync takes the value from the game: `unknown`, with `CUSTOM_SYNC_STATEMENT`. */
  customSync?: true;
}

/**
 * Destiny 2's required settings compared with what the player entered, for this loadout's
 * Config. With Custom sync, Look Sensitivity and ADS Sensitivity Modifier aren't compared: they
 * are `unknown` (check them yourself) and carry `CUSTOM_SYNC_STATEMENT`. Standard and Manual
 * sync, or none entered, compare every setting.
 */
export function requiredSettingsFor(
  kb: KnowledgeBase,
  inGame: InGameSettings | undefined,
  config: CurrentConfig | undefined,
): LoadoutRequiredSetting[] {
  const settings = checkRequiredSettings(kb, inGame);
  if (config?.matrix.syncMethod !== 'custom') return settings;
  return settings.map((setting) =>
    setting.field !== null && CUSTOM_SYNC_FIELDS.has(setting.field)
      ? { ...setting, state: 'unknown', statement: CUSTOM_SYNC_STATEMENT, customSync: true }
      : setting,
  );
}

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

function fixFindings(
  kb: KnowledgeBase,
  inGame: InGameSettings,
  config: CurrentConfig,
  known: (ids: readonly string[]) => string[],
) {
  return requiredSettingsFor(kb, inGame, config).flatMap((setting): Finding[] => {
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
        // What to do, and what Check DPI's reading means (the check's own text isn't on the card).
        more: [DPI_FIX_STATEMENT],
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
  // Mouse sensitivity is set in cm/360, so it is for players who aim with a mouse.
  const sensitivity = term('sensitivity');
  const startWith = sensitivity?.guidance[0];
  if (sensitivity && startWith && aimsWithMouse(profile)) {
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
    // A preset, Classic or Off: the direction is for custom Standard smoothing, a value their
    // Config doesn't have as it is (and the form doesn't ask for), so it is never "Change this first".
    const ruledOut = leverNote !== null;
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
    ...fixFindings(kb, inGame ?? emptyInGame(), current, known),
    ...setupFindings(kb, profile, current, term, known),
    ...aimFindings(kb, profile, loadout, current, term, known),
    ...infoFindings(kb, profile, current, term, known),
  ];
  // Already in group order; the stable sort keeps it that way if the builders ever change.
  return findings.sort((a, b) => FINDING_GROUPS.indexOf(a.group) - FINDING_GROUPS.indexOf(b.group));
}
