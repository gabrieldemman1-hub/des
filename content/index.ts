/**
 * Loads and validates every content file at build time. Pages import from here, never from the
 * JSON directly, so a file that breaks the schema fails the build with its path and the problem.
 */
import { z } from 'zod';
import mapJson from './map.json';
import namesJson from './names.json';
import sourcesJson from './sources.json';
import {
  AimStyle,
  Dial,
  GuideMap,
  NameNote,
  Setting,
  Source,
  type AimStyleId,
  type Chapter,
  type Screen,
} from './schema';

function parse<T>(schema: z.ZodType<T>, data: unknown, file: string): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`${file}: ${z.prettifyError(result.error)}`);
  return result.data;
}

/** `{ './settings/easing.json': {...} }` → the parsed values, in file-name order. */
function parseAll<T>(schema: z.ZodType<T>, files: Record<string, unknown>): T[] {
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, data]) => {
      const value = parse(schema, data, file);
      const id = file.replace(/^.*\/([^/]+)\.json$/, '$1');
      if ((value as { id?: string }).id !== id) throw new Error(`${file}: its id must match the file name (${id})`);
      return value;
    });
}

const settingFiles = import.meta.glob('./settings/*.json', { eager: true, import: 'default' });
const aimStyleFiles = import.meta.glob('./aim-styles/*.json', { eager: true, import: 'default' });
const dialFiles = import.meta.glob('./dials/*.json', { eager: true, import: 'default' });

export const sources = parse(z.object({ sources: z.array(Source) }), sourcesJson, 'sources.json').sources;
export const settings = parseAll(Setting, settingFiles);
export const aimStyles = parseAll(AimStyle, aimStyleFiles);
/** The Tuning page's dials, in their page order. */
export const dials = parseAll(Dial, dialFiles).sort((a, b) => a.order - b.order);
export const names = parse(z.object({ names: z.array(NameNote) }), namesJson, 'names.json').names;
export const guideMap = parse(GuideMap, mapJson, 'map.json');

const settingsById = new Map(settings.map((s) => [s.id, s]));
const sourcesById = new Map(sources.map((s) => [s.id, s]));

export const settingById = (id: string) => settingsById.get(id);
export const sourceById = (id: string) => sourcesById.get(id);
export const aimStyleById = (id: AimStyleId) => aimStyles.find((s) => s.id === id);
export const dialById = (id: string) => dials.find((d) => d.id === id);
/** The dials a setting sits on, in page order. */
export const dialsFor = (settingId: string) => dials.filter((d) => d.levers.some((l) => l.settingId === settingId));

/** Where a setting sits on the map: its chapter, screen and group label. */
export interface Placement {
  chapter: Chapter;
  screen: Screen;
  group: string | undefined;
  /** 1-based screen number across the whole map, in the guide's order. */
  number: number;
}

const placements = new Map<string, Placement>();
let screenNumber = 0;
for (const chapter of guideMap.chapters) {
  for (const screen of chapter.screens) {
    screenNumber += 1;
    for (const group of screen.groups) {
      for (const id of group.settings) {
        placements.set(id, { chapter, screen, group: group.label, number: screenNumber });
      }
    }
  }
}

export const placementOf = (settingId: string) => placements.get(settingId);

/** Every screen with its number, in map order. */
export const screens = guideMap.chapters.flatMap((chapter) => chapter.screens.map((screen) => ({ chapter, screen })));
