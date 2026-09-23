/**
 * Loads the knowledge base: imports every JSON data file, parses it with its schema from
 * `schema.ts`, merges the two glossary files into one glossary, and exports typed data plus
 * lookup helpers.
 *
 * A file that fails its schema is replaced by an empty fallback and reported in
 * `knowledgeIssues`, so a half-written data file can't crash the app. The tests in
 * `knowledge.test.ts` fail on any issue, so broken data never ships.
 */
import type { z } from 'zod';
import sourcesJson from './sources.json';
import gameJson from './destiny2/game.json';
import weaponsJson from './destiny2/weapons.json';
import aimStylesJson from './matrix/aim-styles.json';
import expertNotesJson from './matrix/expert-notes.json';
import foundationJson from './matrix/foundation.json';
import glossaryAimJson from './matrix/glossary-aim.json';
import glossarySetupJson from './matrix/glossary-setup.json';
import symptomsJson from './matrix/symptoms.json';
import {
  AimStylesFile,
  Destiny2GameFile,
  ExpertNotesFile,
  FoundationFile,
  GlossaryFile,
  SourcesFile,
  SymptomsFile,
  WeaponsFile,
} from './schema';
import type { AimStyleId, GlossaryTerm, Source, WeaponArchetype, WeaponSlot } from './schema';

export type { AimStyleId, Citation, Confidence, GlossaryTerm, Platform, Source, Statement, WeaponArchetype, WeaponSlot } from './schema';
export { CONFIDENCE_LEVELS } from './schema';

export type SourcesData = z.infer<typeof SourcesFile>;
export type GlossaryData = z.infer<typeof GlossaryFile>;
export type NameNote = GlossaryData['nameNotes'][number];
export type FoundationData = z.infer<typeof FoundationFile>;
export type FoundationCheck = FoundationData['checks'][number];
export type SymptomsData = z.infer<typeof SymptomsFile>;
export type Symptom = SymptomsData['symptoms'][number];
export type AimStylesData = z.infer<typeof AimStylesFile>;
export type AimStyle = AimStylesData['styles'][number];
export type ExpertNotesData = z.infer<typeof ExpertNotesFile>;
export type ExpertNote = ExpertNotesData['notes'][number];
export type Destiny2Game = z.infer<typeof Destiny2GameFile>;
export type WeaponsData = z.infer<typeof WeaponsFile>;
export type SlotInfo = WeaponsData['slots'][number];

/** Every data file, keyed by its path relative to `knowledge/`, with its schema. */
export const KNOWLEDGE_SCHEMAS = {
  'sources.json': SourcesFile,
  'destiny2/game.json': Destiny2GameFile,
  'destiny2/weapons.json': WeaponsFile,
  'matrix/aim-styles.json': AimStylesFile,
  'matrix/expert-notes.json': ExpertNotesFile,
  'matrix/foundation.json': FoundationFile,
  'matrix/glossary-aim.json': GlossaryFile,
  'matrix/glossary-setup.json': GlossaryFile,
  'matrix/symptoms.json': SymptomsFile,
} as const;

export type KnowledgeFileName = keyof typeof KNOWLEDGE_SCHEMAS;
export type RawKnowledgeFiles = Record<KnowledgeFileName, unknown>;
export type ParsedKnowledgeFiles = { [F in KnowledgeFileName]: z.infer<(typeof KNOWLEDGE_SCHEMAS)[F]> };

/** The raw JSON as imported (before validation). */
export const rawKnowledgeFiles: RawKnowledgeFiles = {
  'sources.json': sourcesJson,
  'destiny2/game.json': gameJson,
  'destiny2/weapons.json': weaponsJson,
  'matrix/aim-styles.json': aimStylesJson,
  'matrix/expert-notes.json': expertNotesJson,
  'matrix/foundation.json': foundationJson,
  'matrix/glossary-aim.json': glossaryAimJson,
  'matrix/glossary-setup.json': glossarySetupJson,
  'matrix/symptoms.json': symptomsJson,
};

const DEFAULT_SLOTS: SlotInfo[] = [
  { id: 'kinetic', name: 'Kinetic' },
  { id: 'energy', name: 'Energy' },
  { id: 'power', name: 'Power' },
];

/** What a file becomes when it fails validation: valid, and empty. */
const EMPTY_FILES: ParsedKnowledgeFiles = {
  'sources.json': { sources: [] },
  'destiny2/game.json': { game: 'destiny-2', name: 'Destiny 2', requiredSettings: [], notes: [] },
  'destiny2/weapons.json': { slots: DEFAULT_SLOTS, archetypes: [] },
  'matrix/aim-styles.json': { styles: [] },
  'matrix/expert-notes.json': { notes: [] },
  'matrix/foundation.json': { checks: [] },
  'matrix/glossary-aim.json': { terms: [], nameNotes: [] },
  'matrix/glossary-setup.json': { terms: [], nameNotes: [] },
  'matrix/symptoms.json': { symptoms: [] },
};

export interface KnowledgeIssue {
  file: KnowledgeFileName;
  /** Dotted path inside the file, e.g. `terms.3.definition`. */
  path: string;
  message: string;
}

/** Parses every file with its schema. Invalid files become empty and are listed in `issues`. */
export function parseKnowledgeFiles(raw: RawKnowledgeFiles): { files: ParsedKnowledgeFiles; issues: KnowledgeIssue[] } {
  const issues: KnowledgeIssue[] = [];
  const files = {} as Record<KnowledgeFileName, unknown>;
  for (const name of Object.keys(KNOWLEDGE_SCHEMAS) as KnowledgeFileName[]) {
    const result = KNOWLEDGE_SCHEMAS[name].safeParse(raw[name]);
    if (result.success) {
      files[name] = result.data;
    } else {
      files[name] = EMPTY_FILES[name];
      for (const issue of result.error.issues) {
        issues.push({ file: name, path: issue.path.map(String).join('.'), message: issue.message });
      }
    }
  }
  return { files: files as ParsedKnowledgeFiles, issues };
}

export interface KnowledgeBase {
  sources: Source[];
  /** glossary-aim.json and glossary-setup.json merged. */
  glossary: { terms: GlossaryTerm[]; nameNotes: NameNote[] };
  foundation: FoundationCheck[];
  symptoms: Symptom[];
  aimStyles: AimStyle[];
  expertNotes: ExpertNote[];
  game: Destiny2Game;
  weapons: { slots: SlotInfo[]; archetypes: WeaponArchetype[] };
}

export function mergeKnowledge(files: ParsedKnowledgeFiles): KnowledgeBase {
  const aim = files['matrix/glossary-aim.json'];
  const setup = files['matrix/glossary-setup.json'];
  const weapons = files['destiny2/weapons.json'];
  return {
    sources: files['sources.json'].sources,
    glossary: {
      terms: [...aim.terms, ...setup.terms],
      nameNotes: [...aim.nameNotes, ...setup.nameNotes],
    },
    foundation: files['matrix/foundation.json'].checks,
    symptoms: files['matrix/symptoms.json'].symptoms,
    aimStyles: files['matrix/aim-styles.json'].styles,
    expertNotes: files['matrix/expert-notes.json'].notes,
    game: files['destiny2/game.json'],
    weapons: { slots: weapons.slots.length > 0 ? weapons.slots : DEFAULT_SLOTS, archetypes: weapons.archetypes },
  };
}

export interface KnowledgeLookups {
  termById: (id: string) => GlossaryTerm | undefined;
  symptomById: (id: string) => Symptom | undefined;
  archetypeById: (id: string) => WeaponArchetype | undefined;
  sourceById: (id: string) => Source | undefined;
  aimStyleById: (id: AimStyleId) => AimStyle | undefined;
  slotName: (id: WeaponSlot) => string;
}

function indexBy<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  // First occurrence wins; duplicate ids are reported by the integrity tests.
  for (const item of items) if (!map.has(item.id)) map.set(item.id, item);
  return map;
}

export function createLookups(kb: KnowledgeBase): KnowledgeLookups {
  const terms = indexBy(kb.glossary.terms);
  const symptoms = indexBy(kb.symptoms);
  const archetypes = indexBy(kb.weapons.archetypes);
  const sources = indexBy(kb.sources);
  const styles = indexBy(kb.aimStyles);
  const slots = indexBy(kb.weapons.slots);
  return {
    termById: (id) => terms.get(id),
    symptomById: (id) => symptoms.get(id),
    archetypeById: (id) => archetypes.get(id),
    sourceById: (id) => sources.get(id),
    aimStyleById: (id) => styles.get(id),
    slotName: (id) => slots.get(id)?.name ?? id,
  };
}

const parsed = parseKnowledgeFiles(rawKnowledgeFiles);

/** The parsed files, one entry per JSON file (the glossary files are still separate here). */
export const knowledgeFiles: ParsedKnowledgeFiles = parsed.files;
/** Schema problems found while loading. Empty when the data is valid. */
export const knowledgeIssues: readonly KnowledgeIssue[] = parsed.issues;
/** The merged, typed knowledge base the app uses. */
export const knowledge: KnowledgeBase = mergeKnowledge(parsed.files);

const lookups = createLookups(knowledge);
export const termById = lookups.termById;
export const symptomById = lookups.symptomById;
export const archetypeById = lookups.archetypeById;
export const sourceById = lookups.sourceById;
export const aimStyleById = lookups.aimStyleById;
export const slotName = lookups.slotName;
