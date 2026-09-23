/**
 * Checklist item ids for `AppData.progress`. Global items (Destiny 2 settings, setup checks)
 * are shared by Build my config and Troubleshoot by feel, so ticking one shows in both.
 * Loadout items start with `loadout:<id>:`, so deleting a loadout can remove them.
 */
export const progressKey = {
  /** A Destiny 2 required in-game setting, by its name as the knowledge base spells it. */
  requiredSetting: (name: string) => `required:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  /** A setup check (FoundationCheck id). */
  check: (checkId: string) => `check:${checkId}`,
  /** A per-loadout item, e.g. an aim setting a Build step asks the player to set. */
  loadout: (loadoutId: string, item: string) => `${loadoutPrefix(loadoutId)}${item}`,
};

export function loadoutPrefix(loadoutId: string): string {
  return `loadout:${loadoutId}:`;
}
