import { useId } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '../../components/EmptyState';
import { HowThisWorks } from '../../components/HowThisWorks';
import { LoadoutCard } from '../../components/LoadoutCard';
import { Screen } from '../../components/Screen';
import { OUTPUT_TYPE_LABELS, PLATFORM_LABELS } from '../../content/labels';
import { useData } from '../../state/data-context';
import type { Profile } from '../../state/schema';
import { buildPath } from './use-build-plan';
import './build.css';

function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Which profile fields the build uses are still unset. Nothing is blocked by them. */
function ProfileReadiness({ profile }: { profile: Profile }) {
  const headingId = useId();
  const { platform, outputType, mouseDpi, pollingRate } = profile;
  const missing = [
    ...(platform === null ? ['platform'] : []),
    ...(outputType === null ? ['output type'] : []),
    ...(mouseDpi === null ? ['mouse DPI'] : []),
    ...(pollingRate === null ? ['polling rate'] : []),
  ];

  return (
    <section className="build-profile" aria-labelledby={headingId}>
      <h2 className="section-title" id={headingId}>
        Your profile
      </h2>
      {platform !== null && outputType !== null && mouseDpi !== null && pollingRate !== null ? (
        <p>
          The build uses: {PLATFORM_LABELS[platform]}, {OUTPUT_TYPE_LABELS[outputType].title} output, {mouseDpi} DPI,{' '}
          {pollingRate} Hz.
        </p>
      ) : (
        <>
          <p>
            <strong>Not set yet:</strong> {listText(missing)}.
          </p>
          <p className="hint">
            You can still build.
            {(platform === null || outputType === null) &&
              ' Until your platform and output type are set, the MATRIX setup step shows the checks for all of them.'}
            {(mouseDpi === null || pollingRate === null) &&
              ' Your mouse DPI and polling rate are shown next to the checks that use them.'}
          </p>
        </>
      )}
      <p>
        <Link className="button secondary small" to="/profile">
          {missing.length > 0 ? 'Complete your profile' : 'Edit your profile'}
        </Link>
      </p>
    </section>
  );
}

/** Build my config: a loadout to build for (the build starts from one), then the profile's readiness. */
export function BuildIndexScreen() {
  const { data } = useData();
  const headingId = useId();
  const { loadouts } = data;

  return (
    <Screen
      title="Build my config"
      back={{ to: '/', label: 'Home' }}
      intro={
        <>
          <p className="lede">
            Destiny 2’s settings, your MATRIX setup, then the aim settings for one loadout, in the order they depend
            on each other, ending in a config sheet to take to the console.
          </p>
          <HowThisWorks flow="build" />
        </>
      }
    >
      <section className="learn-section" aria-labelledby={headingId}>
        <h2 className="section-title" id={headingId}>
          Choose a loadout
        </h2>
        {loadouts.length === 0 ? (
          <EmptyState title="No loadouts yet" level={3}>
            <p>
              Each loadout gets its own Config, tuned toward its main weapon’s aim style, so the build starts from a
              loadout. Add the weapons you run and mark the main one.
            </p>
            <p>
              <Link className="button primary" to="/loadouts/new">
                Add a loadout
              </Link>
            </p>
          </EmptyState>
        ) : (
          <>
            <p className="hint">
              Each loadout gets its own config sheet. The Destiny 2 settings and the MATRIX setup steps are shared by
              every loadout, so what you tick there counts for all of them.
            </p>
            <ul className="flow-cards" aria-label="Your loadouts">
              {loadouts.map((loadout) => (
                <LoadoutCard key={loadout.id} loadout={loadout} to={buildPath(loadout.id)} />
              ))}
            </ul>
          </>
        )}
      </section>

      <ProfileReadiness profile={data.profile} />
    </Screen>
  );
}
