import { Link, Navigate, useParams } from 'react-router';
import { Screen } from '../../components/Screen';
import { AIM_STYLE_NAMES, NO_AIM_STYLE } from '../../content/labels';
import { NotFoundScreen } from '../../screens/NotFoundScreen';
import { useData } from '../../state/data-context';
import { useKnowledge } from '../../state/knowledge-context';
import type { Loadout } from '../../state/schema';
import { hasEnteredSettings, mainWeapon } from './analysis';
import { ChangesView } from './ChangesView';
import { SettingsForm } from './SettingsForm';
import './tune.css';

const TABS = [
  { id: 'settings', label: 'Your settings' },
  { id: 'changes', label: 'What to change' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function isTab(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}

function tunePath(loadoutId: string, tab: TabId) {
  return `/tune/${encodeURIComponent(loadoutId)}/${tab}`;
}

/** The two parts of one loadout's tuning, as links so the URL says which one is showing. */
function TuneTabs({ loadoutId, current }: { loadoutId: string; current: TabId }) {
  return (
    <nav className="tune-tabs" aria-label="Tune sections">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          className="tune-tab"
          to={tunePath(loadoutId, tab.id)}
          aria-current={tab.id === current ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function MainWeaponLine({ loadout }: { loadout: Loadout }) {
  const { kb } = useKnowledge();
  const { archetype, style } = mainWeapon(kb, loadout);
  if (!archetype) return <p className="hint">Main weapon: unknown (it isn’t in the knowledge base any more).</p>;
  const styleName = archetype.aimStyle === null ? NO_AIM_STYLE : (style?.name ?? AIM_STYLE_NAMES[archetype.aimStyle]);
  return (
    <p className="hint">
      Main weapon: <strong>{archetype.name}</strong> · Aim style: <strong>{styleName}</strong>
    </p>
  );
}

function LoadoutNotFound() {
  return (
    <Screen title="Loadout not found" back={{ to: '/tune', label: 'Tune my config' }}>
      <p>There’s no loadout at this address. It may have been deleted.</p>
      <p>
        <Link className="button secondary" to="/tune">
          Pick a loadout to tune
        </Link>
      </p>
    </Screen>
  );
}

/** One loadout: "Your settings" (what the player has now) and "What to change". */
export function TuneLoadoutScreen() {
  const { loadoutId, tab } = useParams();
  const { data } = useData();
  const loadout = data.loadouts.find((l) => l.id === loadoutId);
  if (!loadout) return <LoadoutNotFound />;

  if (tab === undefined) {
    const start: TabId = hasEnteredSettings(data.configs[loadout.id]) ? 'changes' : 'settings';
    return <Navigate replace to={tunePath(loadout.id, start)} />;
  }
  if (!isTab(tab)) return <NotFoundScreen />;

  return (
    <Screen
      title={loadout.name}
      documentTitle={`Tune ${loadout.name}`}
      back={{ to: '/tune', label: 'Tune my config' }}
      intro={<MainWeaponLine loadout={loadout} />}
    >
      <TuneTabs loadoutId={loadout.id} current={tab} />
      {tab === 'settings' ? (
        <SettingsForm loadout={loadout} changesPath={tunePath(loadout.id, 'changes')} />
      ) : (
        <ChangesView loadout={loadout} settingsPath={tunePath(loadout.id, 'settings')} />
      )}
    </Screen>
  );
}
