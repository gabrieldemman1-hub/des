/** Small text helpers shared by the build screens, the config sheet and its plain-text copy. */
import type { AimStyle, WeaponArchetype, WeaponSlot } from '../../../../knowledge/index';
import { AIM_STYLE_NAMES, NO_AIM_STYLE } from '../../content/labels';
import type { KnowledgeApi } from '../../state/knowledge-context';
import { SLOTS } from '../../state/loadouts';
import type { Loadout, ProgressState } from '../../state/schema';

export function statusOf(progress: Readonly<Record<string, ProgressState>>, key: string): ProgressState | 'none' {
  return progress[key] ?? 'none';
}

export interface WeaponLine {
  slot: WeaponSlot;
  slotName: string;
  /** The archetype's name, or a stand-in when it is no longer in the knowledge base. */
  name: string;
  isMain: boolean;
}

/** The loadout's filled slots, in slot order. */
export function weaponLines(loadout: Loadout, lookups: Pick<KnowledgeApi, 'archetypeById' | 'slotName'>): WeaponLine[] {
  return SLOTS.flatMap((slot) => {
    const id = loadout.weapons[slot];
    if (id === null) return [];
    return [
      {
        slot,
        slotName: lookups.slotName(slot),
        name: lookups.archetypeById(id)?.name ?? 'Unknown weapon',
        isMain: slot === loadout.mainSlot,
      },
    ];
  });
}

/** "Pulse Rifle (main), Shotgun" */
export function weaponSummary(lines: readonly WeaponLine[]): string {
  return lines.map((w) => (w.isMain ? `${w.name} (main)` : w.name)).join(', ');
}

/** The main weapon's aim style name, as the Loadouts screen shows it. */
export function aimStyleName(main: WeaponArchetype | undefined, style: AimStyle | undefined): string {
  if (!main) return 'Unknown';
  if (main.aimStyle === null) return NO_AIM_STYLE;
  return style?.name ?? AIM_STYLE_NAMES[main.aimStyle];
}
