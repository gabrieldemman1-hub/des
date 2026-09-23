/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access --
   the fixtures below are untyped JSON, edited in place to break one rule at a time. */
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_SCHEMAS,
  createLookups,
  knowledge,
  knowledgeFiles,
  knowledgeIssues,
  mergeKnowledge,
  parseKnowledgeFiles,
  rawKnowledgeFiles,
  type KnowledgeFileName,
  type RawKnowledgeFiles,
} from './index';
import { collectCitations, findIntegrityProblems, formatProblem } from './integrity';

const knowledgeDir = fileURLToPath(new URL('.', import.meta.url));
const fileNames = Object.keys(KNOWLEDGE_SCHEMAS) as KnowledgeFileName[];

function jsonFilesOnDisk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return jsonFilesOnDisk(full);
    return entry.name.endsWith('.json') ? [relative(knowledgeDir, full).split(sep).join('/')] : [];
  });
}

describe('knowledge base data (the real files)', () => {
  it('registers every JSON file in knowledge/ with a schema', () => {
    expect(jsonFilesOnDisk(knowledgeDir).sort()).toEqual([...fileNames].sort());
  });

  it.each(fileNames)('%s matches its schema', (name) => {
    const result = KNOWLEDGE_SCHEMAS[name].safeParse(rawKnowledgeFiles[name]);
    const issues = result.success
      ? []
      : result.error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
    expect(issues).toEqual([]);
  });

  it('loads without issues', () => {
    expect(knowledgeIssues).toEqual([]);
  });

  it('has consistent cross-references and citations', () => {
    expect(findIntegrityProblems(knowledgeFiles).map(formatProblem)).toEqual([]);
  });

  it('merges both glossary files into one glossary', () => {
    const expected =
      knowledgeFiles['matrix/glossary-aim.json'].terms.length + knowledgeFiles['matrix/glossary-setup.json'].terms.length;
    expect(knowledge.glossary.terms).toHaveLength(expected);
  });

  it('always has the three Destiny 2 weapon slots', () => {
    expect(knowledge.weapons.slots.map((s) => s.id)).toEqual(['kinetic', 'energy', 'power']);
  });
});

// ---------------------------------------------------------------------------------------
// The checks themselves, exercised on small fixtures (the real data may still be empty).
// ---------------------------------------------------------------------------------------

const GUIDE = 'https://guide.xim.tech/';

function official(text: string, url = `${GUIDE}#smoothing`, source = 'xim-guide') {
  return { text, confidence: 'official', citations: [{ source, url, quote: text }] };
}

function validRaw(): RawKnowledgeFiles {
  return {
    'sources.json': {
      sources: [
        {
          id: 'xim-guide',
          title: 'XIM MATRIX User Guide',
          publisher: 'XIM Technologies',
          url: GUIDE,
          hosts: ['guide.xim.tech'],
          tier: 'official',
          accessed: '2026-09-22',
        },
        {
          id: 'xim-central',
          title: 'XIM Central',
          publisher: 'Independent creator',
          url: 'https://www.youtube.com/@XIMCentral',
          hosts: ['www.youtube.com'],
          tier: 'expert',
          accessed: '2026-09-22',
        },
      ],
    },
    'destiny2/game.json': {
      game: 'destiny-2',
      name: 'Destiny 2',
      requiredSettings: [],
      notes: [{ id: 'sync', title: 'Sync', statement: official('Use Standard sync.') }],
    },
    'destiny2/weapons.json': {
      slots: [
        { id: 'kinetic', name: 'Kinetic' },
        { id: 'energy', name: 'Energy' },
        { id: 'power', name: 'Power' },
      ],
      archetypes: [
        {
          id: 'pulse-rifle',
          name: 'Pulse Rifle',
          aimStyle: 'tracking',
          mapping: { text: 'Bursts need tracking.', confidence: 'reasoned', citations: [], reasoning: 'Sustained fire.' },
        },
      ],
    },
    'matrix/aim-styles.json': {
      styles: [
        {
          id: 'tracking',
          name: 'Tracking',
          description: 'Hold on target.',
          favours: { text: 'Stable micro-corrections.', confidence: 'reasoned', citations: [], reasoning: 'Because.' },
          levers: [
            {
              termId: 'precision',
              direction: 'raise',
              statement: { text: 'Raise Precision.', confidence: 'reasoned', citations: [], reasoning: 'Fine aim.' },
            },
          ],
        },
      ],
    },
    'matrix/expert-notes.json': {
      notes: [
        {
          id: 'central-precision',
          termIds: ['precision'],
          symptomIds: ['jitter'],
          statement: {
            text: 'XIM Central says so.',
            confidence: 'expert',
            citations: [
              { source: 'xim-central', url: 'https://www.youtube.com/watch?v=abc', quote: 'so', matrixEra: true },
            ],
          },
        },
      ],
    },
    'matrix/foundation.json': {
      checks: [
        {
          id: 'check-dpi',
          title: 'Check DPI',
          platforms: ['xbox', 'pc'],
          check: 'Run Check DPI.',
          why: official('DPI must match.'),
          termIds: ['precision'],
        },
      ],
    },
    'matrix/glossary-aim.json': {
      terms: [
        {
          id: 'precision',
          name: 'Precision',
          category: 'smoothing',
          summary: 'Fine aim behavior.',
          definition: official('Precision controls fine aim behavior.'),
          related: ['check-rate'],
          notToBeConfusedWith: [{ name: 'Check Rate', termId: 'check-rate', note: 'Different thing.' }],
        },
      ],
      nameNotes: [{ name: 'Steady Aim', note: 'An XIM APEX setting.' }],
    },
    'matrix/glossary-setup.json': {
      terms: [
        {
          id: 'check-rate',
          name: 'Check Rate',
          category: 'diagnostics',
          summary: 'Measures polling rate.',
          definition: official('Check Rate measures your mouse.'),
        },
      ],
      nameNotes: [],
    },
    'matrix/symptoms.json': {
      symptoms: [
        {
          id: 'jitter',
          label: 'Jitter on small movements',
          termIds: ['precision'],
          mapping: official('Smoothing counters hand jitter.'),
        },
      ],
    },
  };
}

/** A deep copy of the valid fixture with one file replaced. */
function withFile(name: KnowledgeFileName, edit: (file: Record<string, unknown>) => void): RawKnowledgeFiles {
  const raw = structuredClone(validRaw());
  edit(raw[name] as Record<string, unknown>);
  return raw;
}

function problemsFor(raw: RawKnowledgeFiles): string[] {
  const { files, issues } = parseKnowledgeFiles(raw);
  expect(issues).toEqual([]);
  return findIntegrityProblems(files).map(formatProblem);
}

describe('integrity checks', () => {
  it('accept a consistent knowledge base', () => {
    expect(problemsFor(validRaw())).toEqual([]);
  });

  it('flag duplicate ids, including across the two glossary files', () => {
    const raw = withFile('matrix/glossary-setup.json', (f: any) => {
      f.terms[0].id = 'precision';
    });
    expect(problemsFor(raw)).toEqual(
      expect.arrayContaining([expect.stringContaining('duplicate glossary term id "precision"')]),
    );
  });

  it('flag unknown related and notToBeConfusedWith term ids', () => {
    const raw = withFile('matrix/glossary-aim.json', (f: any) => {
      f.terms[0].related = ['nope'];
      f.terms[0].notToBeConfusedWith[0].termId = 'also-nope';
    });
    const problems = problemsFor(raw);
    expect(problems).toContainEqual(expect.stringContaining('related refers to unknown glossary term "nope"'));
    expect(problems).toContainEqual(
      expect.stringContaining('notToBeConfusedWith.termId refers to unknown glossary term "also-nope"'),
    );
  });

  it('flag unknown termIds in checks, symptoms, notes and levers', () => {
    const raw = structuredClone(validRaw()) as any;
    raw['matrix/foundation.json'].checks[0].termIds = ['ghost-a'];
    raw['matrix/symptoms.json'].symptoms[0].termIds = ['ghost-b'];
    raw['matrix/expert-notes.json'].notes[0].termIds = ['ghost-c'];
    raw['matrix/aim-styles.json'].styles[0].levers[0].termId = 'ghost-d';
    const problems = problemsFor(raw as RawKnowledgeFiles).join('\n');
    for (const ghost of ['ghost-a', 'ghost-b', 'ghost-c', 'ghost-d']) expect(problems).toContain(`"${ghost}"`);
  });

  it('flag unknown symptom ids in expert notes', () => {
    const raw = withFile('matrix/expert-notes.json', (f: any) => {
      f.notes[0].symptomIds = ['floaty'];
    });
    expect(problemsFor(raw)).toContainEqual(expect.stringContaining('unknown symptom "floaty"'));
  });

  it('flag archetypes whose aim style is not defined', () => {
    const raw = withFile('matrix/aim-styles.json', (f: any) => {
      f.styles = [];
    });
    expect(problemsFor(raw)).toContainEqual(expect.stringContaining('aimStyle "tracking" is not defined'));
  });

  it('flag citations of sources that are not whitelisted', () => {
    const raw = withFile('matrix/symptoms.json', (f: any) => {
      f.symptoms[0].mapping.citations[0].source = 'random-forum';
    });
    expect(problemsFor(raw)).toContainEqual(expect.stringContaining('not in sources.json'));
  });

  it("flag citation urls outside the source's hosts", () => {
    const raw = withFile('matrix/glossary-aim.json', (f: any) => {
      f.terms[0].definition.citations[0].url = 'https://example.com/precision';
    });
    expect(problemsFor(raw)).toContainEqual(expect.stringContaining('host "example.com"'));
  });

  it('flag expert citations without matrixEra', () => {
    const raw = withFile('matrix/expert-notes.json', (f: any) => {
      delete f.notes[0].statement.citations[0].matrixEra;
    });
    expect(problemsFor(raw)).toContainEqual(expect.stringContaining('without "matrixEra": true'));
  });

  it('find citations in every kind of entry', () => {
    const { files } = parseKnowledgeFiles(validRaw());
    const places = collectCitations(files).map((c) => `${c.file} ${c.entryId} ${c.field}`);
    expect(places).toEqual(
      expect.arrayContaining([
        'matrix/glossary-aim.json precision definition',
        'matrix/glossary-setup.json check-rate definition',
        'matrix/foundation.json check-dpi why',
        'matrix/symptoms.json jitter mapping',
        'matrix/expert-notes.json central-precision statement',
        'destiny2/game.json sync notes.statement',
      ]),
    );
  });
});

describe('loader', () => {
  it('replaces an invalid file with an empty one and reports why', () => {
    const raw = withFile('matrix/symptoms.json', (f) => {
      f.symptoms = [{ id: 'Not Kebab', label: '' }];
    });
    const { files, issues } = parseKnowledgeFiles(raw);
    expect(files['matrix/symptoms.json'].symptoms).toEqual([]);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.file === 'matrix/symptoms.json')).toBe(true);
    // The other files still load.
    expect(files['matrix/glossary-aim.json'].terms).toHaveLength(1);
  });

  it('enforces the evidence rules from the schema (e.g. reasoned needs reasoning)', () => {
    const raw = withFile('destiny2/weapons.json', (f: Record<string, any>) => {
      delete f.archetypes[0].mapping.reasoning;
    });
    const { issues } = parseKnowledgeFiles(raw);
    expect(issues.map((i) => i.message)).toContain('reasoned statements must explain their reasoning');
  });

  it('merges glossaries and provides lookups', () => {
    const kb = mergeKnowledge(parseKnowledgeFiles(validRaw()).files);
    expect(kb.glossary.terms.map((t) => t.id)).toEqual(['precision', 'check-rate']);
    expect(kb.glossary.nameNotes).toHaveLength(1);

    const find = createLookups(kb);
    expect(find.termById('check-rate')?.name).toBe('Check Rate');
    expect(find.symptomById('jitter')?.label).toBe('Jitter on small movements');
    expect(find.archetypeById('pulse-rifle')?.aimStyle).toBe('tracking');
    expect(find.sourceById('xim-central')?.tier).toBe('expert');
    expect(find.aimStyleById('tracking')?.name).toBe('Tracking');
    expect(find.slotName('power')).toBe('Power');
    expect(find.termById('missing')).toBeUndefined();
  });
});
