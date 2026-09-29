/**
 * A loadout whose Config uses Custom sync copies Look Sensitivity and ADS Sensitivity Modifier
 * from the game (see `CUSTOM_SYNC_FIELDS`), so its config sheet and Build step don't compare them
 * with XIM's list: those rows keep only the player's own mark, never a Needs fixing worked out
 * from a differing value.
 */
import { useData } from '../../state/data-context';
import type { ProgressMap } from '../../state/progress';
import { requiredSettingField } from '../../state/required-settings';
import type { CurrentConfig } from '../../state/schema';
import { useEffectiveProgress } from '../../state/use-progress';
import { CUSTOM_SYNC_FIELDS } from '../tune/analysis';
import type { BuildPlan } from './build-plan';

/** The progress keys of the Destiny 2 rows this loadout's Config takes from the game. */
export function customSyncKeys(plan: Pick<BuildPlan, 'settings'>, config: CurrentConfig | undefined): ReadonlySet<string> {
  if (config?.matrix.syncMethod !== 'custom') return new Set();
  return new Set(
    plan.settings
      .filter((setting) => {
        const field = requiredSettingField(setting.name);
        return field !== null && CUSTOM_SYNC_FIELDS.has(field);
      })
      .map((setting) => setting.key),
  );
}

/** `progress` with those rows at the player's saved mark (or none). */
export function withCustomSync(progress: ProgressMap, saved: ProgressMap, keys: ReadonlySet<string>): ProgressMap {
  if (keys.size === 0) return progress;
  const out: Record<string, ProgressMap[string]> = { ...progress };
  for (const key of keys) {
    const mark = saved[key];
    if (mark) out[key] = mark;
    else delete out[key];
  }
  return out;
}

/** The effective progress as this loadout's sheet and Build steps count it. */
export function useLoadoutProgress(plan: Pick<BuildPlan, 'settings' | 'loadout'>): ProgressMap {
  const { data } = useData();
  const progress = useEffectiveProgress();
  return withCustomSync(progress, data.progress, customSyncKeys(plan, data.configs[plan.loadout.id]));
}
