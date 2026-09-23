import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONFIDENCE_LEVELS } from '../../knowledge/index';
import { CONFIDENCE_INFO } from './content/labels';
import { STORAGE_KEY } from './state/storage';
import { sampleData, sampleLoadout, weaponKnowledge } from './test/fixtures';
import { MemoryStorage } from './test/memory-storage';
import { renderApp } from './test/render';

describe('app shell', () => {
  it('has a tab bar with the current tab marked', async () => {
    const { user } = renderApp();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const tabs = within(nav).getAllByRole('link');
    expect(tabs.map((t) => t.textContent)).toEqual(['Home', 'Learn', 'Loadouts', 'Profile', 'Sources']);
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(nav).getByRole('link', { name: 'Sources' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Sources' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Sources' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(document.title).toBe('Sources · Dialed');
  });

  it('home shows the purpose, what is saved, and the four flows', () => {
    const data = sampleData({ loadouts: [sampleLoadout(), sampleLoadout({ id: 'l2' })] });
    data.profile.platform = 'xbox';
    renderApp({ storage: new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) }) });

    expect(screen.getByRole('heading', { level: 1, name: 'Dialed' })).toBeInTheDocument();
    expect(screen.getByText(/Evidence-based XIM MATRIX setup for Destiny 2/)).toBeInTheDocument();
    expect(screen.getByText(/Saved on this phone:/).closest('p')).toHaveTextContent('Saved on this phone: Xbox · 2 loadouts');
    const ready = screen.getAllByRole('link', { name: /Ready to use/ });
    expect(ready.map((f) => [f.querySelector('.flow-card-title')?.textContent, f.getAttribute('href')])).toEqual([
      ['Build my config', '/build'],
      ['Tune my config', '/tune'],
      ['Troubleshoot by feel', '/troubleshoot'],
      ['Explain a concept', '/learn'],
    ]);
  });

  it('home points to the profile when nothing is saved', () => {
    renderApp();
    expect(screen.getByText(/Saved on this phone:/).closest('p')).toHaveTextContent(
      'Saved on this phone: Platform not set · no loadouts · Set up your profile',
    );
    expect(screen.getByRole('link', { name: 'Set up your profile' })).toHaveAttribute('href', '/profile');
  });

  it('keeps Home as the current tab inside a flow, and sends old flow addresses to the flow', async () => {
    const { user, router } = renderApp({ path: '/flows/troubleshoot' });
    expect(router.state.location.pathname).toBe('/troubleshoot');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(nav).getByRole('link', { name: 'Home' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Dialed' })).toBeInTheDocument();
  });

  it('sources lists the whitelist and the five confidence labels', () => {
    renderApp({ path: '/sources', knowledge: weaponKnowledge });
    const guide = screen.getByRole('link', { name: /XIM MATRIX User Guide/ });
    expect(guide).toHaveAttribute('href', 'https://guide.xim.tech/');
    expect(guide).toHaveAttribute('target', '_blank');
    expect(guide.closest('li')).toHaveTextContent('Official');
    expect(screen.getByRole('link', { name: /XIM Central/ }).closest('li')).toHaveTextContent('Community expert');

    for (const level of CONFIDENCE_LEVELS) {
      const { label, meaning } = CONFIDENCE_INFO[level];
      const badge = screen.getByText(label, { selector: '.badge' });
      expect(badge).toHaveTextContent(`Confidence: ${label}`);
      expect(badge.closest('li')).toHaveTextContent(meaning);
    }
  });

  it('shows a non-blocking notice when saved data is corrupt', async () => {
    const storage = new MemoryStorage({ [STORAGE_KEY]: '{oops' });
    const { user } = renderApp({ storage });
    expect(screen.getByRole('status')).toHaveTextContent(/couldn’t be read, so Dialed started fresh/);
    expect(storage.getItem('dialed:v1:unreadable')).toBe('{oops');
    // The app still works.
    expect(screen.getByRole('heading', { level: 1, name: 'Dialed' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/started fresh/)).not.toBeInTheDocument();
  });

  it('warns when the browser blocks storage, and keeps working', async () => {
    const { user } = renderApp({ path: '/profile', storage: null });
    expect(screen.getByText(/isn’t letting Dialed save anything/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'PC' }));
    expect(screen.getByRole('radio', { name: 'PC' })).toBeChecked();
  });

  it('warns when a save fails', async () => {
    const { user } = renderApp({ path: '/profile', storage: new MemoryStorage({}, { write: true }) });
    expect(screen.queryByText(/couldn’t save/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Xbox' }));
    expect(screen.getByText(/Dialed couldn’t save on this phone/)).toBeInTheDocument();
  });

  it('shows a not-found screen for unknown addresses', () => {
    renderApp({ path: '/nowhere' });
    expect(screen.getByRole('heading', { level: 1, name: 'Not found' })).toBeInTheDocument();
  });
});
