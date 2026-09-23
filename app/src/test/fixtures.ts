import { mergeKnowledge, parseKnowledgeFiles, type RawKnowledgeFiles } from '../../../knowledge/index';
import { createKnowledgeApi, type KnowledgeApi } from '../state/knowledge-context';
import { STORAGE_VERSION, defaultProfile, type AppData, type Loadout } from '../state/schema';

const reasoned = (text: string, reasoning: string) => ({ text, confidence: 'reasoned', citations: [], reasoning });

const EMPTY_RAW: RawKnowledgeFiles = {
  'sources.json': {
    sources: [
      {
        id: 'xim-guide',
        title: 'XIM MATRIX User Guide',
        publisher: 'XIM Technologies',
        url: 'https://guide.xim.tech/',
        hosts: ['guide.xim.tech'],
        tier: 'official',
        accessed: '2026-09-22',
        notes: 'The canonical reference for every XIM MATRIX setting.',
      },
      {
        id: 'xim-central',
        title: 'XIM Central (YouTube)',
        publisher: 'Independent creator',
        url: 'https://www.youtube.com/@XIMCentral',
        hosts: ['www.youtube.com'],
        tier: 'expert',
        accessed: '2026-09-22',
      },
    ],
  },
  'destiny2/game.json': { game: 'destiny-2', name: 'Destiny 2', requiredSettings: [], notes: [] },
  'destiny2/weapons.json': {
    slots: [
      { id: 'kinetic', name: 'Kinetic' },
      { id: 'energy', name: 'Energy' },
      { id: 'power', name: 'Power' },
    ],
    archetypes: [],
  },
  'matrix/aim-styles.json': { styles: [] },
  'matrix/expert-notes.json': { notes: [] },
  'matrix/foundation.json': { checks: [] },
  'matrix/glossary-aim.json': { terms: [], nameNotes: [] },
  'matrix/glossary-setup.json': { terms: [], nameNotes: [] },
  'matrix/symptoms.json': {
    symptoms: [],
    guardrail: { text: 'Change one thing at a time.', confidence: 'gap', citations: [] },
  },
};

const ARCHETYPES = [
  {
    id: 'pulse-rifle',
    name: 'Pulse Rifle',
    aimStyle: 'tracking',
    mapping: reasoned('Pulse rifles fire bursts you hold on target.', 'Sustained fire needs stable tracking.'),
  },
  {
    id: 'hand-cannon',
    name: 'Hand Cannon',
    aimStyle: 'snap',
    mapping: reasoned('Hand cannons reward fast acquisition.', 'Peek shots start from a standstill.'),
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    aimStyle: 'snap',
    mapping: reasoned('Shotguns are snapped at close range.', 'Close-range shots start from rest.'),
  },
  {
    id: 'scout-rifle',
    name: 'Scout Rifle',
    aimStyle: 'precision-hold',
    mapping: reasoned('Scouts reward deliberate shots.', 'Single shots need fine low-speed control.'),
  },
  {
    id: 'sword',
    name: 'Sword',
    aimStyle: null,
    mapping: { text: 'Swords are melee weapons, so no aim style applies.', confidence: 'gap', citations: [] },
  },
];

function build(raw: RawKnowledgeFiles): KnowledgeApi {
  const { files, issues } = parseKnowledgeFiles(raw);
  if (issues.length > 0) throw new Error(`Invalid test fixture: ${JSON.stringify(issues)}`);
  return createKnowledgeApi(mergeKnowledge(files));
}

/** A knowledge base with sources but no weapon archetypes (as before the data is written). */
export const emptyKnowledge = build(EMPTY_RAW);

/** A knowledge base with a few weapon archetypes. */
export const weaponKnowledge = build({
  ...EMPTY_RAW,
  'destiny2/weapons.json': { ...(EMPTY_RAW['destiny2/weapons.json'] as object), archetypes: ARCHETYPES },
});

export function sampleLoadout(overrides: Partial<Loadout> = {}): Loadout {
  return {
    id: 'l1',
    name: 'Pulse + shotgun',
    weapons: { kinetic: 'pulse-rifle', energy: 'shotgun', power: null },
    mainSlot: 'kinetic',
    createdAt: '2026-09-22T10:00:00.000Z',
    updatedAt: '2026-09-22T10:00:00.000Z',
    ...overrides,
  };
}

export function sampleData(overrides: Partial<AppData> = {}): AppData {
  return { version: STORAGE_VERSION, profile: defaultProfile(), loadouts: [], ...overrides };
}
