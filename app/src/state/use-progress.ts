import { useMemo } from 'react';
import { useData } from './data-context';
import { useKnowledge } from './knowledge-context';
import { effectiveProgress, type ProgressMap } from './progress';

/** The checklist progress as every checklist shows it (see `effectiveProgress`). */
export function useEffectiveProgress(): ProgressMap {
  const { data } = useData();
  const { kb } = useKnowledge();
  return useMemo(() => effectiveProgress(data.progress, kb), [data.progress, kb]);
}
