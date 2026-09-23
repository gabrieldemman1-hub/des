/**
 * Setup-check progress for Troubleshoot by feel. The marks live in `AppData.progress` under
 * `progressKey.check(id)`, shared with Build my config.
 */
import type { FoundationCheck } from '../../../../knowledge/index';
import { progressKey } from '../../state/progress';
import type { AppData } from '../../state/schema';

/** Every setup-check mark starts with this, so clearing it clears them all (and nothing else). */
export const CHECK_PREFIX = progressKey.check('');

export interface CheckSummary {
  total: number;
  /** Marked either Done or Needs fixing. */
  checked: number;
  /** Marked Needs fixing. */
  problems: number;
}

/** Counts the marks on these checks only (a mark on a check that doesn't apply isn't counted). */
export function summarizeChecks(checks: readonly FoundationCheck[], progress: AppData['progress']): CheckSummary {
  let checked = 0;
  let problems = 0;
  for (const check of checks) {
    const state = progress[progressKey.check(check.id)];
    if (state) checked += 1;
    if (state === 'problem') problems += 1;
  }
  return { total: checks.length, checked, problems };
}

/** "5 of 10 checked · 1 needs fixing" (the second part only when something needs fixing). */
export function describeSummary({ total, checked, problems }: CheckSummary): string {
  const count = `${checked} of ${total} checked`;
  if (problems === 0) return count;
  return `${count} · ${problems} ${problems === 1 ? 'needs' : 'need'} fixing`;
}

/** True when any setup check is marked, including checks for another platform. */
export function hasCheckMarks(progress: AppData['progress']): boolean {
  return Object.keys(progress).some((key) => key.startsWith(CHECK_PREFIX));
}
