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

    // Each loadout: its config sheet with the sheet's progress, and the build behind it.
    const total = planProgress(plan, data.progress).total;
    const strip = screen.getByRole('list', { name: 'Your loadouts' });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(2);
    const sheet = within(strip).getByRole('link', { name: /^Pulse \+ shotgun/ });
    expect(sheet).toHaveAttribute('href', '/loadouts/l1/sheet');
    expect(sheet).toHaveTextContent(`Sheet 1 of ${total} done · 1 needs fixing`);
    const build = within(strip).getByRole('link', { name: 'Continue build for Pulse + shotgun' });
    expect(build).toHaveAttribute('href', '/build/l1');
    expect(screen.queryByRole('heading', { name: 'Start here' })).not.toBeInTheDocument();

    const flows = within(screen.getByRole('list', { name: 'What do you want to do?' })).getAllByRole('link');
    expect(flows.map((f) => [f.querySelector('.flow-card-title')?.textContent, f.getAttribute('href')])).toEqual([
      ['Build my config', '/build'],
      ['Tune my config', '/tune'],
      ['Troubleshoot by feel', '/troubleshoot'],
      ['Explain a concept', '/learn'],
    ]);
    // No constant label: each card says where you are in it, or nothing.
    expect(screen.queryByText('Ready to use')).not.toBeInTheDocument();
    expect(flows[0]!.querySelector('.flow-card-status')).toBeNull();
    expect(flows[1]).toHaveTextContent('Settings entered for 1 of 2 loadouts');
    const checks = checksForProfile(knowledge.foundation, data.profile).length;
    expect(flows[2]).toHaveTextContent(`0 of ${checks} setup checks done · 1 needs fixing`);
    expect(flows[3]!.querySelector('.flow-card-status')).toBeNull();
  });

  it('home starts a first-run user with a loadout, the one step Build and Tune need', () => {
    renderApp();
    const start = screen.getByRole('region', { name: 'Start here' });
    expect(within(start).getByRole('link', { name: 'Add your first loadout' })).toHaveAttribute('href', '/loadouts/new');
    expect(within(start).getByRole('link', { name: 'Fill in your profile' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByRole('list', { name: 'Your loadouts' })).not.toBeInTheDocument();

    const flows = within(screen.getByRole('list', { name: 'What do you want to do?' })).getAllByRole('link');
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
