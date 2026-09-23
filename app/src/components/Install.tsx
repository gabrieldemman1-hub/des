import { useId, useState } from 'react';
import { Link } from 'react-router';
import { useInstall, type InstallOption } from '../pwa/install';

/** Remembers "Not now" on the Home card. Profile keeps offering the install either way. */
const DISMISSED_KEY = 'dialed:install-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Storage blocked: the card just comes back next visit.
  }
}

const WHY = 'It opens full screen from your home screen, like any other app, and works offline next to your console.';

function HowTo({ option, onBackup }: { option: InstallOption; onBackup: boolean }) {
  if (option === 'ios') {
    return (
      <>
        <p>
          Tap <strong>Share</strong> (the square with an arrow), then <strong>Add to Home Screen</strong>.
        </p>
        <p className="hint">
          On iPhone and iPad the installed app keeps its own saved data. If you’ve already set things up here,{' '}
          {onBackup ? 'download a backup below first' : <Link to="/profile">download a backup from your Profile</Link>}{' '}
          and restore it in the installed app.
        </p>
      </>
    );
  }
  if (option === 'menu') {
    return (
      <p>
        Open your browser’s menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.
      </p>
    );
  }
  return null;
}

/** Home: offers the install once, until "Not now". */
export function InstallCard() {
  const { option, install } = useInstall();
  const [dismissed, setDismissed] = useState(readDismissed);
  const titleId = useId();

  if (dismissed || option === 'installed' || option === 'unavailable') return null;

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  return (
    <section className="card install-card" aria-labelledby={titleId}>
      <h2 id={titleId}>Install Dialed</h2>
      <p>{WHY}</p>
      <HowTo option={option} onBackup={false} />
      <div className="button-row">
        {option === 'button' && (
          <button type="button" className="button primary" onClick={() => void install()}>
            Install
          </button>
        )}
        <button type="button" className="button secondary" onClick={dismiss}>
          {option === 'button' ? 'Not now' : 'Got it'}
        </button>
      </div>
    </section>
  );
}

/** Profile: always there (unless installed), so "Not now" on Home is never final. */
export function InstallSection() {
  const { option, install } = useInstall();
  if (option === 'installed' || option === 'unavailable') return null;

  return (
    <section className="form-section" aria-labelledby="profile-install">
      <h2 id="profile-install">Install Dialed</h2>
      <p className="hint">{WHY}</p>
      <HowTo option={option} onBackup />
      {option === 'button' && (
        <div className="button-row">
          <button type="button" className="button primary" onClick={() => void install()}>
            Install
          </button>
        </div>
      )}
    </section>
  );
}
