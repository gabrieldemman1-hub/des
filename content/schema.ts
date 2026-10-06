import { z } from 'zod';

/**
 * Primer's evidence contract. Every sentence the guide shows about a setting is a Statement:
 * plain text, a confidence label, and the citations behind it. The rules below are the evidence
 * policy in CONCEPT.md; integrity.ts adds the checks that span files.
 */

export const CONFIDENCE_LEVELS = ['official', 'expert', 'contested', 'reasoned', 'gap'] as const;
export const Confidence = z.enum(CONFIDENCE_LEVELS);
export type Confidence = z.infer<typeof Confidence>;

export const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ids are kebab-case');

export const SourceTier = z.enum(['official', 'official-by-reference', 'official-inferred', 'expert']);
export type SourceTier = z.infer<typeof SourceTier>;

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
  /** Required (and true) for an `expert` source: XIM MATRIX-era material only. */
  matrixEra: z.literal(true).optional(),
  note: z.string().optional(),
});
export type Citation = z.infer<typeof Citation>;

export const Statement = z
  .object({
    /** What the guide shows, in plain words. */
    text: z.string().min(1),
    confidence: Confidence,
    citations: z.array(Citation),
    /** Required for `reasoned`: how the text follows from what is cited. */
    reasoning: z.string().optional(),
    /** What the reader must know before relying on the statement. */
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
        need(!!s.reasoning?.trim(), 'reasoned statements explain their reasoning');
        break;
      case 'gap':
        need(s.citations.length === 0, 'gap statements have no citations');
        break;
    }
  });
export type Statement = z.infer<typeof Statement>;

/**
 * A name that means something else. With `settingId` it points at that setting and `note` says
 * in a line how the two differ; without one, the entry carries its own sourced `statement`.
 */
export const Confusion = z
  .object({
    name: z.string().min(1),
    settingId: Id.optional(),
    note: z.string().min(1).optional(),
    statement: Statement.optional(),
  })
  .refine((c) => c.note !== undefined || c.statement !== undefined, {
    message: 'a confusion needs a note or a statement',
  });
export type Confusion = z.infer<typeof Confusion>;

/** One page of the guide: a setting, or a MATRIX concept that sits on a Manager screen. */
export const Setting = z.object({
  id: Id,
  name: z.string().min(1),
  /** Other names people use for it, for search. */
  aliases: z.array(z.string().min(1)),
  /** One line under the name: what it is, in plain words. Restates the definition. */
  summary: z.string().min(1),
  /** Where it is in Manager, with the guide's words for it. */
  where: Statement,
  /** XIM's own definition, quoted. */
  definition: Statement.nullable(),
  /** The definition in plain words, and what follows from it. */
  plainWords: z.array(Statement),
  /** What changing it feels like. */
  feel: z.array(Statement),
  /** What XIM or experts recommend, or that no one does. */
  guidance: z.array(Statement),
  /** What it means for tracking, snap and precision-hold aim. */
  aimStyles: z.array(Statement),
  confusions: z.array(Confusion),
  /** Other settings worth reading next. */
  related: z.array(Id),
});
export type Setting = z.infer<typeof Setting>;

export const AimStyleId = z.enum(['tracking', 'snap', 'precision-hold']);
export type AimStyleId = z.infer<typeof AimStyleId>;

export const AimingSource = z.enum(['mouse', 'gyro', 'thumbstick']);

export const Lever = z.object({
  settingId: Id,
  direction: z.enum(['raise', 'lower', 'depends']),
  /** The aiming sources the setting applies to; absent means all of them. */
  aimingSources: z.array(AimingSource).optional(),
  statement: Statement,
});
export type Lever = z.infer<typeof Lever>;

/** A Destiny 2 weapon type and the aim style its firing suggests. */
export const Weapon = z.object({
  name: z.string().min(1),
  mapping: Statement,
});

export const AimStyle = z.object({
  id: AimStyleId,
  name: z.string().min(1),
  description: z.string().min(1),
  favours: Statement,
  levers: z.array(Lever),
  weapons: z.array(Weapon),
});
export type AimStyle = z.infer<typeof AimStyle>;

/** One way to move a setting toward a dial's end, with the sentence that says so. */
export const Move = z.object({
  direction: z.enum(['raise', 'lower', 'on', 'off']),
  statement: Statement,
});
export type Move = z.infer<typeof Move>;

/**
 * A setting on a dial: what to do with it toward end A and toward end B. `null` means no source
 * gives a direction that way.
 */
export const DialLever = z
  .object({
    settingId: Id,
    /** The aiming sources the setting applies to; absent means all of them. */
    aimingSources: z.array(AimingSource).optional(),
    a: Move.nullable(),
    b: Move.nullable(),
  })
  .refine((l) => l.a !== null || l.b !== null, { message: 'a dial lever needs a move toward at least one end' });
export type DialLever = z.infer<typeof DialLever>;

/**
 * A dial on the Tuning page: two ends in XIM's words, the settings that move between them, and
 * where XIM says to start. It explains which way each setting moves; it holds no values and
 * nothing the reader does with it is kept.
 */
export const Dial = z.object({
  id: Id,
  name: z.string().min(1),
  /** Its place on the Tuning page, 1 first. */
  order: z.number().int().positive(),
  /** One line under the name. */
  summary: z.string().min(1),
  /** The two ends, in XIM's words for the effect. */
  ends: z.object({ a: z.string().min(1), b: z.string().min(1) }),
  /** What these settings are and when they apply. */
  intro: Statement,
  /** Where XIM says to start, shown between the ends. */
  start: Statement,
  levers: z.array(DialLever).min(1),
  /** What to know before moving anything: limits, gaps, the only numbers XIM gives. */
  notes: z.array(Statement),
});
export type Dial = z.infer<typeof Dial>;

/** A name people use that the guide doesn't list as a setting. */
export const NameNote = z.object({
  name: z.string().min(1),
  settingId: Id.optional(),
  statement: Statement,
});
export type NameNote = z.infer<typeof NameNote>;

/** The home map: the guide's chapters and Manager screens, in the guide's order. */
export const MapGroup = z.object({
  /** Shown over the settings when a screen has several groups, e.g. "Smoothing". */
  label: z.string().min(1).optional(),
  settings: z.array(Id).min(1),
});

export const Screen = z.object({
  id: Id,
  name: z.string().min(1),
  /** The guide page for this screen. */
  guideUrl: z.url(),
  groups: z.array(MapGroup).min(1),
});
export type Screen = z.infer<typeof Screen>;

export const Chapter = z.object({
  id: Id,
  name: z.string().min(1),
  screens: z.array(Screen).min(1),
});
export type Chapter = z.infer<typeof Chapter>;

export const GuideMap = z.object({ chapters: z.array(Chapter).min(1) });
export type GuideMap = z.infer<typeof GuideMap>;
