import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONFIDENCE_LEVELS, knowledge } from '../../knowledge/index';
import { CONFIDENCE_INFO } from './content/labels';
import { buildPlan, planProgress, stepKeys } from './features/build/build-plan';
import { checksForProfile } from './state/guidance';
import { createKnowledgeApi } from './state/knowledge-context';
import { emptyConfig } from './state/schema';
import { STORAGE_KEY } from './state/storage';
import { sampleData, sampleLoadout, weaponKnowledge } from './test/fixtures';
import { MemoryStorage } from './test/memory-storage';
import { renderApp } from './test/render';

describe('app shell', () => {
  it('has four tabs with the current one marked', async () => {
    const { user } = renderApp();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const tabs = within(nav).getAllByRole('link');
    expect(tabs.map((t) => t.textContent)).toEqual(['Home', 'Loadouts', 'Learn', 'Profile']);
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(nav).getByRole('link', { name: 'Profile' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(document.title).toBe('Profile · Dialed');
  });

  it('reaches Sources from Learn and Profile, and goes back to where it was opened from', async () => {
    const { user } = renderApp({ path: '/profile' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(screen.getByRole('link', { name: /^Sources and confidence labels/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Sources' })).toBeInTheDocument();
    expect(document.title).toBe('Sources · Dialed');
    // Reference material: the Learn tab stays lit, and the back link returns to Profile.
    expect(within(nav).getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');
    const back = document.querySelector<HTMLAnchorElement>('.back-link')!;
    expect(back).toHaveTextContent('Profile');
    await user.click(back);
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();

    await user.click(within(nav).getByRole('link', { name: 'Learn' }));
    await user.click(screen.getByRole('link', { name: /^Sources and confidence labels/ }));
    expect(document.querySelector('.back-link')).toHaveTextContent('Learn');
  });

  it('sends Sources opened any other way back to Learn', () => {
    renderApp({ path: '/sources' });
    const back = document.querySelector('.back-link')!;
    expect(back).toHaveTextContent('Learn');
    expect(back).toHaveAttribute('href', '/learn');
  });

  it('home lists your loadouts with their progress, then the four flows with where you are in them', () => {
    const real = createKnowledgeApi(knowledge);
    const data = sampleData({ loadouts: [sampleLoadout(), sampleLoadout({ id: 'l2', name: 'Peek' })] });
    data.profile.platform = 'xbox';
    const config = emptyConfig();
    config.matrix.configDpi = 1600;
    data.configs = { l1: config };
    const plan = buildPlan(real, data.profile, sampleLoadout());
    const keys = stepKeys(plan);
    data.progress = { [keys['destiny-2'][0]!]: 'done', [keys.matrix[0]!]: 'problem' };
    renderApp({ knowledge: real, storage: new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) }) });

    expect(screen.getByRole('heading', { level: 1, name: 'Dialed' })).toBeInTheDocument();
    expect(screen.getByText(/Evidence-based XIM MATRIX setup for Destiny 2/)).toBeInTheDocument();

    // The loadout touched last leads (a tie keeps the list's order): its sheet's progress as a
    // ruler, the next step as the one amber button, and its config sheet. The others are one row each.
    const total = planProgress(plan, data.progress).total;
    const strip = screen.getByRole('list', { name: 'Your loadouts' });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(2);
    const hero = within(strip).getByRole('listitem', { name: 'Pulse + shotgun' });
    expect(within(hero).getByRole('img', { name: `Sheet 1 of ${total} done · 1 needs fixing` })).toBeInTheDocument();
    const build = within(hero).getByRole('link', { name: 'Continue build for Pulse + shotgun' });
    expect(build).toHaveAttribute('href', '/build/l1');
    expect(build).toHaveClass('primary');
    expect(within(hero).getByRole('link', { name: 'Config sheet for Pulse + shotgun' })).toHaveAttribute(
      'href',
      '/loadouts/l1/sheet',
    );
    expect(strip.querySelectorAll('.button.primary')).toHaveLength(1);
    const peek = within(strip).getByRole('link', { name: /^Peek/ });
    expect(peek).toHaveAttribute('href', '/loadouts/l2/sheet');
    expect(peek).toHaveAccessibleName(`Peek Sheet 1 of ${total} done · 1 needs fixing`);
    expect(screen.queryByRole('heading', { name: 'Start here' })).not.toBeInTheDocument();

    const flows = within(screen.getByRole('list', { name: 'Tools' })).getAllByRole('link');
    expect(flows.map((f) => [f.querySelector('.tool-tile-title')?.textContent, f.getAttribute('href')])).toEqual([
      ['Build my config', '/build'],
      ['Tune my config', '/tune'],
      ['Troubleshoot by feel', '/troubleshoot'],
      ['Explain a concept', '/learn'],
    ]);
    // No constant label: each card says where you are in it, or nothing.
    expect(screen.queryByText('Ready to use')).not.toBeInTheDocument();
    expect(flows[0]!.querySelector('.tool-tile-status')).toBeNull();
    expect(flows[1]).toHaveTextContent('Settings entered for 1 of 2 loadouts');
    const checks = checksForProfile(knowledge.foundation, data.profile).length;
    expect(flows[2]).toHaveTextContent(`0 of ${checks} setup checks done · 1 needs fixing`);
    expect(flows[2]!.querySelector('.tool-tile-status')).toHaveClass('is-problem');
    expect(flows[3]!.querySelector('.tool-tile-status')).toBeNull();
    // Gap statements cite nothing, so Home doesn't promise a source for everything.
    expect(screen.getByText(/with its source wherever one exists/)).toHaveClass('footnote');
  });

  it('home leads with the loadout edited last', () => {
    const data = sampleData({
      loadouts: [
        sampleLoadout({ updatedAt: '2026-08-01T00:00:00.000Z' }),
        sampleLoadout({ id: 'l2', name: 'Peek', updatedAt: '2026-09-01T00:00:00.000Z' }),
      ],
    });
    renderApp({ storage: new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) }) });
    const strip = screen.getByRole('list', { name: 'Your loadouts' });
    expect(strip.firstElementChild).toHaveAccessibleName('Peek');
    expect(within(strip).getByRole('link', { name: /^Start build for Peek$/ })).toHaveAttribute('href', '/build/l2');
  });

  it('home counts saving a loadout’s settings as touching it', () => {
    const data = sampleData({
      loadouts: [
        sampleLoadout({ updatedAt: '2026-08-01T00:00:00.000Z' }),
        sampleLoadout({ id: 'l2', name: 'Peek', updatedAt: '2026-09-01T00:00:00.000Z' }),
      ],
    });
    data.configs = { l1: { ...emptyConfig(), updatedAt: '2026-09-20T00:00:00.000Z' } };
    renderApp({ storage: new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) }) });
    expect(screen.getByRole('list', { name: 'Your loadouts' }).firstElementChild).toHaveAccessibleName('Pulse + shotgun');
  });

  it('home starts a first-run user with a loadout, the one step Build and Tune need', () => {
    renderApp();
    const start = screen.getByRole('region', { name: 'Start here' });
    expect(within(start).getByRole('link', { name: 'Add your first loadout' })).toHaveAttribute('href', '/loadouts/new');
    expect(within(start).getByRole('link', { name: 'Fill in your profile' })).toHaveAttribute('href', '/profile');
    // Only platform and output type filter the setup checks; the mouse values are shown, not used as a filter.
    expect(start).toHaveTextContent(
      'Platform and output type decide which setup checks apply to you. Your mouse DPI and polling rate are shown on the DPI and polling-rate checks in Build my config.',
    );
    expect(screen.queryByRole('list', { name: 'Your loadouts' })).not.toBeInTheDocument();

    const flows = within(screen.getByRole('list', { name: 'Tools' })).getAllByRole('link');
    expect(flows[0]).toHaveTextContent('Needs a loadout');
    expect(flows[1]).toHaveTextContent('Needs a loadout');
    expect(flows[2]).not.toHaveTextContent('Needs a loadout');
    expect(flows[3]).not.toHaveTextContent('Needs a loadout');
    expect(screen.queryByText('Ready to use')).not.toBeInTheDocument();
  });

  it('keeps Home as the current tab inside a flow, and sends old flow addresses to the flow', async () => {
    const { user, router } = renderApp({ path: '/flows/troubleshoot' });
    expect(router.state.location.pathname).toBe('/troubleshoot');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(nav).getByRole('link', { name: 'Home' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Dialed' })).toBeInTheDocument();
  });

  it('sources lists the whitelist and the six confidence labels', () => {
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
