import type { FoundationCheck } from '../../../knowledge/index';
import { PER_CONFIG_CHECK_IDS } from '../state/progress';

const PER_CONFIG_TAG = 'Per Config';

/**
 * Marks a setup check about one specific Config: its mark counts for every loadout, but each
 * loadout has its own Config, so it is checked in each of them (`PerConfigHint` says so once,
 * above the list). Nothing for other checks.
 */
export function PerConfigNote({ checkId }: { checkId: string }) {
  if (!PER_CONFIG_CHECK_IDS.has(checkId)) return null;
  return (
    <p className="per-config-note">
      <span className="tag">{PER_CONFIG_TAG}</span>
    </p>
  );
}

/** What the Per Config tag means, once above a list of setup checks that has one. */
export function PerConfigHint({ checks }: { checks: readonly Pick<FoundationCheck, 'id'>[] }) {
  if (!checks.some((c) => PER_CONFIG_CHECK_IDS.has(c.id))) return null;
  return (
    <p className="hint per-config-hint">
      <span className="tag">{PER_CONFIG_TAG}</span> marks a check to repeat in every Config you use: each loadout has
      its own.
    </p>
  );
}
