import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

/** Shown instead of the loadout form while knowledge/destiny2/weapons.json has no archetypes. */
export function WeaponListMissing() {
  return (
    <EmptyState title="The weapon list isn’t ready yet">
      <p>
        Loadouts are built from the Destiny 2 weapon types in Dialed’s knowledge base, and that list hasn’t been written
        yet. Once it’s in, you can add your loadouts here.
      </p>
    </EmptyState>
  );
}
