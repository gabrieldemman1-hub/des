import { Link } from 'react-router';
import type { WeaponArchetype } from '../../../knowledge/index';
import { AimStyleSummary } from '../components/AimStyleSummary';
import { EmptyState, WeaponListMissing } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { useData } from '../state/data-context';
import { useKnowledge } from '../state/knowledge-context';
import { SLOTS } from '../state/loadouts';
import { FROM_LIST } from './loadout-navigation';
import type { Loadout } from '../state/schema';

function weaponLabel(id: string | null, find: (id: string) => WeaponArchetype | undefined): string {
  if (id === null) return 'Empty';
  return find(id)?.name ?? 'Unknown weapon';
}

function LoadoutCard({ loadout }: { loadout: Loadout }) {
  const { archetypeById, slotName } = useKnowledge();
  const mainId = loadout.weapons[loadout.mainSlot];
  const main = mainId === null ? undefined : archetypeById(mainId);

  return (
    <li className="card loadout-card">
      <div className="loadout-card-head">
        <h2>{loadout.name}</h2>
        <Link
          className="button secondary small"
          to={`/loadouts/${encodeURIComponent(loadout.id)}`}
          state={FROM_LIST}
          aria-label={`Edit ${loadout.name}`}
        >
          Edit
        </Link>
      </div>
      <ul className="slot-list">
        {SLOTS.map((slot) => {
          const id = loadout.weapons[slot];
          const isMain = slot === loadout.mainSlot;
          return (
            <li key={slot} className={id === null ? 'is-empty' : undefined}>
              <span className="slot-name">{slotName(slot)}</span>
              <span className="slot-weapon">
                {weaponLabel(id, archetypeById)}
                {isMain && <span className="tag tag-main">Main</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {main ? (
        <AimStyleSummary archetype={main} />
      ) : (
        <p className="hint">The main weapon isn’t in the knowledge base any more, so its aim style is unknown.</p>
      )}
      <ul className="related-links" aria-label={`${loadout.name}: config`}>
        <li>
          <Link to={`/loadouts/${encodeURIComponent(loadout.id)}/sheet`}>Config sheet</Link>
        </li>
        <li>
          <Link to={`/build/${encodeURIComponent(loadout.id)}`}>Build</Link>
        </li>
        <li>
          <Link to={`/tune/${encodeURIComponent(loadout.id)}`}>Tune</Link>
        </li>
      </ul>
    </li>
  );
}

export function LoadoutsScreen() {
  const { data } = useData();
  const { kb } = useKnowledge();
  const canCreate = kb.weapons.archetypes.length > 0;
  const { loadouts } = data;

  return (
    <Screen
      title="Loadouts"
      intro={
        <p className="lede">
          The weapon combinations you actually run. Each loadout gets its own Config, tuned toward its main weapon’s aim
          style.
        </p>
      }
    >
      {!canCreate && <WeaponListMissing />}
      {canCreate && loadouts.length === 0 && (
        <EmptyState title="No loadouts yet">
          <p>Add a loadout for each set of weapons you run, and mark which one is the main weapon.</p>
        </EmptyState>
      )}

      {loadouts.length > 0 && (
        <ul className="loadout-list" aria-label="Your loadouts">
          {loadouts.map((loadout) => (
            <LoadoutCard key={loadout.id} loadout={loadout} />
          ))}
        </ul>
      )}

      {canCreate && (
        <Link className="button primary block" to="/loadouts/new" state={FROM_LIST}>
          Add a loadout
        </Link>
      )}
    </Screen>
  );
}
