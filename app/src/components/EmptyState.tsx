import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** The heading level: 2 on its own in a screen, 3 inside a section with an h2. */
  level?: 2 | 3;
  children: ReactNode;
}

export function EmptyState({ title, level = 2, children }: Props) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <div className="empty-state">
      <Heading className="empty-state-title">{title}</Heading>
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
