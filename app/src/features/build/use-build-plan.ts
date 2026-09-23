import { useData } from '../../state/data-context';
import { useKnowledge } from '../../state/knowledge-context';
import { buildPlan, type BuildPlan } from './build-plan';

/** The build plan for a saved loadout, or undefined when there is no such loadout. */
export function useBuildPlan(loadoutId: string | undefined): BuildPlan | undefined {
  const knowledge = useKnowledge();
  const { data } = useData();
  const loadout = data.loadouts.find((l) => l.id === loadoutId);
  return loadout ? buildPlan(knowledge, data.profile, loadout) : undefined;
}

export function buildPath(loadoutId: string, stepId?: string): string {
  const base = `/build/${encodeURIComponent(loadoutId)}`;
  return stepId ? `${base}/${stepId}` : base;
}

export function sheetPath(loadoutId: string): string {
  return `/loadouts/${encodeURIComponent(loadoutId)}/sheet`;
}

export function tunePath(loadoutId: string): string {
  return `/tune/${encodeURIComponent(loadoutId)}`;
}

/** Tune my config's "Your settings", where the player enters what they have set now. */
export function tuneSettingsPath(loadoutId: string): string {
  return `${tunePath(loadoutId)}/settings`;
}
