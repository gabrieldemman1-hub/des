/**
 * What every loadout list says about a loadout, so the Loadouts screen, the Build and Tune
 * pickers and Home agree: the main weapon's aim style, the config sheet's progress and whether
 * the loadout's settings are entered.
 */
import { buildPlan, planProgress, type BuildPlan, type ProgressCount } from '../features/build/build-plan';
import { hasConfigValues } from '../state/current-values';
import { useData } from '../state/data-context';
import { useKnowledge, type KnowledgeApi } from '../state/knowledge-context';
import { SLOTS } from '../state/loadouts';
import { progressSummary } from '../state/progress';
import { hasInGameValues } from '../state/required-settings';
import type { Loadout } from '../state/schema';
import { useEffectiveProgress } from '../state/use-progress';

export interface LoadoutSummary {
  /** The main weapon's archetype and aim style; undefined when the knowledge base no longer has it. */
  main: BuildPlan['main'];
  style: BuildPlan['style'];
  /** Build progress over the loadout's config sheet (the shared steps count for every loadout). */
  sheet: ProgressCount;
  /** What Tune my config has to work with: this Config's settings, Destiny 2's only, or nothing. */
  settings: 'config' | 'in-game' | 'none';
  /** When this Config's settings were last entered. */
  updatedAt: string | null;
}

export function useLoadoutSummary(loadout: Loadout): LoadoutSummary {
  const knowledge = useKnowledge();
  const { data } = useData();
  const progress = useEffectiveProgress();
  const plan = buildPlan(knowledge, data.profile, loadout);
  const config = data.configs[loadout.id];
  return {
    main: plan.main,
    style: plan.style,
    sheet: planProgress(plan, progress),
    settings: hasConfigValues(config) ? 'config' : hasInGameValues(data.inGame) ? 'in-game' : 'none',
    updatedAt: config?.updatedAt ?? null,
  };
}

/** "Sheet 5 of 19 done · 1 needs fixing": the build progress, as the config sheet counts it. */
export function sheetStatus(sheet: ProgressCount): string {
  return `Sheet ${progressSummary(sheet)}`;
}

/** "23 Sep", with the year once it isn't this year's. */
function formatDay(iso: string): string {
  const date = new Date(iso);
  const thisYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(thisYear ? {} : { year: 'numeric' }),
  });
}

/** "Settings entered 23 Sep": whether Tune my config has this loadout's settings. */
export function settingsStatus({ settings, updatedAt }: Pick<LoadoutSummary, 'settings' | 'updatedAt'>): string {
  switch (settings) {
    case 'config':
      return updatedAt ? `Settings entered ${formatDay(updatedAt)}` : 'Settings entered';
    case 'in-game':
      return 'Only Destiny 2 settings entered';
    case 'none':
      return 'No settings entered';
  }
}

/** "Pulse Rifle (main) · Shotgun · Power: empty": every slot in order, so an empty one shows. */
export function weaponsLine(loadout: Loadout, lookups: Pick<KnowledgeApi, 'archetypeById' | 'slotName'>): string {
  return SLOTS.map((slot) => {
    const id = loadout.weapons[slot];
    if (id === null) return `${lookups.slotName(slot)}: empty`;
    const name = lookups.archetypeById(id)?.name ?? 'Unknown weapon';
    return slot === loadout.mainSlot ? `${name} (main)` : name;
  }).join(' · ');
}
