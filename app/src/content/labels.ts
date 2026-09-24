import type {
  AimingSource,
  AimStyleId,
  Confidence,
  LeverDirection,
  OutputType,
  Statement,
  TermCategory,
} from '../../../knowledge/index';

/** Confidence labels and their one-line meanings (CONCEPT.md §5 and §8). */
export const CONFIDENCE_INFO: Record<Confidence, { label: string; meaning: string }> = {
  official: { label: 'Official', meaning: 'XIM states it.' },
  expert: { label: 'Expert', meaning: 'XIM Central states it, in MATRIX-era content.' },
  contested: { label: 'Contested', meaning: 'Sources disagree, and both positions are shown.' },
  reasoned: {
    label: 'Reasoned',
    meaning: 'Worked out from XIM’s definitions, not stated by a source. It gives a direction, never an invented number.',
  },
  gap: { label: 'Gap', meaning: 'No sourced MATRIX-era answer yet, and the app says so.' },
};

/**
 * How a reasoned statement is introduced, on screen and in plain text. With citations it
 * applies XIM's definitions (CONCEPT.md §8). Without any, it is Dialed's own reading, and the
 * caveat says why.
 */
export function reasonedLabel(statement: Pick<Statement, 'citations'>): string {
  return statement.citations.length > 0
    ? 'Worked out from XIM’s definitions, not stated by a source.'
    : 'Worked out by Dialed, not stated by any source.';
}

/**
 * The one label for a statement's reasons and citations, one tap away: "Why and source", with
 * a count when the disclosure holds several statements. Checks use "Why it matters" and "How to
 * fix it" instead.
 */
export function whySummary(statements: readonly unknown[]): string {
  return statements.length > 1 ? `Why and source (${statements.length})` : 'Why and source';
}

/** The source tiers, as the Sources page names them next to the prose that explains them. */
export const SOURCE_TIER_LABELS = {
  official: 'Official',
  'official-by-reference': 'Official (by reference)',
  'official-inferred': 'Official (inferred)',
  expert: 'Community expert',
} as const;

/**
 * Where a source's words come from, for the tag under a citation whose tier differs from the
 * statement's confidence. Never a confidence word: those belong to the badge.
 */
export const SOURCE_PROVENANCE_LABELS: Record<keyof typeof SOURCE_TIER_LABELS, string> = {
  official: 'XIM’s own guide',
  'official-by-reference': 'XIM forum · public page',
  'official-inferred': 'XIM forum · OBsIV',
  expert: 'Independent creator',
};

/** Fallback names when aim-styles.json doesn't have the style yet (CONCEPT.md §6). */
export const AIM_STYLE_NAMES: Record<AimStyleId, string> = {
  tracking: 'Tracking',
  snap: 'Snap / peek',
  'precision-hold': 'Precision hold',
};

/** Shown for a weapon with no aim style (e.g. a sword). */
export const NO_AIM_STYLE = 'No aim style';

export const PLATFORM_LABELS = { xbox: 'Xbox', pc: 'PC' } as const;

/**
 * Controller output types, by the names XIM MATRIX Manager uses for its output choices
 * (https://guide.xim.tech/Gaming-On-Xbox/, https://guide.xim.tech/Gaming-On-PC-Output-C/).
 * What each one needs is shown from the glossary's sourced Output type statements.
 */
export const OUTPUT_TYPE_LABELS: Record<OutputType, { title: string; sub: string }> = {
  'xbox-controller': { title: 'Controller (Xbox, PS4)', sub: 'Xbox Config' },
  'pc-xinput': { title: 'XInput controller', sub: 'Controller (PC XInput)' },
  'pc-xbox-controller': { title: 'Xbox controller', sub: 'Controller (Xbox, PS, PC)' },
  'pc-dualsense': { title: 'DualSense controller', sub: 'Controller (Xbox, PS, PC)' },
};

export const AIMING_SOURCE_LABELS: Record<AimingSource, { title: string; sub: string }> = {
  mouse: { title: 'Mouse', sub: 'Mouse Aim' },
  gyro: { title: 'Gyro', sub: 'Motion Aim, with a gyro gamepad' },
  thumbstick: { title: 'Thumbstick', sub: 'Thumbstick Aim, with a gamepad stick' },
};

export const FOCUS_LABELS = { crucible: 'Crucible', pve: 'PvE', both: 'Both' } as const;

/** "Deliberate", not "Precise": Precision is a smoothing setting and precision hold an aim style. */
export const STYLE_LABELS = { aggressive: 'Aggressive', balanced: 'Balanced', precise: 'Deliberate' } as const;

/** Aim speed, not the cm/360 number: a faster aim is a lower cm/360. */
export const SENSITIVITY_LABELS = { low: 'Slower', medium: 'Medium', high: 'Faster' } as const;

/** Feel preference, 1 (snappy) to 5 (smooth). Not the Classic Smooth setting. */
export const FEEL_LABELS = { 1: 'Snappy', 2: 'Lean snappy', 3: 'Middle', 4: 'Lean smooth', 5: 'Smooth' } as const;

/** Glossary categories, in the order Explain a concept lists them. */
export const TERM_CATEGORY_LABELS: Record<TermCategory, string> = {
  smoothing: 'Smoothing',
  sensitivity: 'Sensitivity',
  mechanics: 'Curves and mechanics',
  quantization: 'Quantization',
  deadzone: 'Deadzone',
  ads: 'Hip-fire and aiming down sights',
  sync: 'Game settings sync',
  output: 'Output and connection',
  hardware: 'Mouse and hardware',
  'config-switching': 'Switching configs and groups',
  diagnostics: 'Lights and diagnostics',
  other: 'Other',
};

export const LEVER_DIRECTION_LABELS: Record<LeverDirection, string> = {
  raise: 'Raise',
  lower: 'Lower',
  depends: 'It depends',
};
