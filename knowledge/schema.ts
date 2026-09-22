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

export const GlossaryTerm = z.object({
  id: Id,
  /** Spelled exactly as XIM MATRIX Manager / the official guide spells it. */
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
  notToBeConfusedWith: z
    .array(z.object({ name: z.string().min(1), termId: Id.optional(), note: z.string().min(1) }))
    .default([]),
  related: z.array(Id).default([]),
});
export type GlossaryTerm = z.infer<typeof GlossaryTerm>;

export const GlossaryFile = z.object({
  terms: z.array(GlossaryTerm),
  /** Names people meet (e.g. from older XIM devices) that are not MATRIX settings. */
  nameNotes: z.array(z.object({ name: z.string().min(1), note: z.string().min(1) })).default([]),
});

export const Platform = z.enum(['xbox', 'pc']);
export type Platform = z.infer<typeof Platform>;

/** Flow C stage 1 / layer 2: setup checks. */
export const FoundationCheck = z.object({
  id: Id,
  title: z.string().min(1),
  platforms: z.array(Platform).min(1),
  /** What the user does, in plain language. */
  check: z.string().min(1),
  why: Statement,
  fix: Statement.optional(),
  termIds: z.array(Id).default([]),
});
export const FoundationFile = z.object({ checks: z.array(FoundationCheck) });

/** Flow C stage 2: symptom -> setting. */
export const Symptom = z.object({
  id: Id,
  /** How a player would say it. */
  label: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  termIds: z.array(Id).default([]),
  /** Why this symptom points at these settings (confidence `gap` when unanswered). */
  mapping: Statement,
  /** The one change to try first, if any. */
  suggestedChange: Statement.optional(),
});
export const SymptomsFile = z.object({ symptoms: z.array(Symptom) });

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

export const Destiny2GameFile = z.object({
  game: z.literal('destiny-2'),
  name: z.string().min(1),
  requiredSettings: z.array(z.object({ name: z.string().min(1), value: z.string().min(1), statement: Statement })),
  /** Sync method, SAB, platform differences and other game-level notes. */
  notes: z.array(z.object({ id: Id, title: z.string().min(1), statement: Statement })),
});

export const WeaponSlot = z.enum(['kinetic', 'energy', 'power']);
export type WeaponSlot = z.infer<typeof WeaponSlot>;

export const WeaponArchetype = z.object({
  id: Id,
  name: z.string().min(1),
  aimStyle: AimStyleId,
  /** Why this archetype maps to that aim style (normally `reasoned`). */
  mapping: Statement,
});
export type WeaponArchetype = z.infer<typeof WeaponArchetype>;

export const WeaponsFile = z.object({
  slots: z.array(z.object({ id: WeaponSlot, name: z.string().min(1) })),
  archetypes: z.array(WeaponArchetype),
});

export const SourcesFile = z.object({ sources: z.array(Source) });
