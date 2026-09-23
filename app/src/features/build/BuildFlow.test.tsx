import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { knowledge } from '../../../../knowledge/index';
import { EASING_CAVEAT } from '../../../../knowledge/integrity';
import { createKnowledgeApi } from '../../state/knowledge-context';
import { progressKey } from '../../state/progress';
import { emptyConfig, type AppData, type Profile } from '../../state/schema';
import { STORAGE_KEY } from '../../state/storage';
import { sampleData, sampleLoadout } from '../../test/fixtures';
import { MemoryStorage } from '../../test/memory-storage';
import { renderApp } from '../../test/render';
import { buildPlan, planProgress, stepKeys } from './build-plan';

const real = createKnowledgeApi(knowledge);

const handCannon = sampleLoadout({
  id: 'l2',
  name: 'Peek',
  weapons: { kinetic: 'hand-cannon', energy: null, power: 'sniper-rifle' },
});

function storageWith(data: AppData) {
  return new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) });
}

function stored(storage: MemoryStorage): AppData {
  return storage.json(STORAGE_KEY) as AppData;
}

function withProfile(patch: Partial<Profile>, overrides: Partial<AppData> = {}): AppData {
  const data = sampleData({ loadouts: [sampleLoadout(), handCannon], ...overrides });
  data.profile = { ...data.profile, ...patch };
  return data;
}

function render(path: string, data: AppData = withProfile({})) {
  return renderApp({ path, knowledge: real, storage: storageWith(data) });
}

function checkTitle(id: string): string {
  const check = knowledge.foundation.find((c) => c.id === id);
  if (!check) throw new Error(`No setup check ${id}`);
  return check.title;
}

describe('Build my config: choosing a loadout', () => {
  it('lists each loadout with its aim style and progress, and what the profile is missing', () => {
    const data = withProfile({});
    const plan = buildPlan(real, data.profile, sampleLoadout());
    const [first, second] = stepKeys(plan)['destiny-2'];
    data.progress = { [first!]: 'done', [second!]: 'done' };
    render('/build', data);

    expect(screen.getByRole('heading', { level: 1, name: 'Build my config' })).toBeInTheDocument();
    const total = planProgress(plan, data.progress).total;
    const pulse = screen.getByRole('link', { name: /Pulse \+ shotgun/ });
    expect(pulse).toHaveAttribute('href', '/build/l1');
    expect(pulse).toHaveTextContent('Pulse Rifle (main), Shotgun');
    expect(pulse).toHaveTextContent('Aim style: Tracking');
    expect(pulse).toHaveTextContent(`2 of ${total} steps done`);
    expect(screen.getByRole('link', { name: /Peek/ })).toHaveTextContent('Aim style: Snap');

    const profile = screen.getByRole('region', { name: 'Your profile' });
    expect(profile).toHaveTextContent('Not set yet: platform, output type, mouse DPI and polling rate.');
    expect(within(profile).getByRole('link', { name: 'Complete your profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getByText(/shared by every loadout/)).toBeInTheDocument();
  });

  it('says when the profile has everything the build uses', () => {
    render('/build', withProfile({ platform: 'xbox', outputType: 'xbox-controller', mouseDpi: 1600, pollingRate: 1000 }));
    const profile = screen.getByRole('region', { name: 'Your profile' });
    expect(profile).toHaveTextContent('1600 DPI');
    expect(profile).not.toHaveTextContent('Not set yet');
  });

  it('invites you to add a loadout when there are none', () => {
    render('/build', sampleData());
    expect(screen.getByRole('heading', { name: 'No loadouts yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a loadout' })).toHaveAttribute('href', '/loadouts/new');
  });

  it('opens a loadout at the first step that isn’t done', async () => {
    const { user, router } = render('/build');
    await user.click(screen.getByRole('link', { name: /Pulse \+ shotgun/ }));
    expect(router.state.location.pathname).toBe('/build/l1/destiny-2');
    expect(screen.getByRole('heading', { level: 1, name: 'Destiny 2 settings' })).toBeInTheDocument();
  });

  it('picks up at the setup checks once the Destiny 2 settings are done', () => {
    const data = withProfile({});
    data.progress = Object.fromEntries(knowledge.game.requiredSettings.map((s) => [progressKey.requiredSetting(s.name), 'done']));
    const { router } = render('/build/l1', data);
    expect(router.state.location.pathname).toBe('/build/l1/matrix');
  });
});

describe('Build my config: the steps', () => {
  it('step 1 lists the six Destiny 2 settings with their values and saves a tick', async () => {
    const { user, storage } = render('/build/l1/destiny-2');
    expect(screen.getByText('Step 1 of 4 · Pulse + shotgun')).toBeInTheDocument();
    expect(knowledge.game.requiredSettings).toHaveLength(6);
    for (const setting of knowledge.game.requiredSettings) {
      expect(screen.getByRole('listitem', { name: `${setting.name}: ${setting.value}` })).toBeInTheDocument();
    }
    // The game notes come first, as sourced statements a tap away (the general rule is open).
    const notes = ['max-sensitivity-and-defaults', 'sync-method', 'confirm-in-manager'].map(
      (id) => knowledge.game.notes.find((n) => n.id === id)!,
    );
    for (const note of notes) expect(screen.getByText(note.title)).toBeInTheDocument();
    expect(screen.getByText(notes[0]!.statement.text)).toBeVisible();
    expect(screen.getByText(notes[1]!.statement.text)).not.toBeVisible();
    await user.click(screen.getByText(notes[1]!.title));
    expect(screen.getByText(notes[1]!.statement.text)).toBeVisible();

    const look = screen.getByRole('listitem', { name: 'Look Sensitivity: 20' });
    expect(look).toHaveTextContent(/gear icon/);
    await user.click(within(look).getByRole('button', { name: 'Done' }));
    expect(within(look).getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
    expect(stored(storage).progress[progressKey.requiredSetting('Look Sensitivity')]).toBe('done');
    expect(screen.getByText('1 of 6 done')).toBeInTheDocument();
  });

  it('step 1 shows the current value from Tune my config and flags a difference', () => {
    const data = withProfile({});
    const config = emptyConfig();
    config.inGame.lookSensitivity = 18;
    data.configs = { l1: config };
    render('/build/l1/destiny-2', data);
    const look = screen.getByRole('listitem', { name: 'Look Sensitivity: 20' });
    expect(look).toHaveTextContent('Your current value: 18');
    expect(within(look).getByText('Differs from 20')).toBeInTheDocument();
  });

  it('step 2 shows the Xbox checks for an Xbox profile', () => {
    render('/build/l1/matrix', withProfile({ platform: 'xbox', outputType: 'xbox-controller' }));
    expect(screen.getByRole('heading', { level: 1, name: 'MATRIX setup' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: checkTitle('xbox-authentication-controller') })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: checkTitle('pc-virtual-controller-tools') })).not.toBeInTheDocument();
    expect(screen.queryByText(/checks for both Xbox and PC/)).not.toBeInTheDocument();
  });

  it('step 2 shows the PC checks for a PC profile, with the fix one tap away', async () => {
    const { user } = render('/build/l1/matrix', withProfile({ platform: 'pc', outputType: 'pc-xinput', mouseDpi: 1600 }));
    expect(screen.queryByRole('listitem', { name: checkTitle('xbox-authentication-controller') })).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: checkTitle('pc-authentication-controller') })).not.toBeInTheDocument();
    const tools = screen.getByRole('listitem', { name: checkTitle('pc-virtual-controller-tools') });
    const fix = knowledge.foundation.find((c) => c.id === 'pc-virtual-controller-tools')!.fix!;
    expect(within(tools).getByText(fix.text)).not.toBeVisible();
    await user.click(within(tools).getByText('How to fix it'));
    expect(within(tools).getByText(fix.text)).toBeVisible();

    const dpi = screen.getByRole('listitem', { name: checkTitle('mouse-dpi-matches') });
    expect(dpi).toHaveTextContent('Your mouse (profile): 1600 DPI');
  });

  it('step 2 says so when the platform isn’t set', () => {
    render('/build/l1/matrix');
    expect(screen.getByText(/checks for both Xbox and PC are shown/)).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: checkTitle('xbox-authentication-controller') })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: checkTitle('pc-virtual-controller-tools') })).toBeInTheDocument();
  });

  it('step 3 tells a pulse rifle (tracking) loadout to raise Precision', async () => {
    const { user, storage } = render('/build/l1/aim');
    expect(screen.getByRole('heading', { level: 1, name: 'Aim settings for Pulse + shotgun' })).toBeInTheDocument();
    expect(screen.getByText('Tracking', { selector: '.aim-style-name' })).toBeInTheDocument();
    const precision = screen.getByRole('listitem', { name: 'Precision: Raise' });
    expect(within(precision).getByRole('link', { name: 'Precision' })).toHaveAttribute('href', '/learn/precision');
    expect(within(precision).getByText('Reasoned')).toBeInTheDocument();

    // Sensitivity comes first, with the gap about cm/360 ranges shown as a gap.
    const items = screen.getAllByRole('listitem').filter((li) => li.classList.contains('checklist-item'));
    expect(items[0]).toHaveAccessibleName('Start with Sensitivity');
    expect(within(items[0]!).getByText('Gap')).toBeInTheDocument();
    for (const name of ['Aiming Curve', 'Quantization', 'Velocity Mapping']) {
      expect(screen.getByRole('listitem', { name })).toBeInTheDocument();
    }

    await user.click(within(precision).getByRole('button', { name: 'Done' }));
    expect(stored(storage).progress[progressKey.loadout('l1', 'lever:precision')]).toBe('done');
  });

  it('step 3 tells a hand cannon (snap) loadout to lower Easing, with the Easing caveat', () => {
    render('/build/l2/aim');
    const easing = screen.getByRole('listitem', { name: 'Easing: Lower' });
    expect(easing).toHaveTextContent(EASING_CAVEAT);
    expect(screen.getByRole('listitem', { name: 'Response: It depends' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: /^Precision/ })).not.toBeInTheDocument();
  });

  it('step 3 hides gyro-only settings for a mouse player, and shows them for gyro', () => {
    const scout = sampleLoadout({ id: 'l3', name: 'Scout', weapons: { kinetic: 'scout-rifle', energy: null, power: null } });
    render('/build/l3/aim', withProfile({}, { loadouts: [scout] }));
    expect(screen.queryByRole('link', { name: 'Stability' })).not.toBeInTheDocument();
    expect(screen.getByText(/hidden, because your profile says you aim with mouse/)).toBeInTheDocument();
  });

  it('step 3 shows gyro-only settings when the profile aims with gyro', () => {
    const scout = sampleLoadout({ id: 'l3', name: 'Scout', weapons: { kinetic: 'scout-rifle', energy: null, power: null } });
    render('/build/l3/aim', withProfile({ aimingSources: ['mouse', 'gyro'] }, { loadouts: [scout] }));
    expect(screen.getByRole('listitem', { name: 'Stability: Raise' })).toBeInTheDocument();
  });

  it('step 3 says honestly when the main weapon has no aim style', () => {
    const sword = sampleLoadout({ id: 'l4', name: 'Blade', weapons: { kinetic: null, energy: null, power: 'sword' }, mainSlot: 'power' });
    render('/build/l4/aim', withProfile({}, { loadouts: [sword] }));
    const mapping = knowledge.weapons.archetypes.find((a) => a.id === 'sword')!.mapping;
    expect(screen.getByText(/has no aim style in Dialed’s knowledge base/)).toBeInTheDocument();
    expect(screen.getAllByText(mapping.text).length).toBeGreaterThan(0);
    expect(screen.queryByRole('listitem', { name: /: (Raise|Lower|It depends)$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Start with Sensitivity' })).toBeInTheDocument();
  });

  it('step 3 notes that the directions assume Standard smoothing when the current config uses Classic', () => {
    const data = withProfile({});
    const config = emptyConfig();
    config.aim.smoothing = 'classic';
    data.configs = { l1: config };
    render('/build/l1/aim', data);
    expect(screen.getByRole('note')).toHaveTextContent(/smoothing is Custom Classic.*assume Standard smoothing/);
  });

  it('step 4 links to the config sheet and to Tune my config', () => {
    render('/build/l1/sheet');
    expect(screen.getByRole('heading', { level: 1, name: 'Your config sheet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the config sheet' })).toHaveAttribute('href', '/loadouts/l1/sheet');
    expect(screen.getByRole('link', { name: 'Enter your current settings' })).toHaveAttribute('href', '/tune/l1');
    expect(screen.getByText(knowledge.guardrail.text)).toBeInTheDocument();
  });
});

describe('Build my config: moving between steps', () => {
  it('keeps the step in the address, with Next, Back and the step indicator', async () => {
    const { user, router } = render('/build/l1/destiny-2');
    const steps = screen.getByRole('navigation', { name: 'Build steps' });
    expect(within(steps).getByRole('link', { name: /^Step 1: Destiny 2 settings/ })).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByRole('link', { name: 'Next: MATRIX setup' }));
    expect(router.state.location.pathname).toBe('/build/l1/matrix');
    expect(screen.getByRole('heading', { level: 1, name: 'MATRIX setup' })).toHaveFocus();
    expect(screen.getByText('Step 2 of 4 · Pulse + shotgun')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back' }));
    expect(router.state.location.pathname).toBe('/build/l1/destiny-2');

    await user.click(
      within(screen.getByRole('navigation', { name: 'Build steps' })).getByRole('link', { name: /^Step 3: Aim settings/ }),
    );
    expect(router.state.location.pathname).toBe('/build/l1/aim');
    expect(
      within(screen.getByRole('navigation', { name: 'Build steps' })).getByRole('link', { name: /^Step 3/ }),
    ).toHaveAttribute('aria-current', 'step');
  });

  it('marks a finished step in the step indicator', () => {
    const data = withProfile({});
    data.progress = Object.fromEntries(knowledge.game.requiredSettings.map((s) => [progressKey.requiredSetting(s.name), 'done']));
    render('/build/l1/matrix', data);
    const steps = screen.getByRole('navigation', { name: 'Build steps' });
    expect(within(steps).getByRole('link', { name: 'Step 1: Destiny 2 settings, 6 of 6 done' })).toBeInTheDocument();
  });

  it('shows not found for an unknown loadout, with a way back', async () => {
    const { user, router } = render('/build/nope/destiny-2');
    expect(screen.getByRole('heading', { level: 1, name: 'Loadout not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Choose another loadout' }));
    expect(router.state.location.pathname).toBe('/build');
  });

  it('shows not found at /build/<unknown loadout> too', () => {
    render('/build/nope');
    expect(screen.getByRole('heading', { level: 1, name: 'Loadout not found' })).toBeInTheDocument();
  });

  it('sends an unknown step to where the loadout picks up', () => {
    const { router } = render('/build/l1/nowhere');
    expect(router.state.location.pathname).toBe('/build/l1/destiny-2');
  });

  it('resets only this loadout’s own steps, after confirmation', async () => {
    const data = withProfile({});
    const look = progressKey.requiredSetting('Look Sensitivity');
    const precision = progressKey.loadout('l1', 'lever:precision');
    const other = progressKey.loadout('l2', 'lever:easing');
    data.progress = { [look]: 'done', [precision]: 'done', [other]: 'done' };
    const { user, storage } = render('/build/l1/aim', data);

    await user.click(screen.getByRole('button', { name: 'Reset this loadout’s steps' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Reset the steps for “Pulse + shotgun”?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(stored(storage).progress[precision]).toBe('done');

    await user.click(screen.getByRole('button', { name: 'Reset this loadout’s steps' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset' }));
    expect(stored(storage).progress).toEqual({ [look]: 'done', [other]: 'done' });
    expect(screen.getByRole('status')).toHaveTextContent('Cleared the aim settings you ticked for “Pulse + shotgun”.');
  });
});
