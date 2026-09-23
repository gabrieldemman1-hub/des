import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listenForInstall, type BeforeInstallPromptEvent } from '../pwa/install';
import { renderApp } from '../test/render';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';

/** Fires the browser's install offer, answered with `outcome` when shown. */
function makeOffer(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome, platform: 'web' }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

function installCard() {
  return screen.queryByRole('region', { name: 'Install Dialed' });
}

let stopListening: () => void;

beforeEach(() => {
  // jsdom isn't a secure context; the real app is served over HTTPS.
  vi.stubGlobal('isSecureContext', true);
  stopListening = listenForInstall();
});

afterEach(() => {
  act(() => stopListening());
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'userAgent');
});

describe('Install Dialed', () => {
  it('turns the browser’s install offer into an Install button on Home', async () => {
    const { event, prompt } = makeOffer('accepted');
    expect(event.defaultPrevented).toBe(true);
    const { user } = renderApp();

    const card = installCard();
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent('works offline next to your console');
    await user.click(within(card!).getByRole('button', { name: 'Install' }));

    expect(prompt).toHaveBeenCalledOnce();
    expect(installCard()).not.toBeInTheDocument();
  });

  it('falls back to the browser menu when the install offer is turned down', async () => {
    makeOffer('dismissed');
    const { user } = renderApp();

    await user.click(within(installCard()!).getByRole('button', { name: 'Install' }));

    const card = installCard();
    expect(within(card!).queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    expect(card).toHaveTextContent('choose Install app or Add to Home Screen');
  });

  it('remembers “Not now” on Home, and Profile still offers the install', async () => {
    makeOffer();
    const first = renderApp();
    await first.user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(installCard()).not.toBeInTheDocument();
    first.unmount();

    const again = renderApp();
    expect(installCard()).not.toBeInTheDocument();
    await again.user.click(screen.getByRole('link', { name: 'Profile' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Install Dialed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
  });

  it('tells iPhone users to use Share › Add to Home Screen and to bring a backup', () => {
    Object.defineProperty(navigator, 'userAgent', { value: IPHONE, configurable: true });
    renderApp();

    const card = installCard();
    expect(card).toHaveTextContent('Tap Share (the square with an arrow), then Add to Home Screen.');
    expect(card).toHaveTextContent('the installed app keeps its own saved data');
    expect(within(card!).getByRole('link', { name: 'download a backup from your Profile' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(within(card!).queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    expect(within(card!).getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  it('points other browsers to their own menu', () => {
    renderApp();
    expect(installCard()).toHaveTextContent('Open your browser’s menu and choose Install app or Add to Home Screen.');
  });

  it('offers nothing inside the installed app', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(display-mode: standalone)' }));
    makeOffer();
    const { user } = renderApp();

    expect(installCard()).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Profile' }));
    expect(screen.queryByRole('heading', { name: 'Install Dialed' })).not.toBeInTheDocument();
  });

  it('offers nothing without HTTPS, where browsers can’t install', () => {
    vi.stubGlobal('isSecureContext', false);
    renderApp();
    expect(installCard()).not.toBeInTheDocument();
  });
});
