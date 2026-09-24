import { Link } from 'react-router';
import { EmptyState } from '../../components/EmptyState';
import { HowThisWorks } from '../../components/HowThisWorks';
import { LoadoutCard } from '../../components/LoadoutCard';
import { Screen } from '../../components/Screen';
import { useData } from '../../state/data-context';
import { tunePath } from '../build/use-build-plan';
import './tune.css';

/** Tune my config: which loadout's Config to tune. */
export function TuneIndexScreen() {
  const { data } = useData();
  const { loadouts } = data;

  return (
    <Screen
      title="Tune my config"
      back={{ to: '/', label: 'Home' }}
      intro={
        <>
          <p className="lede">
            Enter what you have now. Dialed lists what to change, biggest impact first, one at a time.
          </p>
          <HowThisWorks flow="tune" />
        </>
      }
    >
      {loadouts.length === 0 ? (
        <EmptyState title="No loadouts yet">
          <p>
            Every loadout has its own Config in MATRIX Manager, so Dialed tunes one loadout at a time. Add the loadout
            you want to tune.
          </p>
          <p>
            <Link className="button primary" to="/loadouts/new">
              Add a loadout
            </Link>
          </p>
        </EmptyState>
      ) : (
        <section className="tune-section" aria-labelledby="tune-pick">
          <h2 className="section-title" id="tune-pick">
            Pick a loadout
          </h2>
          <p className="hint">Every loadout has its own Config in MATRIX Manager. Pick the one you want to tune.</p>
          <ul className="flow-cards" aria-labelledby="tune-pick">
            {loadouts.map((loadout) => (
              <LoadoutCard key={loadout.id} loadout={loadout} to={tunePath(loadout.id)} />
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}
