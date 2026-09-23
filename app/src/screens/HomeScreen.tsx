import { Link } from 'react-router';
import { ChevronIcon, CrosshairMark } from '../components/icons';
import { InstallCard } from '../components/Install';
import { Screen } from '../components/Screen';
import { FLOWS } from '../content/flows';
import { PLATFORM_LABELS } from '../content/labels';
import { useData } from '../state/data-context';

function savedSummary(platform: 'xbox' | 'pc' | null, loadoutCount: number): string {
  const parts: string[] = [];
  parts.push(platform ? PLATFORM_LABELS[platform] : 'Platform not set');
  parts.push(loadoutCount === 0 ? 'no loadouts' : loadoutCount === 1 ? '1 loadout' : `${loadoutCount} loadouts`);
  return parts.join(' · ');
}

export function HomeScreen() {
  const { data } = useData();
  const { platform } = data.profile;
  const count = data.loadouts.length;

  return (
    <Screen
      title="Dialed"
      icon={
        <span className="home-mark" aria-hidden="true">
          <CrosshairMark size={36} />
        </span>
      }
      intro={
        <p className="lede">
          Evidence-based XIM MATRIX setup for Destiny 2 on Xbox and PC, with the why and the source behind every value.
        </p>
      }
    >
      <p className="saved-status">
        <span className="saved-status-label">Saved on this phone:</span> {savedSummary(platform, count)}
        {!platform && (
          <>
            {' '}
            · <Link to="/profile">Set up your profile</Link>
          </>
        )}
      </p>

      <h2 className="section-title">What do you want to do?</h2>
      <ul className="flow-cards">
        {FLOWS.map((flow) => (
          <li key={flow.id}>
            <Link className="flow-card" to={flow.to}>
              <span className="flow-card-text">
                <span className="flow-card-title">{flow.title}</span>
                <span className="flow-card-summary">{flow.summary}</span>
                <span className="flow-card-status">{flow.available ? 'Ready to use' : 'Coming in the next step'}</span>
              </span>
              <ChevronIcon />
            </Link>
          </li>
        ))}
      </ul>

      <InstallCard />

      <p className="footnote">
        Every recommendation comes with its reasoning, its source and a confidence label.{' '}
        <Link to="/sources">See the sources</Link>
      </p>
    </Screen>
  );
}
