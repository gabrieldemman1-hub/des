import { useMemo } from 'react';
import { useData } from './data-context';
import { useKnowledge } from './knowledge-context';
import { derivedProblemKeys, effectiveProgress, type ProgressContext, type ProgressMap } from './progress';

function useProgressContext(): ProgressContext {
  const { data } = useData();
  return useMemo(
    () => ({ inGame: data.inGame, profile: data.profile, configs: Object.values(data.configs) }),
    [data.inGame, data.profile, data.configs],
  );
}

/** The checklist progress as every checklist shows it (see `effectiveProgress`). */
export function useEffectiveProgress(): ProgressMap {
  const { data } = useData();
  const { kb } = useKnowledge();
  const context = useProgressContext();
  return useMemo(() => effectiveProgress(data.progress, kb, context), [data.progress, kb, context]);
}

/** The items shown as Needs fixing because the player's values differ (see `derivedProblemKeys`). */
export function useDerivedProblemKeys(): ReadonlySet<string> {
  const { kb } = useKnowledge();
  const context = useProgressContext();
  return useMemo(() => derivedProblemKeys(kb, context), [kb, context]);
}
