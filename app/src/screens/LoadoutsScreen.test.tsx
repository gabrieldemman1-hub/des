import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emptyKnowledge, sampleData, sampleLoadout } from '../test/fixtures';
import { MemoryStorage } from '../test/memory-storage';
import { renderApp } from '../test/render';
import type { AppData } from '../state/schema';
import { STORAGE_KEY } from '../state/storage';

function storageWith(data: AppData) {
  return new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) });
}

function stored(storage: MemoryStorage): AppData {
  return storage.json(STORAGE_KEY) as AppData;
}

function tab(name: string) {
  return within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name });
}

describe('Loadouts', () => {
  it('shows a friendly empty state while the weapon list is missing', () => {
    renderApp({ path: '/loadouts', knowledge: emptyKnowledge });
    expect(screen.getByRole('heading', { name: 'The weapon list isn’t ready yet' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add a loadout' })).not.toBeInTheDocument();
  });

  it('shows the same message instead of an empty form at /loadouts/new', () => {
    renderApp({ path: '/loadouts/new', knowledge: emptyKnowledge });
    expect(screen.getByRole('heading', { name: 'The weapon list isn’t ready yet' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
  });

  it('invites you to add one when there are none', () => {
    renderApp({ path: '/loadouts' });
    expect(screen.getByRole('heading', { name: 'No loadouts yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a loadout' })).toBeInTheDocument();
  });

  it('creates a loadout', async () => {
    const { user, storage } = renderApp({ path: '/loadouts' });
    await user.click(screen.getByRole('link', { name: 'Add a loadout' }));
    expect(screen.getByRole('heading', { level: 1, name: 'New loadout' })).toBeInTheDocument();

    // Saving an empty form explains what's missing.
    await user.click(screen.getByRole('button', { name: 'Save loadout' }));
    expect(screen.getByText('Give the loadout a name.')).toBeInTheDocument();
    expect(screen.getByText('Pick at least one weapon.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Peek');
    const kinetic = screen.getByRole('combobox', { name: 'Kinetic' });
    // Options come from the knowledge base, grouped by aim style.
    expect(within(kinetic).getAllByRole('group').map((g) => g.getAttribute('label'))).toEqual([
      'Tracking',
      'Snap / peek',
      'Precision hold',
      'No aim style',
    ]);
    await user.selectOptions(kinetic, 'hand-cannon');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Power' }), 'shotgun');

    // The first weapon picked becomes the main one; empty slots can't be main.
    const main = screen.getByRole('group', { name: 'Main weapon' });
    expect(within(main).getByRole('radio', { name: /Kinetic/ })).toBeChecked();
    expect(within(main).getByRole('radio', { name: /Energy/ })).toBeDisabled();

    // The main weapon's aim style, with a "reasoned" badge and the reasoning on tap.
    expect(screen.getByText('Snap / peek', { selector: '.aim-style-name' })).toBeInTheDocument();
    expect(screen.getByText('Reasoned')).toBeInTheDocument();
    const why = screen.getByText('Why snap / peek for Hand Cannon?');
    expect(screen.getByText('Peek shots start from a standstill.', { exact: false })).not.toBeVisible();
    await user.click(why);
    expect(screen.getByText('Peek shots start from a standstill.', { exact: false })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save loadout' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Loadouts' })).toBeInTheDocument();
    expect(screen.getByText('Saved “Peek”.')).toBeInTheDocument();
    const card = screen.getByRole('heading', { level: 2, name: 'Peek' }).closest('li')!;
    expect(card).toHaveTextContent(/KineticHand CannonMain/);
    expect(card).toHaveTextContent(/EnergyEmpty/);
    expect(card).toHaveTextContent(/PowerShotgun/);

    const [loadout] = stored(storage).loadouts;
    expect(loadout).toMatchObject({
      name: 'Peek',
      weapons: { kinetic: 'hand-cannon', energy: null, power: 'shotgun' },
      mainSlot: 'kinetic',
    });
  });

  it('says so when the main weapon has no aim style', async () => {
    const { user } = renderApp({ path: '/loadouts/new' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Power' }), 'sword');
    expect(screen.getByText('No aim style', { selector: '.aim-style-name' })).toBeInTheDocument();
    expect(screen.getByText('Gap')).toBeInTheDocument();
    await user.click(screen.getByText('Why no aim style for Sword?'));
    expect(screen.getByText('Swords are melee weapons, so no aim style applies.')).toBeVisible();
  });

  it('asks for a main weapon when the main one is cleared and two are left', async () => {
    const data = sampleData({
      loadouts: [sampleLoadout({ weapons: { kinetic: 'pulse-rifle', energy: 'shotgun', power: 'scout-rifle' } })],
    });
    const { user, storage } = renderApp({ path: '/loadouts/l1', storage: storageWith(data) });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Kinetic' }), '');
    const main = screen.getByRole('group', { name: 'Main weapon' });
    expect(within(main).getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Choose which weapon is the main one.')).toBeInTheDocument();
    expect(stored(storage).loadouts[0]?.weapons.kinetic).toBe('pulse-rifle'); // nothing saved yet

    await user.click(within(main).getByRole('radio', { name: /Power/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(stored(storage).loadouts[0]).toMatchObject({
      weapons: { kinetic: null, energy: 'shotgun', power: 'scout-rifle' },
      mainSlot: 'power',
    });
  });

  it('edits a loadout', async () => {
    const { user, storage } = renderApp({
      path: '/loadouts',
      storage: storageWith(sampleData({ loadouts: [sampleLoadout()] })),
    });
    const card = screen.getByRole('heading', { level: 2, name: 'Pulse + shotgun' }).closest('li')!;
    expect(within(card).getByText('Tracking')).toBeInTheDocument();

    await user.click(within(card).getByRole('link', { name: 'Edit Pulse + shotgun' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Edit loadout' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('Pulse + shotgun');

    await user.clear(name);
    await user.type(name, 'Shotgun main');
    await user.click(screen.getByRole('radio', { name: /Energy/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const edited = screen.getByRole('heading', { level: 2, name: 'Shotgun main' }).closest('li')!;
    expect(edited).toHaveTextContent(/EnergyShotgunMain/);
    expect(within(edited).getByText('Snap / peek')).toBeInTheDocument();
    expect(stored(storage).loadouts).toHaveLength(1);
    expect(stored(storage).loadouts[0]).toMatchObject({ id: 'l1', name: 'Shotgun main', mainSlot: 'energy' });
  });

  it('deletes a loadout only after confirmation', async () => {
    const { user, storage } = renderApp({
      path: '/loadouts/l1',
      storage: storageWith(sampleData({ loadouts: [sampleLoadout(), sampleLoadout({ id: 'l2', name: 'Keep me' })] })),
    });

    await user.click(screen.getByRole('button', { name: 'Delete loadout' }));
    let dialog = screen.getByRole('alertdialog', { name: 'Delete “Pulse + shotgun”?' });
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Edit loadout' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete loadout' }));
    dialog = screen.getByRole('alertdialog', { name: 'Delete “Pulse + shotgun”?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Loadouts' })).toBeInTheDocument();
    expect(screen.getByText('Deleted “Pulse + shotgun”.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pulse + shotgun' })).not.toBeInTheDocument();
    expect(stored(storage).loadouts.map((l) => l.id)).toEqual(['l2']);
  });

  it('leaves the finished editor out of history, so Back skips it', async () => {
    const { user, router } = renderApp({ path: '/' });
    await user.click(tab('Loadouts'));
    await user.click(screen.getByRole('link', { name: 'Add a loadout' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Peek');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Kinetic' }), 'hand-cannon');
    await user.click(screen.getByRole('button', { name: 'Save loadout' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Loadouts' })).toBeInTheDocument();
    // Shown in a live region that stays mounted, so screen readers announce it.
    expect(screen.getByText('Saved “Peek”.').closest('[aria-live="polite"]')).toBeInTheDocument();
    expect(router.state.location.state).toBeNull(); // nothing to come back on reload

    // Back goes to where the list was opened from, not into the editor or a second list.
    await act(() => router.navigate(-1));
    expect(screen.getByRole('heading', { level: 1, name: 'Dialed' })).toBeInTheDocument();
    expect(screen.queryByText('Saved “Peek”.')).not.toBeInTheDocument();

    // And returning to the list doesn't bring the confirmation back.
    await user.click(tab('Loadouts'));
    expect(screen.getByRole('heading', { level: 2, name: 'Peek' })).toBeInTheDocument();
    expect(screen.queryByText('Saved “Peek”.')).not.toBeInTheDocument();
  });

  it('does not go Back into a deleted loadout', async () => {
    const { user, router } = renderApp({
      path: '/',
      storage: storageWith(sampleData({ loadouts: [sampleLoadout()] })),
    });
    await user.click(tab('Loadouts'));
    await user.click(screen.getByRole('link', { name: 'Edit Pulse + shotgun' }));
    await user.click(screen.getByRole('button', { name: 'Delete loadout' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Deleted “Pulse + shotgun”.')).toBeInTheDocument();

    await act(() => router.navigate(-1));
    expect(screen.getByRole('heading', { level: 1, name: 'Dialed' })).toBeInTheDocument();
  });

  it('Cancel and the back link return to the list without adding to history', async () => {
    const { user, router } = renderApp({ path: '/' });
    await user.click(tab('Loadouts'));
    await user.click(screen.getByRole('link', { name: 'Add a loadout' }));
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Loadouts' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Add a loadout' }));
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Loadouts' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Loadouts' })).toBeInTheDocument();

    await act(() => router.navigate(-1));
    expect(screen.getByRole('heading', { level: 1, name: 'Dialed' })).toBeInTheDocument();
  });

  it('replaces the editor with the list when it was opened directly', async () => {
    const { user, router } = renderApp({ path: '/loadouts/new' });
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Peek');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Kinetic' }), 'hand-cannon');
    await user.click(screen.getByRole('button', { name: 'Save loadout' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Loadouts' })).toBeInTheDocument();
    expect(screen.getByText('Saved “Peek”.')).toBeInTheDocument();
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('copes with a saved loadout whose weapon is no longer in the knowledge base', () => {
    const data = sampleData({ loadouts: [sampleLoadout({ weapons: { kinetic: 'gone', energy: null, power: null } })] });
    renderApp({ path: '/loadouts', storage: storageWith(data) });
    expect(screen.getByText('Unknown weapon')).toBeInTheDocument();
    expect(screen.getByText(/aim style is unknown/)).toBeInTheDocument();
  });

  it('says so when a loadout does not exist', () => {
    renderApp({ path: '/loadouts/nope' });
    expect(screen.getByRole('heading', { level: 1, name: 'Loadout not found' })).toBeInTheDocument();
  });
});

describe('Loadout config links', () => {
  it('links each loadout to its config sheet, build and tune pages', () => {
    renderApp({ path: '/loadouts', storage: storageWith(sampleData({ loadouts: [sampleLoadout()] })) });
    const links = within(screen.getByRole('list', { name: 'Pulse + shotgun: config' })).getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Config sheet', '/loadouts/l1/sheet'],
      ['Build', '/build/l1'],
      ['Tune', '/tune/l1'],
    ]);
  });
});
