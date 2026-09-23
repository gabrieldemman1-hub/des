/**
 * Cross-reference checks the schema can't express on its own: ids are unique, every
 * reference points at something that exists, every citation is consistent with the
 * source whitelist, and statements follow the evidence policy (CONCEPT.md §8).
 */
import type { Citation, KnowledgeFileName, ParsedKnowledgeFiles, Statement } from './index';
import { PreferenceInput } from './schema';

/**
 * The caveat every statement that gives an Easing direction must carry, word for word
 * (CONCEPT.md §6). `npm run check:release` fails while any statement still carries it,
 * because the direction has to be confirmed in-game before the app ships it.
 */
export const EASING_CAVEAT =
  "The official wording is ambiguous: we read 'lower response time' as less responsive because of the 'but'. Confirm in-game before relying on it.";

export interface StatementRef {
  file: KnowledgeFileName;
  /** The id (or name) of the entry the statement belongs to. */
  entryId: string;
  /** Where in the entry, e.g. `definition` or `levers.0.statement`. */
  field: string;
  statement: Statement;
}

export interface CitationRef extends Omit<StatementRef, 'statement'> {
  citation: Citation;
}

export interface IntegrityProblem {
  file: KnowledgeFileName;
  entryId: string;
  message: string;
}

const GLOSSARY_FILES = ['matrix/glossary-aim.json', 'matrix/glossary-setup.json'] as const;

/** Every Statement in the knowledge base, with where it lives. */
export function collectStatements(files: ParsedKnowledgeFiles): StatementRef[] {
  const out: StatementRef[] = [];
  const add = (file: KnowledgeFileName, entryId: string, field: string, statement: Statement | undefined) => {
    if (statement) out.push({ file, entryId, field, statement });
  };
  const addList = (file: KnowledgeFileName, entryId: string, field: string, list: readonly Statement[]) => {
    list.forEach((s, i) => add(file, entryId, `${field}.${i}`, s));
  };

  for (const file of GLOSSARY_FILES) {
    for (const term of files[file].terms) {
      add(file, term.id, 'definition', term.definition);
      addList(file, term.id, 'explanation', term.explanation);
      addList(file, term.id, 'feel', term.feel);
      addList(file, term.id, 'guidance', term.guidance);
      addList(file, term.id, 'aimStyles', term.aimStyles);
      term.notToBeConfusedWith.forEach((other, i) => add(file, term.id, `notToBeConfusedWith.${i}.statement`, other.statement));
    }
    for (const note of files[file].nameNotes) add(file, note.name, 'nameNotes.statement', note.statement);
  }
  for (const check of files['matrix/foundation.json'].checks) {
    add('matrix/foundation.json', check.id, 'why', check.why);
    add('matrix/foundation.json', check.id, 'fix', check.fix);
  }
  for (const setting of files['matrix/foundation.json'].settings) {
    addList('matrix/foundation.json', setting.id, 'settings.statements', setting.statements);
  }
  for (const symptom of files['matrix/symptoms.json'].symptoms) {
    add('matrix/symptoms.json', symptom.id, 'mapping', symptom.mapping);
    add('matrix/symptoms.json', symptom.id, 'suggestedChange', symptom.suggestedChange);
  }
  add('matrix/symptoms.json', '(guardrail)', 'guardrail', files['matrix/symptoms.json'].guardrail);
  for (const style of files['matrix/aim-styles.json'].styles) {
    add('matrix/aim-styles.json', style.id, 'favours', style.favours);
    style.levers.forEach((lever, i) => add('matrix/aim-styles.json', style.id, `levers.${i}.statement`, lever.statement));
  }
  for (const note of files['matrix/expert-notes.json'].notes) {
    add('matrix/expert-notes.json', note.id, 'statement', note.statement);
  }
  const game = files['destiny2/game.json'];
  for (const setting of game.requiredSettings) {
    add('destiny2/game.json', setting.name, 'requiredSettings.statement', setting.statement);
  }
  for (const note of game.notes) add('destiny2/game.json', note.id, 'notes.statement', note.statement);
  game.preferences.forEach((pref, i) => add('destiny2/game.json', `preference:${pref.input}`, `preferences.${i}.statement`, pref.statement));
  for (const archetype of files['destiny2/weapons.json'].archetypes) {
    add('destiny2/weapons.json', archetype.id, 'mapping', archetype.mapping);
  }
  return out;
}

/** Every citation in the knowledge base, with where it lives. */
export function collectCitations(files: ParsedKnowledgeFiles): CitationRef[] {
  return collectStatements(files).flatMap(({ statement, ...where }) =>
    statement.citations.map((citation) => ({ ...where, citation })),
  );
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/** Finds broken references and citation-policy violations. Empty means the data is consistent. */
export function findIntegrityProblems(files: ParsedKnowledgeFiles): IntegrityProblem[] {
  const problems: IntegrityProblem[] = [];
  const report = (file: KnowledgeFileName, entryId: string, message: string) => problems.push({ file, entryId, message });

  // --- ids unique per collection -------------------------------------------------------
  const unique = (collection: string, entries: { file: KnowledgeFileName; id: string }[]) => {
    const seen = new Map<string, KnowledgeFileName>();
    for (const { file, id } of entries) {
      const first = seen.get(id);
      if (first) report(file, id, `duplicate ${collection} id "${id}" (first defined in ${first})`);
      else seen.set(id, file);
    }
  };
  const withFile = <T extends { id: string }>(file: KnowledgeFileName, list: readonly T[]) =>
    list.map((item) => ({ file, id: item.id }));

  unique('source', withFile('sources.json', files['sources.json'].sources));
  unique('glossary term', GLOSSARY_FILES.flatMap((f) => withFile(f, files[f].terms)));
  unique('foundation check', withFile('matrix/foundation.json', files['matrix/foundation.json'].checks));
  unique('foundation setting', withFile('matrix/foundation.json', files['matrix/foundation.json'].settings));
  unique('symptom', withFile('matrix/symptoms.json', files['matrix/symptoms.json'].symptoms));
  unique('aim style', withFile('matrix/aim-styles.json', files['matrix/aim-styles.json'].styles));
  unique('expert note', withFile('matrix/expert-notes.json', files['matrix/expert-notes.json'].notes));
  unique('game note', withFile('destiny2/game.json', files['destiny2/game.json'].notes));
  unique('weapon slot', withFile('destiny2/weapons.json', files['destiny2/weapons.json'].slots));
  unique('weapon archetype', withFile('destiny2/weapons.json', files['destiny2/weapons.json'].archetypes));

  // --- references ----------------------------------------------------------------------
  const terms = new Map(GLOSSARY_FILES.flatMap((f) => files[f].terms.map((t) => [t.id, t] as const)));
  const termIds = new Set(terms.keys());
  const symptomIds = new Set(files['matrix/symptoms.json'].symptoms.map((s) => s.id));
  const styleIds = new Set<string>(files['matrix/aim-styles.json'].styles.map((s) => s.id));
  const checkIds = new Set(files['matrix/foundation.json'].checks.map((c) => c.id));

  const needTerm = (file: KnowledgeFileName, entryId: string, field: string, termId: string) => {
    if (!termIds.has(termId)) report(file, entryId, `${field} refers to unknown glossary term "${termId}"`);
  };

  for (const file of GLOSSARY_FILES) {
    for (const term of files[file].terms) {
      for (const id of term.related) {
        needTerm(file, term.id, 'related', id);
        // "See also" works the same whichever term you open.
        const other = terms.get(id);
        if (other && !other.related.includes(term.id)) {
          report(file, term.id, `related links to "${id}", but "${id}" doesn't link back`);
        }
      }
      term.notToBeConfusedWith.forEach((other, i) => {
        if (other.termId) needTerm(file, term.id, 'notToBeConfusedWith.termId', other.termId);
        // Without a term to point at, the entry is a claim of its own and must be sourced.
        else if (!other.statement) {
          report(file, term.id, `notToBeConfusedWith.${i} ("${other.name}") has no termId, so it needs a statement`);
        }
      });
    }
    for (const note of files[file].nameNotes) {
      if (note.termId) needTerm(file, note.name, 'nameNotes.termId', note.termId);
    }
  }
  for (const check of files['matrix/foundation.json'].checks) {
    for (const id of check.termIds) needTerm('matrix/foundation.json', check.id, 'termIds', id);
  }
  for (const setting of files['matrix/foundation.json'].settings) {
    for (const id of setting.termIds) needTerm('matrix/foundation.json', setting.id, 'termIds', id);
  }
  for (const symptom of files['matrix/symptoms.json'].symptoms) {
    for (const id of symptom.termIds) needTerm('matrix/symptoms.json', symptom.id, 'termIds', id);
    for (const id of symptom.checkIds) {
      if (!checkIds.has(id)) report('matrix/symptoms.json', symptom.id, `checkIds refers to unknown foundation check "${id}"`);
    }
  }
  const game = files['destiny2/game.json'];
  for (const pref of game.preferences) {
    for (const id of pref.termIds) needTerm('destiny2/game.json', `preference:${pref.input}`, 'termIds', id);
  }
  for (const input of PreferenceInput.options) {
    if (!game.preferences.some((p) => p.input === input)) {
      report('destiny2/game.json', `preference:${input}`, `no preferences entry for the profile input "${input}" (a gap statement if nothing can be sourced)`);
    }
  }
  for (const style of files['matrix/aim-styles.json'].styles) {
    for (const lever of style.levers) needTerm('matrix/aim-styles.json', style.id, 'levers.termId', lever.termId);
  }
  for (const note of files['matrix/expert-notes.json'].notes) {
    for (const id of note.termIds) needTerm('matrix/expert-notes.json', note.id, 'termIds', id);
    for (const id of note.symptomIds) {
      if (!symptomIds.has(id)) report('matrix/expert-notes.json', note.id, `symptomIds refers to unknown symptom "${id}"`);
    }
  }
  for (const archetype of files['destiny2/weapons.json'].archetypes) {
    if (archetype.aimStyle !== null && !styleIds.has(archetype.aimStyle)) {
      report('destiny2/weapons.json', archetype.id, `aimStyle "${archetype.aimStyle}" is not defined in matrix/aim-styles.json`);
    }
  }

  // --- citations -----------------------------------------------------------------------
  const sources = new Map(files['sources.json'].sources.map((s) => [s.id, s]));
  for (const { file, entryId, field, citation } of collectCitations(files)) {
    const where = `${field}: citation of "${citation.source}"`;
    const source = sources.get(citation.source);
    if (!source) {
      report(file, entryId, `${where} names a source that is not in sources.json`);
      continue;
    }
    const host = hostnameOf(citation.url);
    if (!host || !source.hosts.includes(host)) {
      report(file, entryId, `${where} points at host "${host ?? citation.url}", which is not one of ${source.id}'s hosts (${source.hosts.join(', ')})`);
    }
    if (source.tier === 'expert' && citation.matrixEra !== true) {
      report(file, entryId, `${where} cites an expert source without "matrixEra": true`);
    }
    if (source.tier !== 'expert' && citation.matrixEra !== undefined) {
      report(file, entryId, `${where} sets "matrixEra", which only applies to expert sources`);
    }
  }

  // --- evidence policy (CONCEPT.md §6 and §8) --------------------------------------------
  for (const { file, entryId, field, statement } of collectStatements(files)) {
    const where = `${field} (${statement.confidence})`;
    if (statement.confidence === 'reasoned' && statement.citations.length === 0 && !statement.caveat?.trim()) {
      report(file, entryId, `${where} cites no definitions, so it needs a caveat saying why`);
    }
    if (statement.confidence === 'contested' && new Set(statement.citations.map((c) => c.source)).size < 2) {
      report(file, entryId, `${where} must cite at least two different sources (both positions)`);
    }
    if (givesEasingDirection(statement) && !statement.caveat?.includes(EASING_CAVEAT)) {
      report(file, entryId, `${where} gives an Easing direction without the Easing caveat`);
    }
  }
  for (const style of files['matrix/aim-styles.json'].styles) {
    style.levers.forEach((lever, i) => {
      if (lever.termId === 'easing' && !lever.statement.caveat?.includes(EASING_CAVEAT)) {
        report('matrix/aim-styles.json', style.id, `levers.${i} is an Easing lever without the Easing caveat`);
      }
    });
  }

  return problems;
}

const DIRECTION = /\b(?:rais(?:e|es|ed|ing)|lower(?:s|ed|ing)?|higher|increas(?:e|es|ed|ing)|decreas(?:e|es|ed|ing)|reduc(?:e|es|ed|ing))\b/i;

/**
 * True when a sentence of the statement's text or reasoning names Easing together with a
 * direction word (raise, lower, higher…): the statements CONCEPT.md §6 says must carry the
 * Easing caveat.
 */
export function givesEasingDirection(statement: Statement): boolean {
  const sentences = [statement.text, statement.reasoning ?? ''].flatMap((t) => t.split(/(?<=[.!?])\s+/));
  return sentences.some((sentence) => /\beasing\b/i.test(sentence) && DIRECTION.test(sentence));
}

export function formatProblem(p: { file: string; entryId: string; message: string }): string {
  return `knowledge/${p.file} › ${p.entryId}: ${p.message}`;
}
