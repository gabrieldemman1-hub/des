import type { ReactNode } from 'react';
import { CrosshairMark } from './icons';

interface Props {
  title: string;
  /** The heading level: 2 on its own in a screen, 3 inside a section with an h2. */
  level?: 2 | 3;
  children: ReactNode;
}

/** Nothing here yet: an empty slot with the reticle in a quiet tone, what's missing and what to do. */
export function EmptyState({ title, level = 2, children }: Props) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <div className="empty-state">
      <span className="empty-state-mark" aria-hidden="true">
        <CrosshairMark size={32} />
      </span>
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
