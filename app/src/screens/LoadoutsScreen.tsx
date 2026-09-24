import { Link } from 'react-router';
import { EmptyState, WeaponListMissing } from '../components/EmptyState';
import { LoadoutCard } from '../components/LoadoutCard';
import { Screen } from '../components/Screen';
import { buildPath, sheetPath, tunePath } from '../features/build/use-build-plan';
import { useData } from '../state/data-context';
import { useKnowledge } from '../state/knowledge-context';
import type { Loadout } from '../state/schema';
import { FROM_LIST } from './loadout-navigation';

/** The shared card, with Edit beside the name and the config sheet as the main action. */
function ManagedLoadout({ loadout }: { loadout: Loadout }) {
  return (
    <LoadoutCard
      loadout={loadout}
      aside={
        <Link
          className="button secondary small"
          to={`/loadouts/${encodeURIComponent(loadout.id)}`}
          state={FROM_LIST}
          aria-label={`Edit ${loadout.name}`}
        >
          Edit
        </Link>
      }
    >
      <div className="loadout-card-actions" role="group" aria-label={`${loadout.name}: sheet, build and tune`}>
        <Link className="button primary block" to={sheetPath(loadout.id)}>
          Config sheet
        </Link>
        <div className="loadout-card-row">
          <Link className="button secondary small" to={buildPath(loadout.id)}>
            Build
          </Link>
          <Link className="button secondary small" to={tunePath(loadout.id)}>
            Tune
          </Link>
        </div>
      </div>
    </LoadoutCard>
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
          The weapon combinations you actually run. Each loadout gets its own Config in MATRIX Manager, tuned toward its
          main weapon’s aim style.
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
            <ManagedLoadout key={loadout.id} loadout={loadout} />
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
