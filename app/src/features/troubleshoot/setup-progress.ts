/**
 * Setup-check progress for Troubleshoot by feel. The marks live in `AppData.progress` under
 * `progressKey.check(id)`, shared with Build my config. Pass the effective progress
 * (`effectiveProgress`), so the Destiny 2 settings check counts as every checklist shows it.
 */
import type { FoundationCheck } from '../../../../knowledge/index';
import { countProgress, progressKey, type ProgressCount, type ProgressMap } from '../../state/progress';

/** Every setup-check mark starts with this, so clearing it clears them all (and nothing else). */
export const CHECK_PREFIX = progressKey.check('');

/** Counts the marks on these checks only (a mark on a check that doesn't apply isn't counted). */
export function summarizeChecks(checks: readonly FoundationCheck[], progress: ProgressMap): ProgressCount {
  return countProgress(
    checks.map((check) => progressKey.check(check.id)),
    progress,
  );
}

/** True when any setup check is marked, including checks for another platform. */
export function hasCheckMarks(progress: ProgressMap): boolean {
  return Object.keys(progress).some((key) => key.startsWith(CHECK_PREFIX));
}
