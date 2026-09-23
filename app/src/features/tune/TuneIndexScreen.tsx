import { Link } from 'react-router';
import { EmptyState } from '../../components/EmptyState';
import { ChevronIcon } from '../../components/icons';
import { Screen } from '../../components/Screen';
import { flowById } from '../../content/flows';
import { AIM_STYLE_NAMES, NO_AIM_STYLE } from '../../content/labels';
import { useData } from '../../state/data-context';
import { useKnowledge } from '../../state/knowledge-context';
import type { Loadout } from '../../state/schema';
import { hasInGameValues } from '../../state/required-settings';
import { hasConfigValues, mainWeapon } from './analysis';
import './tune.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function LoadoutChoice({ loadout }: { loadout: Loadout }) {
  const { data } = useData();
  const { kb } = useKnowledge();
  const { archetype, style } = mainWeapon(kb, loadout);
  const styleName =
    archetype === undefined
      ? null
      : archetype.aimStyle === null
        ? NO_AIM_STYLE
        : (style?.name ?? AIM_STYLE_NAMES[archetype.aimStyle]);
  const config = data.configs[loadout.id];
  const status =
    hasConfigValues(config) && config?.updatedAt
      ? `Settings entered · updated ${formatDate(config.updatedAt)}`
      : hasInGameValues(data.inGame)
        ? 'Destiny 2 settings entered · none for this Config yet'
        : 'No settings entered yet';

  return (
    <li>
      <Link className="flow-card" to={`/tune/${encodeURIComponent(loadout.id)}`}>
        <span className="flow-card-text">
          <span className="flow-card-title">{loadout.name}</span>
          <span className="flow-card-summary">
            Main weapon: {archetype?.name ?? 'Unknown weapon'}
            {styleName && ` · ${styleName}`}
          </span>
          <span className="flow-card-status">{status}</span>
        </span>
        <ChevronIcon />
      </Link>
    </li>
  );
}

/** Tune my config: what the flow does, and which loadout's Config to tune. */
export function TuneIndexScreen() {
  const { data } = useData();
  const paragraphs = flowById('tune')?.sections.flatMap((s) => s.paragraphs ?? []) ?? [];
  const [lede, ...more] = paragraphs;
  const { loadouts } = data;

  return (
    <Screen title="Tune my config" back={{ to: '/', label: 'Home' }} intro={lede && <p className="lede">{lede}</p>}>
      {more.map((p) => (
        <p key={p}>{p}</p>
      ))}

      {loadouts.length === 0 ? (
        <EmptyState title="No loadouts yet">
          <p>Each loadout gets its own Config, so Dialed tunes one loadout at a time. Add the loadout you want to tune.</p>
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
          <p className="hint">Each loadout has its own Config. Pick the one you want to tune.</p>
          <ul className="flow-cards" aria-labelledby="tune-pick">
            {loadouts.map((loadout) => (
              <LoadoutChoice key={loadout.id} loadout={loadout} />
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}
