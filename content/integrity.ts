/**
 * Checks that span files: every citation names a known source on one of its hosts, every
 * cross-reference points at a real setting, and the map places each setting exactly once.
 * Returns problems as strings, so a test can list them all at once.
 */
import type { AimStyle, Dial, GuideMap, NameNote, Setting, Source, Statement } from './schema';

export interface Content {
  sources: Source[];
  settings: Setting[];
  aimStyles: AimStyle[];
  names: NameNote[];
  guideMap: GuideMap;
  dials: Dial[];
}

/** Words that belong to the old app, and must not reach Primer's pages. */
const OLD_APP = /\bDialed\b|config sheet|Build my config|Tune my config|Troubleshoot by feel|\bloadouts?\b|your profile/i;

export function statementsOf(setting: Setting): [string, Statement][] {
  const list: [string, Statement][] = [['where', setting.where]];
  if (setting.definition) list.push(['definition', setting.definition]);
  for (const key of ['plainWords', 'feel', 'guidance', 'aimStyles'] as const) {
    setting[key].forEach((s, i) => list.push([`${key}[${i}]`, s]));
  }
  setting.confusions.forEach((c, i) => {
    if (c.statement) list.push([`confusions[${i}].statement`, c.statement]);
  });
  return list;
}

export function checkContent({ sources, settings, aimStyles, names, guideMap, dials }: Content): string[] {
  const problems: string[] = [];
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const settingIds = new Set(settings.map((s) => s.id));

  const checkStatement = (where: string, s: Statement) => {
    for (const c of s.citations) {
      const source = sourceById.get(c.source);
      if (!source) {
        problems.push(`${where}: cites unknown source "${c.source}"`);
        continue;
      }
      const host = new URL(c.url).hostname;
      if (!source.hosts.includes(host)) problems.push(`${where}: ${c.url} is not on ${source.id}'s hosts`);
      if (source.tier === 'expert' && c.matrixEra !== true) {
        problems.push(`${where}: expert citations must be marked matrixEra`);
      }
    }
    for (const text of [s.text, s.reasoning ?? '', s.caveat ?? '']) {
      if (OLD_APP.test(text)) problems.push(`${where}: mentions the old app ("${text.match(OLD_APP)?.[0]}")`);
      if (/\bTODO\b/.test(text)) problems.push(`${where}: still has a TODO`);
    }
  };

  const checkRef = (where: string, id: string | undefined) => {
    if (id !== undefined && !settingIds.has(id)) problems.push(`${where}: unknown setting "${id}"`);
  };

  for (const setting of settings) {
    const at = `settings/${setting.id}`;
    for (const [key, s] of statementsOf(setting)) checkStatement(`${at} ${key}`, s);
    if (setting.where.confidence === 'gap' && setting.where.text !== "The guide doesn't say where this is in Manager.") {
      problems.push(`${at} where: a location without a citation must say the guide doesn't give one`);
    }
    if (OLD_APP.test(setting.summary)) problems.push(`${at} summary: mentions the old app`);
    setting.related.forEach((id) => checkRef(`${at} related`, id));
    if (setting.related.includes(setting.id)) problems.push(`${at} related: lists itself`);
    setting.confusions.forEach((c, i) => checkRef(`${at} confusions[${i}]`, c.settingId));
  }

  for (const style of aimStyles) {
    const at = `aim-styles/${style.id}`;
    checkStatement(`${at} favours`, style.favours);
    style.levers.forEach((l, i) => {
      checkRef(`${at} levers[${i}]`, l.settingId);
      checkStatement(`${at} levers[${i}]`, l.statement);
    });
    style.weapons.forEach((w, i) => checkStatement(`${at} weapons[${i}]`, w.mapping));
  }

  names.forEach((n, i) => {
    checkRef(`names[${i}]`, n.settingId);
    checkStatement(`names[${i}] ${n.name}`, n.statement);
  });

  for (const dial of dials) {
    const at = `dials/${dial.id}`;
    for (const text of [dial.name, dial.summary, dial.ends.a, dial.ends.b]) {
      if (OLD_APP.test(text)) problems.push(`${at}: mentions the old app ("${text.match(OLD_APP)?.[0]}")`);
    }
    checkStatement(`${at} intro`, dial.intro);
    checkStatement(`${at} start`, dial.start);
    dial.notes.forEach((s, i) => checkStatement(`${at} notes[${i}]`, s));
    const onDial = new Set<string>();
    dial.levers.forEach((l, i) => {
      checkRef(`${at} levers[${i}]`, l.settingId);
      if (onDial.has(l.settingId)) problems.push(`${at} levers[${i}]: ${l.settingId} is on the dial twice`);
      onDial.add(l.settingId);
      if (l.a) checkStatement(`${at} levers[${i}].a`, l.a.statement);
      if (l.b) checkStatement(`${at} levers[${i}].b`, l.b.statement);
    });
  }

  const placed = guideMap.chapters.flatMap((c) => c.screens.flatMap((s) => s.groups.flatMap((g) => g.settings)));
  for (const id of new Set(placed)) {
    if (placed.filter((p) => p === id).length > 1) problems.push(`map.json: ${id} is placed more than once`);
  }
  placed.forEach((id) => checkRef('map.json', id));
  for (const id of settingIds) if (!placed.includes(id)) problems.push(`map.json: ${id} is not on the map`);

  return problems;
}
