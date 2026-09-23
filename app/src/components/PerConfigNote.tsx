import { PER_CONFIG_CHECK_IDS, PER_CONFIG_CHECK_NOTE } from '../state/progress';

/**
 * For a setup check about one specific Config: its mark counts for every loadout, but each
 * loadout has its own Config, so it is checked in each of them. Nothing for other checks.
 */
export function PerConfigNote({ checkId }: { checkId: string }) {
  if (!PER_CONFIG_CHECK_IDS.has(checkId)) return null;
  return <p className="per-config-note">{PER_CONFIG_CHECK_NOTE}</p>;
}
