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
