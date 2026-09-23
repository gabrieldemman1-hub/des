/**
 * Cross-reference checks the schema can't express on its own: ids are unique, every
 * reference points at something that exists, and every citation is consistent with the
 * source whitelist (CONCEPT.md §8).
 */
import type { Citation, KnowledgeFileName, ParsedKnowledgeFiles, Statement } from './index';

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
    }
  }
  for (const check of files['matrix/foundation.json'].checks) {
    add('matrix/foundation.json', check.id, 'why', check.why);
    add('matrix/foundation.json', check.id, 'fix', check.fix);
  }
  for (const symptom of files['matrix/symptoms.json'].symptoms) {
    add('matrix/symptoms.json', symptom.id, 'mapping', symptom.mapping);
    add('matrix/symptoms.json', symptom.id, 'suggestedChange', symptom.suggestedChange);
  }
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
  unique('symptom', withFile('matrix/symptoms.json', files['matrix/symptoms.json'].symptoms));
  unique('aim style', withFile('matrix/aim-styles.json', files['matrix/aim-styles.json'].styles));
  unique('expert note', withFile('matrix/expert-notes.json', files['matrix/expert-notes.json'].notes));
  unique('game note', withFile('destiny2/game.json', files['destiny2/game.json'].notes));
  unique('weapon slot', withFile('destiny2/weapons.json', files['destiny2/weapons.json'].slots));
  unique('weapon archetype', withFile('destiny2/weapons.json', files['destiny2/weapons.json'].archetypes));

  // --- references ----------------------------------------------------------------------
  const termIds = new Set(GLOSSARY_FILES.flatMap((f) => files[f].terms.map((t) => t.id)));
  const symptomIds = new Set(files['matrix/symptoms.json'].symptoms.map((s) => s.id));
  const styleIds = new Set<string>(files['matrix/aim-styles.json'].styles.map((s) => s.id));

  const needTerm = (file: KnowledgeFileName, entryId: string, field: string, termId: string) => {
    if (!termIds.has(termId)) report(file, entryId, `${field} refers to unknown glossary term "${termId}"`);
  };

  for (const file of GLOSSARY_FILES) {
    for (const term of files[file].terms) {
      for (const id of term.related) needTerm(file, term.id, 'related', id);
      for (const other of term.notToBeConfusedWith) {
        if (other.termId) needTerm(file, term.id, 'notToBeConfusedWith.termId', other.termId);
      }
    }
  }
  for (const check of files['matrix/foundation.json'].checks) {
    for (const id of check.termIds) needTerm('matrix/foundation.json', check.id, 'termIds', id);
  }
  for (const symptom of files['matrix/symptoms.json'].symptoms) {
    for (const id of symptom.termIds) needTerm('matrix/symptoms.json', symptom.id, 'termIds', id);
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
    if (!styleIds.has(archetype.aimStyle)) {
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
  }

  return problems;
}

export function formatProblem(p: { file: string; entryId: string; message: string }): string {
  return `knowledge/${p.file} › ${p.entryId}: ${p.message}`;
}
