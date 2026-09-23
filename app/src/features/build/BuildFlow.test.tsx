import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { knowledge } from '../../../../knowledge/index';
import { EASING_CAVEAT } from '../../../../knowledge/integrity';
import { createKnowledgeApi } from '../../state/knowledge-context';
import { progressKey } from '../../state/progress';
import { emptyConfig, emptyInGame, type AppData, type Profile } from '../../state/schema';
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
    expect(pulse).toHaveTextContent(`2 of ${total} items done`);
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
    // Inside the "Choose a loadout" section, so one level below it.
    expect(screen.getByRole('heading', { level: 3, name: 'No loadouts yet' })).toBeInTheDocument();
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
    data.inGame = { ...emptyInGame(), lookSensitivity: 18 };
    const { unmount } = render('/build/l1/destiny-2', data);
    const look = screen.getByRole('listitem', { name: 'Look Sensitivity: 20' });
    expect(look).toHaveTextContent('Your current value: 18');
    expect(within(look).getByText('Differs from 20')).toBeInTheDocument();
    unmount();

    // Destiny 2's settings are game-wide: the other loadout shows the same value.
    render('/build/l2/destiny-2', data);
    expect(screen.getByRole('listitem', { name: 'Look Sensitivity: 20' })).toHaveTextContent('Your current value: 18');
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

  it('step 2 leaves the Destiny 2 settings check to step 1, and says to check per-Config checks in every Config', () => {
    render('/build/l1/matrix', withProfile({ platform: 'xbox', outputType: 'xbox-controller' }));
    expect(screen.queryByRole('listitem', { name: checkTitle('destiny2-required-settings') })).not.toBeInTheDocument();
    const note = 'Check this in every Config you use — each loadout has its own.';
    expect(screen.getByRole('listitem', { name: checkTitle('mouse-dpi-matches') })).toHaveTextContent(note);
    expect(screen.getByRole('listitem', { name: checkTitle('smart-translator-current') })).toHaveTextContent(note);
    expect(screen.getByRole('listitem', { name: checkTitle('firmware-current') })).not.toHaveTextContent(note);
  });

  it('step 2 opens “How to fix it” when a check is marked Needs fixing, and counts it', async () => {
    const { user } = render('/build/l1/matrix', withProfile({ platform: 'xbox', outputType: 'xbox-controller' }));
    const firmware = screen.getByRole('listitem', { name: checkTitle('firmware-current') });
    const fix = within(firmware).getByText(knowledge.foundation.find((c) => c.id === 'firmware-current')!.fix!.text);
    expect(fix).not.toBeVisible();
    await user.click(within(firmware).getByRole('button', { name: 'Needs fixing' }));
    expect(fix).toBeVisible();
    expect(within(firmware).getByRole('button', { name: 'Needs fixing' })).toHaveAccessibleDescription(
      checkTitle('firmware-current'),
    );
    expect(screen.getByText(/^0 of \d+ done · 1 needs fixing$/)).toBeInTheDocument();
  });

  it('step 1 ticks make up the Destiny 2 settings check in Troubleshoot by feel', async () => {
    const { user, router } = render('/build/l1/destiny-2', withProfile({ platform: 'xbox', outputType: 'xbox-controller' }));
    for (const setting of knowledge.game.requiredSettings) {
      const item = screen.getByRole('listitem', { name: `${setting.name}: ${setting.value}` });
      await user.click(within(item).getByRole('button', { name: 'Done' }));
    }
    await router.navigate('/troubleshoot');
    const check = await screen.findByRole('listitem', { name: checkTitle('destiny2-required-settings') });
    expect(within(check).getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
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
    expect(stored(storage).progress[progressKey.aim.lever('l1', 'tracking', 'precision')]).toBe('done');
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
    expect(screen.getByRole('note')).toHaveTextContent(
      'Your smoothing is Custom Classic. These directions assume Standard smoothing.',
    );
  });

  it('step 3 doesn’t carry a lever’s tick over when the main weapon’s aim style changes', async () => {
    const { user, router, storage } = render('/build/l1/aim');
    const sensitivity = screen.getByRole('listitem', { name: 'Start with Sensitivity' });
    await user.click(within(sensitivity).getByRole('button', { name: 'Done' }));
    await user.click(within(screen.getByRole('listitem', { name: 'Precision: Raise' })).getByRole('button', { name: 'Done' }));

    // Make the main weapon a scout rifle (precision hold), which has its own Precision direction.
    await router.navigate('/loadouts/l1');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Kinetic' }), 'scout-rifle');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await router.navigate('/build/l1/aim');

    const precision = await screen.findByRole('listitem', { name: 'Precision: It depends' });
    expect(within(precision).getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'false');
    // Sensitivity isn't about the aim style, so it stays ticked.
    expect(
      within(screen.getByRole('listitem', { name: 'Start with Sensitivity' })).getByRole('button', { name: 'Done' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(stored(storage).progress[progressKey.aim.lever('l1', 'tracking', 'precision')]).toBe('done');
  });

  it('shares the aim marks with Tune my config', async () => {
    const data = withProfile({});
    data.inGame = { ...emptyInGame(), lookSensitivity: 20 };
    const { user, router, storage } = render('/tune/l1/changes', data);
    // Tune: "Done" on Sensitivity, the first aim change.
    await user.click(screen.getByRole('button', { name: 'Done: show the next change' }));
    expect(stored(storage).progress).toEqual({ [progressKey.aim.sensitivity('l1')]: 'done' });

    await router.navigate('/build/l1/aim');
    const sensitivity = await screen.findByRole('listitem', { name: 'Start with Sensitivity' });
    expect(within(sensitivity).getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');

    // Build: ticking Precision moves Tune on to the next change.
    await user.click(within(screen.getByRole('listitem', { name: 'Precision: Raise' })).getByRole('button', { name: 'Done' }));
    await router.navigate('/tune/l1/changes');
    const first = await screen.findByRole('region', { name: 'Change this first' });
    expect(within(first).queryByRole('heading', { level: 3, name: 'Sensitivity' })).not.toBeInTheDocument();
    expect(within(first).queryByRole('heading', { level: 3, name: 'Precision' })).not.toBeInTheDocument();

    // Build's reset clears the marks Tune made too.
    await router.navigate('/build/l1/aim');
    await user.click(await screen.findByRole('button', { name: 'Reset this loadout’s steps' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset' }));
    expect(stored(storage).progress).toEqual({});
    await router.navigate('/tune/l1/changes');
    expect(
      within(await screen.findByRole('region', { name: 'Change this first' })).getByRole('heading', {
        level: 3,
        name: 'Sensitivity',
      }),
    ).toBeInTheDocument();
  });

  it('step 4 links to the config sheet and to Tune my config', () => {
    render('/build/l1/sheet');
    expect(screen.getByRole('heading', { level: 1, name: 'Your config sheet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the config sheet' })).toHaveAttribute('href', '/loadouts/l1/sheet');
    expect(screen.getByRole('link', { name: 'Enter your current settings' })).toHaveAttribute('href', '/tune/l1/settings');
    expect(screen.getByText(knowledge.guardrail.text)).toBeInTheDocument();
  });

  it('step 4’s “Enter your current settings” opens Your settings in Tune my config', async () => {
    const { user, router } = render('/build/l1/sheet');
    await user.click(screen.getByRole('link', { name: 'Enter your current settings' }));
    expect(router.state.location.pathname).toBe('/tune/l1/settings');
    expect(screen.getByRole('link', { name: 'Your settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('textbox', { name: 'Look Sensitivity' })).toBeInTheDocument();
  });

  it('the config sheet opened from step 4 goes back to step 4', async () => {
    const { user, router } = render('/build/l1/sheet');
    await user.click(screen.getByRole('link', { name: 'Open the config sheet' }));
    expect(router.state.location.pathname).toBe('/loadouts/l1/sheet');
    const back = document.querySelector<HTMLAnchorElement>('.back-link')!;
    expect(back).toHaveTextContent('Build my config');
    await user.click(back);
    expect(router.state.location.pathname).toBe('/build/l1/sheet');
  });

  it('step 3 shows only the values that belong to the smoothing and quantization entered', () => {
    const data = withProfile({});
    const config = emptyConfig();
    Object.assign(config.aim, {
      smoothing: 'classic',
      precision: 40,
      smooth: 10,
      decay: 5,
      quantization: false,
      quantizationMagnitude: 25,
    });
    data.configs = { l1: config };
    render('/build/l1/aim', data);
    expect(screen.getByRole('listitem', { name: 'Precision: Raise' })).not.toHaveTextContent('Your current value');
    expect(screen.getByRole('listitem', { name: 'Smoothing' })).toHaveTextContent(
      'Your current value: Custom Classic (Smooth 10, Decay 5)',
    );
    const quantization = screen.getByRole('listitem', { name: 'Quantization' });
    // Magnitude and Angle only while quantization is on.
    expect(within(quantization).getByText('Your current value:').parentElement).toHaveTextContent(
      /^Your current value: Off$/,
    );
  });

  it('step 3 words a preset the same way as Tune my config and the sheet', () => {
    const data = withProfile({});
    const config = emptyConfig();
    Object.assign(config.aim, { smoothing: 'preset', presetName: 'Fast' });
    data.configs = { l1: config };
    render('/build/l1/aim', data);
    expect(screen.getByRole('note')).toHaveTextContent(
      'Your smoothing is a preset (Fast). Dialed can’t tell which mode a preset uses. These directions assume Standard smoothing.',
    );
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
    const precision = progressKey.aim.lever('l1', 'tracking', 'precision');
    const curve = progressKey.aim.term('l1', 'aiming-curve');
    const other = progressKey.aim.lever('l2', 'snap', 'easing');
    data.progress = { [look]: 'done', [precision]: 'done', [curve]: 'problem', [other]: 'done' };
    const { user, storage } = render('/build/l1/aim', data);

    await user.click(screen.getByRole('button', { name: 'Reset this loadout’s steps' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Reset the steps for “Pulse + shotgun”?' });
    expect(dialog).toHaveTextContent('Build my config and Tune my config share these marks');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(stored(storage).progress[precision]).toBe('done');

    await user.click(screen.getByRole('button', { name: 'Reset this loadout’s steps' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset' }));
    expect(stored(storage).progress).toEqual({ [look]: 'done', [other]: 'done' });
    expect(screen.getByRole('status')).toHaveTextContent('Cleared the aim settings marks for “Pulse + shotgun”.');
  });
});
