import { z } from 'zod';

/**
 * The knowledge base's contract. Every recommendation or explanation the app shows is a
 * Statement: plain-language text, a confidence label, and the citations behind it.
 * The rules below encode the evidence policy in CONCEPT.md §8.
 */

export const CONFIDENCE_LEVELS = ['official', 'expert', 'contested', 'reasoned', 'gap'] as const;
export const Confidence = z.enum(CONFIDENCE_LEVELS);
export type Confidence = z.infer<typeof Confidence>;

export const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ids are kebab-case');

export const SourceTier = z.enum(['official', 'official-by-reference', 'official-inferred', 'expert']);

export const Source = z.object({
  id: Id,
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  /** Hostnames a citation of this source may point to. */
  hosts: z.array(z.string().min(1)).min(1),
  tier: SourceTier,
  accessed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});
export type Source = z.infer<typeof Source>;

export const Citation = z.object({
  /** Source.id */
  source: Id,
  /** The exact page, optionally with an #anchor. */
  url: z.url(),
  /** Verbatim text from that page (checked by `npm run verify:citations`). */
  quote: z.string().min(1),
  /**
   * Required (and must be true) when citing an `expert` source: XIM MATRIX-era material
   * only; nothing written for XIM APEX or XIM4.
   */
  matrixEra: z.literal(true).optional(),
  note: z.string().optional(),
});
export type Citation = z.infer<typeof Citation>;

export const Statement = z
  .object({
    /** What the app shows, in plain language. */
    text: z.string().min(1),
    confidence: Confidence,
    citations: z.array(Citation),
    /** Required for `reasoned`: how the text follows from the cited definitions. */
    reasoning: z.string().optional(),
    /** Anything the reader must know before relying on this statement. */
    caveat: z.string().optional(),
  })
  .superRefine((s, ctx) => {
    const need = (ok: boolean, message: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', message });
    };
    switch (s.confidence) {
      case 'official':
      case 'expert':
        need(s.citations.length >= 1, `${s.confidence} statements need at least one citation`);
        break;
      case 'contested':
        need(s.citations.length >= 2, 'contested statements cite both positions');
        break;
      case 'reasoned':
        need(!!s.reasoning?.trim(), 'reasoned statements must explain their reasoning');
        break;
      case 'gap':
        need(s.citations.length === 0, 'gap statements have no citations');
        break;
    }
  });
export type Statement = z.infer<typeof Statement>;

// ---------------------------------------------------------------------------
// XIM MATRIX knowledge (game-agnostic)
// ---------------------------------------------------------------------------

export const TermCategory = z.enum([
  'sensitivity',
  'smoothing',
  'mechanics',
  'quantization',
  'deadzone',
  'ads',
  'sync',
  'config-switching',
  'output',
  'hardware',
  'diagnostics',
  'other',
]);

/**
 * A name that means something else. With `termId` it points at that term, and `note` says in
 * a line how the two differ. Without `termId` there is no term to point at, so the entry must
 * carry its own sourced `statement` (checked by integrity.ts).
 */
export const NotToBeConfusedWith = z
  .object({
    name: z.string().min(1),
    termId: Id.optional(),
    note: z.string().min(1).optional(),
    statement: Statement.optional(),
  })
  .refine((e) => e.note !== undefined || e.statement !== undefined, {
    message: 'give a note (with termId) or a statement',
  });

export const GlossaryTerm = z.object({
  id: Id,
  /**
   * Spelled exactly as XIM MATRIX Manager / the official guide spells the setting. A term that
   * names a concept or groups several settings (e.g. "Light notifications", "Output type")
   * uses a descriptive name built from the guide's own words; its aliases carry the exact
   * setting names.
   */
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  category: TermCategory,
  /** Where to find it in XIM MATRIX Manager, if applicable. */
  location: z.string().optional(),
  /** One plain-language line. */
  summary: z.string().min(1),
  /** The official definition (confidence `official`). */
  definition: Statement,
  /** What it changes mechanically, in plain language. */
  explanation: z.array(Statement).default([]),
  /** Official feel wording, where the guide gives one. */
  feel: z.array(Statement).default([]),
  /** Official recommendations, defaults and warnings. */
  guidance: z.array(Statement).default([]),
  /** Which aim styles it likely matters for (normally `reasoned`). */
  aimStyles: z.array(Statement).default([]),
  /** Same or similar names that mean something else. */
  notToBeConfusedWith: z.array(NotToBeConfusedWith).default([]),
  related: z.array(Id).default([]),
});
export type GlossaryTerm = z.infer<typeof GlossaryTerm>;

export const GlossaryFile = z.object({
  terms: z.array(GlossaryTerm),
  /** Names people meet (e.g. from videos or older XIM devices) that are not MATRIX settings. */
  nameNotes: z
    .array(z.object({ name: z.string().min(1), termId: Id.optional(), statement: Statement }))
    .default([]),
});

export const Platform = z.enum(['xbox', 'pc']);
export type Platform = z.infer<typeof Platform>;

/**
 * What the MATRIX presents itself as, for controller output (CONCEPT.md §7; mouse-and-keyboard
 * output is out of scope). Xbox has one option; PC has three
 * (https://guide.xim.tech/Gaming-On-PC-Output-C/). The guide's PC-only "Mouse, Keyboard,
 * Controller" option also aims through the controller, but it is out of MVP scope by the
 * user's decision (CONCEPT.md §13).
 */
export const OUTPUT_TYPES = ['xbox-controller', 'pc-xinput', 'pc-xbox-controller', 'pc-dualsense'] as const;
export const OutputType = z.enum(OUTPUT_TYPES);
export type OutputType = z.infer<typeof OutputType>;
export const OUTPUT_TYPES_BY_PLATFORM: Record<Platform, readonly OutputType[]> = {
  xbox: ['xbox-controller'],
  pc: ['pc-xinput', 'pc-xbox-controller', 'pc-dualsense'],
};

/** What the player aims with (Aim Settings › Aiming Sources). */
export const AIMING_SOURCES = ['mouse', 'gyro', 'thumbstick'] as const;
export const AimingSource = z.enum(AIMING_SOURCES);
export type AimingSource = z.infer<typeof AimingSource>;

/** Flow C stage 1 / layer 2: setup checks. */
export const FoundationCheck = z.object({
  id: Id,
  title: z.string().min(1),
  platforms: z.array(Platform).min(1),
  /** Only for these output types. Empty: every output type on `platforms`. */
  outputTypes: z.array(OutputType).default([]),
  /** What the user does, in plain language. */
  check: z.string().min(1),
  why: Statement,
  fix: Statement.optional(),
  termIds: z.array(Id).default([]),
});

/**
 * Layer 2 inventory (CONCEPT.md §6): MATRIX settings outside the aim config, and whether
 * Dialed's foundation layer covers them. The statements say what the setting is and why it
 * is in or out.
 */
export const FoundationSetting = z.object({
  id: Id,
  /** As the guide spells it. */
  name: z.string().min(1),
  /** `global`: Manager's Global Settings. `config`: set per Config. */
  scope: z.enum(['global', 'config']),
  inLayer2: z.boolean(),
  statements: z.array(Statement).min(1),
  termIds: z.array(Id).default([]),
});
export const FoundationFile = z.object({
  checks: z.array(FoundationCheck),
  settings: z.array(FoundationSetting).default([]),
});

/** Flow C stage 2: symptom -> setting. */
export const Symptom = z.object({
  id: Id,
  /** How a player would say it. */
  label: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  termIds: z.array(Id).default([]),
  /** Setup checks (FoundationCheck ids) to run before tuning for this symptom. */
  checkIds: z.array(Id).default([]),
  /** Why this symptom points at these settings (confidence `gap` when unanswered). */
  mapping: Statement,
  /** The one change to try first, if any. */
  suggestedChange: Statement.optional(),
});
export const SymptomsFile = z.object({
  symptoms: z.array(Symptom),
  /** Flow C's closing guardrail: change one thing at a time (CONCEPT.md §5). */
  guardrail: Statement,
});

export const AimStyleId = z.enum(['tracking', 'snap', 'precision-hold']);
export type AimStyleId = z.infer<typeof AimStyleId>;

export const AimStyle = z.object({
  id: AimStyleId,
  name: z.string().min(1),
  description: z.string().min(1),
  favours: Statement,
  levers: z.array(
    z.object({
      termId: Id,
      direction: z.enum(['raise', 'lower', 'depends']),
      /** Only relevant when aiming with one of these (e.g. Stability: gyro). Absent: any. */
      aimingSources: z.array(AimingSource).min(1).optional(),
      statement: Statement,
    }),
  ),
});
export const AimStylesFile = z.object({ styles: z.array(AimStyle) });

/** XIM Central (MATRIX-era) notes attached to terms or symptoms. */
export const ExpertNote = z.object({
  id: Id,
  termIds: z.array(Id).default([]),
  symptomIds: z.array(Id).default([]),
  statement: Statement,
});
export const ExpertNotesFile = z.object({ notes: z.array(ExpertNote) });

// ---------------------------------------------------------------------------
// Destiny 2
// ---------------------------------------------------------------------------

/** The profile's preference inputs (CONCEPT.md §7) that the knowledge base must speak to. */
export const PreferenceInput = z.enum(['feel', 'sensitivity', 'focus', 'style']);
export type PreferenceInput = z.infer<typeof PreferenceInput>;

export const Destiny2GameFile = z.object({
  game: z.literal('destiny-2'),
  name: z.string().min(1),
  requiredSettings: z.array(z.object({ name: z.string().min(1), value: z.string().min(1), statement: Statement })),
  /** Sync method, SAB, platform differences and other game-level notes. */
  notes: z.array(z.object({ id: Id, title: z.string().min(1), statement: Statement })),
  /**
   * What each profile preference changes, or a gap saying no source lets it change anything.
   * Every PreferenceInput appears at least once (checked by integrity.ts).
   */
  preferences: z
    .array(z.object({ input: PreferenceInput, termIds: z.array(Id).default([]), statement: Statement }))
    .default([]),
});

export const WeaponSlot = z.enum(['kinetic', 'energy', 'power']);
export type WeaponSlot = z.infer<typeof WeaponSlot>;

export const WeaponArchetype = z.object({
  id: Id,
  name: z.string().min(1),
  /** null: no aim style applies (e.g. melee weapons). */
  aimStyle: AimStyleId.nullable(),
  /** Why this archetype maps to that aim style (normally `reasoned`; `gap` when it has none). */
  mapping: Statement,
});
export type WeaponArchetype = z.infer<typeof WeaponArchetype>;

export const WeaponsFile = z.object({
  slots: z.array(z.object({ id: WeaponSlot, name: z.string().min(1) })),
  archetypes: z.array(WeaponArchetype),
});

export const SourcesFile = z.object({ sources: z.array(Source) });

// ---------------------------------------------------------------------------
// Play: Crucible coaching (CONCEPT.md §5, Flow E)
// ---------------------------------------------------------------------------

/**
 * What a Play item rests on. Nothing in Play comes from XIM, so the §8 confidence labels don't
 * apply; each item names its basis instead, and the Play screen's legend says what each means.
 */
export const PLAY_BASES = ['fundamental', 'destiny', 'map', 'dialed'] as const;
export const PlayBasis = z.enum(PLAY_BASES);
export type PlayBasis = z.infer<typeof PlayBasis>;

/** When in a match a framework is run, in the order Play lists them. */
export const PLAY_MOMENTS = [
  'pre-match',
  'round-start',
  'engagement',
  'after-death',
  'between-rounds',
  'post-session',
] as const;
export const PlayMoment = z.enum(PLAY_MOMENTS);
export type PlayMoment = z.infer<typeof PlayMoment>;

/** A line of coaching with what it rests on. */
export const PlayNote = z.object({
  text: z.string().min(1),
  basis: PlayBasis,
});
export type PlayNote = z.infer<typeof PlayNote>;

/** A foundational idea: how a strong player thinks, and what that looks like in a round. */
export const PlayPrinciple = z.object({
  id: Id,
  title: z.string().min(1),
  /** The idea in one line, in the second person. */
  oneLiner: z.string().min(1),
  body: z.array(z.string().min(1)).min(1),
  /** What it looks like in a round, one observable behaviour per line. */
  inPlay: z.array(z.string().min(1)).default([]),
  basis: PlayBasis,
  /** Frameworks that put the principle into practice. */
  frameworkIds: z.array(Id).default([]),
});
export type PlayPrinciple = z.infer<typeof PlayPrinciple>;

/** One step of a framework: the words to say to yourself, what to do, and why. */
export const PlayStep = z.object({
  cue: z.string().min(1),
  action: z.string().min(1),
  why: z.string().min(1).optional(),
});
export type PlayStep = z.infer<typeof PlayStep>;

/** A decision procedure to run at one moment of a match. */
export const PlayFramework = z.object({
  id: Id,
  title: z.string().min(1),
  moment: PlayMoment,
  /** One line for the index card. */
  summary: z.string().min(1),
  /** What running it achieves. */
  goal: z.string().min(1),
  /** How long it should take, e.g. "10 seconds". */
  timeBudget: z.string().min(1).optional(),
  /** The one line to remember when there is no time for the steps. */
  rule: z.string().min(1),
  steps: z.array(PlayStep).min(1),
  /** What usually goes wrong. */
  mistakes: z.array(z.string().min(1)).default([]),
  /** Questions to ask yourself while running it. */
  checks: z.array(z.string().min(1)).default([]),
  notes: z.array(PlayNote).default([]),
  basis: PlayBasis,
  principleIds: z.array(Id).default([]),
  /** Related frameworks. */
  frameworkIds: z.array(Id).default([]),
});
export type PlayFramework = z.infer<typeof PlayFramework>;

/** A way a round is lost, tagged after a death and counted over a session. */
export const PlayDeathCause = z.object({
  id: Id,
  /** Short, so it fits a button. */
  label: z.string().min(1).max(32),
  meaning: z.string().min(1),
  /** The framework that works on it. */
  frameworkId: Id,
});
export type PlayDeathCause = z.infer<typeof PlayDeathCause>;

/** A range band: where a loadout wins, and the rule for fighting there. */
export const PlayBand = z.object({
  id: Id,
  name: z.string().min(1),
  range: z.string().min(1),
  rule: z.string().min(1),
  basis: PlayBasis,
});

/** How to play one weapon combination. */
export const PlayLoadoutPlan = z.object({
  id: Id,
  name: z.string().min(1),
  /** The job this loadout does for the team, in one line. */
  role: z.string().min(1),
  weapons: z.array(
    z.object({
      /** WeaponArchetype.id (destiny2/weapons.json). */
      archetypeId: Id,
      /** How the loadout uses it. */
      job: z.enum(['primary', 'special', 'heavy']),
      facts: z.array(PlayNote).min(1),
    }),
  ).min(1),
  bands: z.array(PlayBand).min(1),
  rules: z.array(PlayNote).default([]),
  frameworkIds: z.array(Id).default([]),
});
export type PlayLoadoutPlan = z.infer<typeof PlayLoadoutPlan>;

export const PlayCallout = z.object({
  id: Id,
  name: z.string().min(1),
  kind: z.enum(['spawn', 'interior', 'exterior', 'centre']),
  description: z.string().min(1),
  basis: PlayBasis,
});
export type PlayCallout = z.infer<typeof PlayCallout>;

/** A spot to hold: where to stand, which way to peek, what it exposes you to. */
export const PlaySpot = z.object({
  id: Id,
  name: z.string().min(1),
  calloutId: Id,
  /** Which spawn side it is for, or null for either. */
  spawnCalloutId: Id.nullable().default(null),
  holdFrom: z.string().min(1),
  peek: z.string().min(1),
  watches: z.string().min(1),
  watchedBy: z.string().min(1),
  why: z.string().min(1),
  basis: PlayBasis,
});
export type PlaySpot = z.infer<typeof PlaySpot>;

export const PlayPhase = z.object({
  id: Id,
  title: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
});

export const PlayMap = z.object({
  id: Id,
  name: z.string().min(1),
  summary: z.string().min(1),
  /** What the sources say the map plays like. */
  character: z.array(PlayNote).default([]),
  callouts: z.array(PlayCallout).min(1),
  spots: z.array(PlaySpot).default([]),
  phases: z.array(PlayPhase).default([]),
  /** What to confirm in a private match before trusting the card. */
  verify: z.array(z.string().min(1)).default([]),
  loadoutPlanIds: z.array(Id).default([]),
});
export type PlayMap = z.infer<typeof PlayMap>;

export const PlayFile = z.object({
  game: z.literal('destiny-2'),
  about: z.object({
    /** What Play is, for its index screen. */
    what: z.string().min(1),
    /** Why the §8 labels don't apply here, and what the basis tags mean instead. */
    basisNote: z.string().min(1),
     /** The framework the index puts first (PlayFramework.id). */
    startWith: Id.optional(),
  }),
  principles: z.array(PlayPrinciple),
  frameworks: z.array(PlayFramework),
  deathCauses: z.array(PlayDeathCause),
  loadoutPlans: z.array(PlayLoadoutPlan),
  maps: z.array(PlayMap),
});
