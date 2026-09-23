import { useSyncExternalStore } from 'react';

/** The install offer Chrome, Edge and Samsung Internet make. TypeScript's DOM types don't include it. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallState {
  /** The browser's install offer, kept for our own Install button. It can be used once. */
  readonly offer: BeforeInstallPromptEvent | null;
  /** Installed during this visit (the app itself doesn't know about earlier installs). */
  readonly installed: boolean;
}

const INITIAL: InstallState = { offer: null, installed: false };
let state = INITIAL;
const subscribers = new Set<() => void>();

function setState(next: InstallState) {
  state = next;
  subscribers.forEach((notify) => notify());
}

/**
 * Starts listening for the browser's install offer. Called once at startup, because the offer
 * can arrive before any screen that shows the Install button has mounted. The returned function
 * stops listening and forgets any offer (the tests use it to start clean).
 */
export function listenForInstall(target: Window = window): () => void {
  const onOffer = (event: Event) => {
    // Keeps the browser's own banner away: Dialed shows its Install button instead.
    event.preventDefault();
    setState({ ...state, offer: event as BeforeInstallPromptEvent });
  };
  const onInstalled = () => setState({ offer: null, installed: true });
  target.addEventListener('beforeinstallprompt', onOffer);
  target.addEventListener('appinstalled', onInstalled);
  return () => {
    target.removeEventListener('beforeinstallprompt', onOffer);
    target.removeEventListener('appinstalled', onInstalled);
    setState(INITIAL);
  };
}

/** Opened from the home screen (or the desktop app window) rather than in a browser tab. */
function runningInstalled(): boolean {
  const standaloneMedia =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari reports a home-screen web app with this instead of the media query.
  return standaloneMedia || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone and iPad: no install offer event, only Share › Add to Home Screen. */
function isIos(): boolean {
  // iPadOS asks for the desktop site, so it reports as a Mac. Touch gives it away.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/**
 * How this browser can install Dialed:
 * - `installed`: already running as the installed app, so nothing to offer.
 * - `unavailable`: not on HTTPS (e.g. the dev server over the local network), where browsers can't install.
 * - `button`: the browser made an install offer, so the Install button works.
 * - `ios`: iPhone or iPad, installed from the Share menu.
 * - `menu`: any other browser, installed from its own menu.
 */
export type InstallOption = 'installed' | 'unavailable' | 'button' | 'ios' | 'menu';

function subscribe(notify: () => void) {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

function getState() {
  return state;
}

export function useInstall(): { option: InstallOption; install: () => Promise<void> } {
  const { offer, installed } = useSyncExternalStore(subscribe, getState, getState);

  let option: InstallOption;
  if (installed || runningInstalled()) option = 'installed';
  else if (!window.isSecureContext) option = 'unavailable';
  else if (offer) option = 'button';
  else if (isIos()) option = 'ios';
  else option = 'menu';

  const install = async () => {
    if (!offer) return;
    // The offer can be shown only once, whatever the answer.
    setState({ ...state, offer: null });
    await offer.prompt();
    const { outcome } = await offer.userChoice;
    if (outcome === 'accepted') setState({ ...state, installed: true });
  };

  return { option, install };
}
