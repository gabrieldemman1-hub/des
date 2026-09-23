import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { knowledge } from '../../../../knowledge/index';
import { EASING_CAVEAT } from '../../../../knowledge/integrity';
import { createKnowledgeApi } from '../../state/knowledge-context';
import { progressKey } from '../../state/progress';
import { emptyConfig, emptyInGame, type AppData, type CurrentConfig, type InGameSettings } from '../../state/schema';
import { STORAGE_KEY } from '../../state/storage';
import { sampleData, sampleLoadout } from '../../test/fixtures';
import { MemoryStorage } from '../../test/memory-storage';
import { renderApp } from '../../test/render';

const realKnowledge = createKnowledgeApi(knowledge);

function storageWith(overrides: Partial<AppData> = {}) {
  return new MemoryStorage({
    [STORAGE_KEY]: JSON.stringify(sampleData({ loadouts: [sampleLoadout()], ...overrides })),
  });
}

function stored(storage: MemoryStorage): AppData {
  return storage.json(STORAGE_KEY) as AppData;
}

function configWith(patch: { matrix?: Partial<CurrentConfig['matrix']>; aim?: Partial<CurrentConfig['aim']> }): CurrentConfig {
  const base = emptyConfig();
  return {
    matrix: { ...base.matrix, ...patch.matrix },
    aim: { ...base.aim, ...patch.aim },
    updatedAt: '2026-09-22T12:00:00.000Z',
  };
}

/** Destiny 2's in-game settings, which every loadout shares. */
function inGameWith(patch: Partial<InGameSettings>): InGameSettings {
  return { ...emptyInGame(), ...patch };
}

/** Destiny 2's in-game settings as the real knowledge base requires them. */
const REQUIRED_IN_GAME = {
  movementControls: 'default',
  buttonLayout: 'default',
  lookSensitivity: 20,
  adsSensitivityModifier: 1.5,
  axialDeadzone: 0,
  radialDeadzone: 0.13,
} as const;

function render(path: string, storage = storageWith()) {
  return renderApp({ path, storage, knowledge: realKnowledge });
}

function section(name: string) {
  return screen.getByRole('region', { name });
}

function tabs() {
  return within(screen.getByRole('navigation', { name: 'Tune sections' }));
}

describe('Tune my config: picking a loadout', () => {
  it('explains the flow and invites you to add a loadout when there are none', () => {
    renderApp({ path: '/tune', knowledge: realKnowledge });
    expect(screen.getByRole('heading', { level: 1, name: 'Tune my config' })).toBeInTheDocument();
    expect(screen.getByText(/compares them against the evidence base/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'No loadouts yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a loadout' })).toHaveAttribute('href', '/loadouts/new');
  });

  it('lists each loadout with its main weapon, aim style and whether settings are entered', () => {
    const second = sampleLoadout({
      id: 'l2',
      name: 'Peek',
      weapons: { kinetic: 'hand-cannon', energy: null, power: null },
    });
    render(
      '/tune',
      storageWith({
        loadouts: [sampleLoadout(), second],
        inGame: inGameWith({ lookSensitivity: 20 }),
        configs: { l2: configWith({ matrix: { configDpi: 1600 } }) },
      }),
    );
    const list = screen.getByRole('list', { name: 'Pick a loadout' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Pulse + shotgun');
    expect(links[0]).toHaveTextContent('Main weapon: Pulse Rifle · Tracking');
    expect(links[0]).toHaveTextContent('Destiny 2 settings entered · none for this Config yet');
    expect(links[0]).toHaveAttribute('href', '/tune/l1');
    expect(links[1]).toHaveTextContent('Main weapon: Hand Cannon · Snap');
    expect(links[1]).toHaveTextContent(/Settings entered · updated/);
  });

  it('opens "Your settings" first when nothing is entered, "What to change" otherwise', async () => {
    const empty = render('/tune');
    await empty.user.click(screen.getByRole('link', { name: /Pulse \+ shotgun/ }));
    expect(empty.router.state.location.pathname).toBe('/tune/l1/settings');
    expect(screen.getByRole('heading', { level: 1, name: 'Pulse + shotgun' })).toBeInTheDocument();
    expect(tabs().getByRole('link', { name: 'Your settings' })).toHaveAttribute('aria-current', 'page');
    empty.unmount();

    const entered = render('/tune/l1', storageWith({ inGame: inGameWith({ lookSensitivity: 20 }) }));
    expect(entered.router.state.location.pathname).toBe('/tune/l1/changes');
    expect(tabs().getByRole('link', { name: 'What to change' })).toHaveAttribute('aria-current', 'page');
  });

  it('says so when the loadout doesn’t exist', () => {
    render('/tune/nope');
    expect(screen.getByRole('heading', { level: 1, name: 'Loadout not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pick a loadout to tune' })).toHaveAttribute('href', '/tune');
  });

  it('shows the not-found screen for an unknown part of a loadout', () => {
    render('/tune/l1/elsewhere');
    expect(screen.getByRole('heading', { level: 1, name: 'Not found' })).toBeInTheDocument();
  });
});

describe('Tune my config: your settings', () => {
  it('has the three sections, says where the values come from and that nothing is sent', () => {
    render('/tune/l1/settings');
    for (const name of ['Destiny 2 settings', 'MATRIX setup', 'Aim settings']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByText(/as Destiny 2 and XIM MATRIX Manager show it/)).toHaveTextContent('nothing is sent anywhere');
    expect(screen.getByText('Changes save automatically on this phone.')).toBeInTheDocument();
  });

  it('saves Look Sensitivity as you type, and flags it in What to change', async () => {
    const { user, storage } = render('/tune/l1/settings');
    await user.type(screen.getByRole('textbox', { name: 'Look Sensitivity' }), '15');
    expect(stored(storage).inGame.lookSensitivity).toBe(15);
    expect(screen.getByText('Saved on this phone.')).toBeInTheDocument();

    await user.click(tabs().getByRole('link', { name: 'What to change' }));
    const first = section('Change this first');
    expect(within(first).getByRole('heading', { level: 3, name: 'Look Sensitivity' })).toBeInTheDocument();
    expect(within(first).getByText('Yours').nextSibling).toHaveTextContent('15');
    expect(within(first).getByText('XIM’s list').nextSibling).toHaveTextContent('20');
    // The knowledge base's statement, shown in full with its caveat and source.
    const statement = knowledge.game.requiredSettings.find((s) => s.name === 'Look Sensitivity')!.statement;
    expect(within(first).getByText(statement.text)).toBeInTheDocument();
    expect(within(first).getByText(/Confirm it in XIM MATRIX Manager/)).toBeInTheDocument();
    expect(within(first).getByRole('list', { name: 'Sources' })).toBeInTheDocument();
  });

  it('shows an error for input that isn’t a number in range, without saving it', async () => {
    const { user, storage } = render('/tune/l1/settings');
    const look = screen.getByRole('textbox', { name: 'Look Sensitivity' });
    await user.type(look, '20');
    expect(stored(storage).inGame.lookSensitivity).toBe(20);

    await user.type(look, 'x');
    expect(look).toHaveValue('20x');
    expect(look).toHaveAttribute('aria-invalid', 'true');
    expect(look).toHaveAccessibleDescription('Enter a number from 0 to 1,000.');
    expect(stored(storage).inGame.lookSensitivity).toBe(20);

    const ads = screen.getByRole('textbox', { name: 'ADS Sensitivity Modifier' });
    await user.type(ads, '150');
    expect(ads).toHaveAccessibleDescription('Enter a number from 0 to 100.');
    expect(stored(storage).inGame.adsSensitivityModifier).toBe(15);

    // Clearing a field saves "not entered".
    await user.clear(look);
    expect(look).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('Enter a number from 0 to 1,000.')).not.toBeInTheDocument();
    expect(stored(storage).inGame.lookSensitivity).toBeNull();
  });

  it('accepts a decimal comma', async () => {
    const { user, storage } = render('/tune/l1/settings');
    await user.type(screen.getByRole('textbox', { name: 'Radial Deadzone' }), '0,13');
    expect(stored(storage).inGame.radialDeadzone).toBe(0.13);
  });

  it('asks for a whole number of DPI, and compares it with the profile', async () => {
    const { user, storage } = render(
      '/tune/l1/settings',
      storageWith({ profile: { ...sampleData().profile, mouseDpi: 1600 } }),
    );
    const dpi = screen.getByRole('textbox', { name: 'Mouse DPI in your Config' });
    expect(dpi).toHaveAccessibleDescription(/Your profile says your mouse is set to 1600 DPI/);
    await user.type(dpi, '800.5');
    expect(dpi).toHaveAccessibleDescription(/Enter a whole number from 1 to 1,000,000\./);
    // "800" was saved on the way; "800.5" isn't.
    expect(stored(storage).configs.l1?.matrix.configDpi).toBe(800);
    await user.clear(dpi);
    expect(stored(storage).configs.l1?.matrix.configDpi).toBeNull();
    await user.type(dpi, '1600');
    expect(dpi).toHaveAttribute('aria-invalid', 'false');
    expect(stored(storage).configs.l1?.matrix.configDpi).toBe(1600);
  });

  it('shows the fields for the smoothing mode you pick', async () => {
    const { user, storage } = render('/tune/l1/settings');
    const smoothing = screen.getByRole('group', { name: 'Smoothing' });
    const field = (name: string) => screen.queryByRole('textbox', { name });
    expect(field('Precision')).not.toBeInTheDocument();
    expect(field('Smooth')).not.toBeInTheDocument();

    await user.click(within(smoothing).getByRole('radio', { name: 'Custom Standard' }));
    expect(stored(storage).configs.l1?.aim.smoothing).toBe('standard');
    for (const name of ['Precision', 'Response', 'Easing']) expect(field(name)).toBeInTheDocument();
    expect(field('Smooth')).not.toBeInTheDocument();
    await user.type(field('Precision')!, '40');
    expect(stored(storage).configs.l1?.aim.precision).toBe(40);

    await user.click(within(smoothing).getByRole('radio', { name: 'Custom Classic' }));
    for (const name of ['Smooth', 'Decay', 'Synch']) expect(field(name)).toBeInTheDocument();
    expect(field('Precision')).not.toBeInTheDocument();

    await user.click(within(smoothing).getByRole('radio', { name: 'Preset' }));
    expect(field('Smooth')).not.toBeInTheDocument();
    await user.type(field('Preset name')!, 'Fast');
    expect(stored(storage).configs.l1?.aim.presetName).toBe('Fast');

    await user.click(within(smoothing).getByRole('radio', { name: 'Off' }));
    for (const name of ['Preset name', 'Precision', 'Smooth']) expect(field(name)).not.toBeInTheDocument();

    // Switching back keeps what was entered.
    await user.click(within(smoothing).getByRole('radio', { name: 'Custom Standard' }));
    expect(field('Precision')).toHaveValue('40');
  });

  it('shows Magnitude and Angle only while quantization is on', async () => {
    const { user, storage } = render('/tune/l1/settings');
    const quantization = screen.getByRole('group', { name: 'Quantization' });
    expect(screen.queryByRole('textbox', { name: 'Magnitude Quantization' })).not.toBeInTheDocument();
    await user.click(within(quantization).getByRole('radio', { name: 'On' }));
    expect(stored(storage).configs.l1?.aim.quantization).toBe(true);
    await user.type(screen.getByRole('textbox', { name: 'Magnitude Quantization' }), '25');
    expect(screen.getByRole('textbox', { name: 'Angle Quantization' })).toBeInTheDocument();
    expect(stored(storage).configs.l1?.aim.quantizationMagnitude).toBe(25);
    await user.click(within(quantization).getByRole('radio', { name: 'Off' }));
    expect(screen.queryByRole('textbox', { name: 'Magnitude Quantization' })).not.toBeInTheDocument();
  });

  it('saves the choices, and links each setting to its explanation', async () => {
    const { user, storage } = render('/tune/l1/settings');
    await user.click(within(screen.getByRole('group', { name: 'Movement Controls' })).getByRole('radio', { name: 'Not default' }));
    await user.click(within(screen.getByRole('group', { name: 'Game Settings' })).getByRole('radio', { name: 'Manual' }));
    await user.click(within(screen.getByRole('group', { name: 'Smart Translator warning' })).getByRole('radio', { name: 'Yes' }));
    await user.click(within(screen.getByRole('group', { name: 'Aiming Curve' })).getByRole('radio', { name: 'Custom' }));
    const config = stored(storage).configs.l1!;
    expect(stored(storage).inGame.movementControls).toBe('other');
    expect(config.matrix).toMatchObject({ syncMethod: 'manual', translatorWarning: true });
    expect(config.aim.aimingCurve).toBe('custom');

    expect(screen.getByRole('link', { name: 'About Required Game Settings' })).toHaveAttribute(
      'href',
      '/learn/required-game-settings',
    );
    expect(screen.getByRole('group', { name: 'Smoothing' })).toHaveAccessibleDescription(/About Smoothing/);
    expect(screen.getByRole('textbox', { name: 'Y Scale' })).toHaveAccessibleDescription('About Y Scale');
    expect(screen.getAllByRole('link', { name: 'About Deadzone' })).toHaveLength(2);
  });
});

describe('Tune my config: what to change', () => {
  it('says what to enter first when nothing is entered', () => {
    render('/tune/l1/changes');
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing entered yet' })).toBeInTheDocument();
    expect(screen.getByText(/Start with your Destiny 2 settings/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enter your settings' })).toHaveAttribute('href', '/tune/l1/settings');
  });

  it('shows the first change prominently, then the rest by group, ending with one change at a time', () => {
    render(
      '/tune/l1/changes',
      storageWith({
        profile: { ...sampleData().profile, mouseDpi: 1600 },
        inGame: inGameWith({ ...REQUIRED_IN_GAME, lookSensitivity: 15, axialDeadzone: 5 }),
        configs: {
          l1: configWith({
            matrix: { configDpi: 800 },
            aim: { smoothing: 'standard', precision: 40, aimingCurve: 'custom' },
          }),
        },
      }),
    );
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'Change this first',
      'Fix these Destiny 2 settings',
      'Setup',
      'Aim settings for tracking',
      'Good to know',
      'One change at a time',
    ]);

    // The first change isn't hidden behind "Why".
    const first = section('Change this first');
    expect(within(first).getByRole('heading', { level: 3, name: 'Look Sensitivity' })).toBeInTheDocument();
    expect(within(first).queryByText('Why, and the source')).not.toBeInTheDocument();
    expect(within(first).getByRole('link', { name: 'Update your settings' })).toHaveAttribute('href', '/tune/l1/settings');

    const fix = section('Fix these Destiny 2 settings');
    expect(within(fix).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Axial Deadzone']);
    expect(within(fix).getByText('Why, and the source').closest('details')).not.toHaveAttribute('open');
    expect(fix).toHaveTextContent(
      'Already the same as XIM’s list: Movement Controls, Button Layout, ADS Sensitivity Modifier, Radial Deadzone.',
    );

    const setup = section('Setup');
    expect(within(setup).getByRole('heading', { level: 3, name: /DPI in your Config differs/ })).toBeInTheDocument();
    expect(setup).toHaveTextContent('Config 800 · mouse 1600');

    const aim = section('Aim settings for tracking');
    const precision = within(aim).getByRole('heading', { level: 3, name: 'Precision' }).closest('li')!;
    expect(precision).toHaveTextContent('Direction: Raise');
    expect(precision).toHaveTextContent('Yours40');

    expect(within(section('Good to know')).getByRole('heading', { level: 3 })).toHaveTextContent(
      'A custom aiming curve is on',
    );
    expect(within(section('One change at a time')).getByText(knowledge.guardrail.text)).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'See the config sheet' })).toHaveAttribute('href', '/loadouts/l1/sheet');
    expect(screen.getByRole('link', { name: 'Troubleshoot by feel' })).toHaveAttribute('href', '/troubleshoot');
  });

  it('lists the Destiny 2 settings not entered yet', () => {
    render('/tune/l1/changes', storageWith({ inGame: inGameWith({ lookSensitivity: 20 }) }));
    const destiny = section('Destiny 2 settings');
    expect(destiny).toHaveTextContent('Already the same as XIM’s list: Look Sensitivity.');
    expect(destiny).toHaveTextContent(
      'Not entered yet: Movement Controls, Button Layout, ADS Sensitivity Modifier, Axial Deadzone, Radial Deadzone.',
    );
    // Nothing to fix yet, so the first change is an aim one, with a note about the missing settings.
    const first = section('Change this first');
    expect(within(first).getByRole('heading', { level: 3, name: 'Sensitivity' })).toBeInTheDocument();
    expect(first).toHaveTextContent(/Some Destiny 2 settings aren’t entered yet/);
  });

  it('steps through the aim changes one at a time', async () => {
    const { user, storage } = render(
      '/tune/l1/changes',
      storageWith({ inGame: inGameWith(REQUIRED_IN_GAME), configs: { l1: configWith({ aim: { smoothing: 'standard' } }) } }),
    );
    const first = () => section('Change this first');
    expect(within(first()).getByRole('heading', { level: 3, name: 'Sensitivity' })).toBeInTheDocument();

    await user.click(within(first()).getByRole('button', { name: 'Done: show the next change' }));
    expect(within(first()).getByRole('heading', { level: 3, name: 'Precision' })).toBeInTheDocument();
    expect(Object.keys(stored(storage).progress)).toEqual([progressKey.aim.sensitivity('l1')]);

    // Sensitivity is now in the list, marked done, and can be undone.
    const aim = section('Aim settings for tracking');
    const done = within(aim).getByRole('button', { name: 'Sensitivity: done' });
    expect(done).toHaveAttribute('aria-pressed', 'true');
    await user.click(done);
    expect(within(first()).getByRole('heading', { level: 3, name: 'Sensitivity' })).toBeInTheDocument();
    expect(stored(storage).progress).toEqual({});
  });

  it('gives a snap loadout Easing → lower, with the Easing caveat', () => {
    render(
      '/tune/l1/changes',
      storageWith({
        loadouts: [sampleLoadout({ weapons: { kinetic: 'hand-cannon', energy: null, power: null } })],
        configs: { l1: configWith({ aim: { smoothing: 'standard', easing: 60 } }) },
      }),
    );
    const easing = within(section('Aim settings for snap')).getByRole('heading', { level: 3, name: 'Easing' }).closest('li')!;
    expect(easing).toHaveTextContent('Direction: Lower');
    expect(easing).toHaveTextContent(/Caveat:.*we read 'lower response time' as less responsive/);
  });

  it('explains that the directions assume Standard smoothing for Classic users', () => {
    render('/tune/l1/changes', storageWith({ configs: { l1: configWith({ aim: { smoothing: 'classic' } }) } }));
    const aim = section('Aim settings for tracking');
    const note = within(aim).getByRole('heading', { level: 3, name: 'These directions assume Standard smoothing' }).closest('li')!;
    expect(note).toHaveTextContent('Your smoothing is Custom Classic. These directions assume Standard smoothing.');
    const precision = within(aim).getByRole('heading', { level: 3, name: 'Precision' }).closest('li')!;
    expect(precision).toHaveTextContent('Your smoothing is Custom Classic. This direction assumes Standard smoothing.');
    expect(within(precision).queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides gyro-only settings for a mouse-only profile, and says so', () => {
    render(
      '/tune/l1/changes',
      storageWith({
        loadouts: [sampleLoadout({ weapons: { kinetic: 'scout-rifle', energy: null, power: null } })],
        configs: { l1: configWith({ aim: { smoothing: 'standard' } }) },
      }),
    );
    const aim = section('Aim settings for precision hold');
    expect(within(aim).queryByRole('heading', { level: 3, name: 'Stability' })).not.toBeInTheDocument();
    expect(aim).toHaveTextContent('One setting for other ways of aiming is hidden, because your profile says you aim with mouse.');
  });
});

const HAND_CANNON = sampleLoadout({ weapons: { kinetic: 'hand-cannon', energy: null, power: null } });

function term(id: string) {
  const found = knowledge.glossary.terms.find((t) => t.id === id);
  if (!found) throw new Error(`No term ${id}`);
  return found;
}

describe('Tune my config: moving around', () => {
  it('has a back link to Home', () => {
    render('/tune');
    const back = document.querySelector('.back-link');
    expect(back).toHaveTextContent('Home');
    expect(back).toHaveAttribute('href', '/');
  });

  it('moves focus to the heading when you switch between Your settings and What to change', async () => {
    const { user, router } = render('/tune/l1/settings');
    const heading = () => screen.getByRole('heading', { level: 1, name: 'Pulse + shotgun' });

    await user.click(tabs().getByRole('link', { name: 'What to change' }));
    expect(router.state.location.pathname).toBe('/tune/l1/changes');
    expect(heading()).toHaveFocus();

    await user.click(tabs().getByRole('link', { name: 'Your settings' }));
    expect(heading()).toHaveFocus();

    await user.click(screen.getByRole('link', { name: 'See what to change' }));
    expect(router.state.location.pathname).toBe('/tune/l1/changes');
    expect(heading()).toHaveFocus();

    await user.click(screen.getByRole('link', { name: 'Enter your settings' }));
    expect(router.state.location.pathname).toBe('/tune/l1/settings');
    expect(heading()).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('moves focus to the heading from “Update your settings” and “Enter them”', async () => {
    const { user, router } = render(
      '/tune/l1/changes',
      storageWith({ inGame: inGameWith({ lookSensitivity: 15 }) }),
    );
    await user.click(screen.getByRole('link', { name: 'Update your settings' }));
    expect(router.state.location.pathname).toBe('/tune/l1/settings');
    expect(screen.getByRole('heading', { level: 1, name: 'Pulse + shotgun' })).toHaveFocus();

    await user.click(tabs().getByRole('link', { name: 'What to change' }));
    await user.click(screen.getByRole('link', { name: 'Enter them' }));
    expect(router.state.location.pathname).toBe('/tune/l1/settings');
    expect(screen.getByRole('heading', { level: 1, name: 'Pulse + shotgun' })).toHaveFocus();
  });
});

describe('Tune my config: marking changes done', () => {
  it('announces the next change after “Done: show the next change”', async () => {
    const { user } = render(
      '/tune/l1/changes',
      storageWith({
        loadouts: [HAND_CANNON],
        inGame: inGameWith(REQUIRED_IN_GAME),
        configs: { l1: configWith({ aim: { smoothing: 'standard' } }) },
      }),
    );
    const first = section('Change this first');
    const status = within(first).getByRole('status');
    expect(status).toBeEmptyDOMElement();

    const done = within(first).getByRole('button', { name: 'Done: show the next change' });
    await user.click(done);
    expect(status).toHaveTextContent('Next: Easing, Lower');
    expect(within(first).getByRole('heading', { level: 3, name: 'Easing' })).toBeInTheDocument();
    // The button stays for the next change, and keeps focus.
    expect(done).toHaveFocus();

    await user.click(done);
    expect(status).toHaveTextContent('Next: Response, It depends');
  });

  it('moves focus to “Change this first” when there is no next change to mark', async () => {
    const { user } = render(
      '/tune/l1/changes',
      storageWith({ inGame: inGameWith(REQUIRED_IN_GAME), configs: { l1: configWith({ aim: { smoothing: 'standard' } }) } }),
    );
    const first = section('Change this first');
    await user.click(within(first).getByRole('button', { name: 'Done: show the next change' })); // Sensitivity
    await user.click(within(first).getByRole('button', { name: 'Done: show the next change' })); // Precision
    expect(within(first).getByRole('status')).toHaveTextContent('Dialed has no other change to suggest');
    await waitFor(() => expect(within(first).getByRole('heading', { level: 2 })).toHaveFocus());
  });

  it('asks before starting the aim changes again, and clears the marks Build my config shares', async () => {
    const { user, storage } = render(
      '/tune/l1/changes',
      storageWith({
        inGame: inGameWith(REQUIRED_IN_GAME),
        configs: { l1: configWith({ aim: { smoothing: 'standard' } }) },
        progress: {
          [progressKey.aim.sensitivity('l1')]: 'done',
          [progressKey.aim.term('l1', 'aiming-curve')]: 'problem',
          [progressKey.aim.sensitivity('l2')]: 'done',
          'check:firmware-current': 'done',
        },
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Start the aim changes again' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start the aim changes again?' });
    expect(dialog).toHaveTextContent('Build my config and Tune my config share these marks');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(stored(storage).progress[progressKey.aim.sensitivity('l1')]).toBe('done');

    await user.click(screen.getByRole('button', { name: 'Start the aim changes again' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Start again' }));
    expect(stored(storage).progress).toEqual({
      [progressKey.aim.sensitivity('l2')]: 'done',
      'check:firmware-current': 'done',
    });
  });
});

describe('Tune my config: cards', () => {
  it('shows every card’s confidence, and the caveat and “worked out” label outside “Why”', () => {
    render(
      '/tune/l1/changes',
      storageWith({
        loadouts: [HAND_CANNON],
        profile: { ...sampleData().profile, mouseDpi: 1600 },
        inGame: inGameWith({ ...REQUIRED_IN_GAME, axialDeadzone: 5 }),
        configs: { l1: configWith({ matrix: { configDpi: 800 }, aim: { smoothing: 'standard', easing: 60 } }) },
      }),
    );
    const cards = Array.from(document.querySelectorAll<HTMLElement>('li.finding'));
    expect(cards.length).toBeGreaterThan(3);
    for (const card of cards) expect(card.querySelector('.finding-head .badge'), card.textContent ?? '').not.toBeNull();

    const easing = within(section('Aim settings for snap')).getByRole('heading', { level: 3, name: 'Easing' }).closest('li')!;
    expect(easing.querySelector('.finding-head .badge')).toHaveTextContent('Reasoned');
    expect(easing.querySelector('.finding-head .badge')).toBeVisible();
    const notes = Array.from(easing.querySelectorAll<HTMLElement>(':scope > .finding-note'));
    expect(notes.map((n) => n.textContent)).toEqual([
      'Worked out from XIM’s definitions, not stated by a source.',
      `Caveat: ${EASING_CAVEAT}`,
    ]);
    for (const note of notes) expect(note).toBeVisible();
    // The full statement stays one tap away.
    expect(within(easing).getByText('Why, and the source').closest('details')).not.toHaveAttribute('open');

    const setup = section('Setup');
    const dpi = within(setup).getByRole('heading', { level: 3, name: /DPI in your Config differs/ }).closest('li')!;
    expect(dpi.querySelector('.finding-head .badge')).toHaveTextContent('Official');
    expect(dpi.querySelector('.finding-head .badge')).toBeVisible();
  });

  it('keeps one set of Destiny 2 settings for every loadout', async () => {
    const second = sampleLoadout({ id: 'l2', name: 'Peek', weapons: { kinetic: 'hand-cannon', energy: null, power: null } });
    const { user, router, storage } = render('/tune/l1/settings', storageWith({ loadouts: [sampleLoadout(), second] }));
    expect(screen.getByRole('region', { name: 'Destiny 2 settings' })).toHaveTextContent(
      'Dialed keeps one set of these for all your loadouts',
    );
    await user.type(screen.getByRole('textbox', { name: 'Look Sensitivity' }), '18');
    expect(stored(storage).inGame.lookSensitivity).toBe(18);
    expect(stored(storage).configs).toEqual({});

    await router.navigate('/tune/l2/settings');
    expect(await screen.findByRole('heading', { level: 1, name: 'Peek' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Look Sensitivity' })).toHaveValue('18');

    await router.navigate('/tune/l2/changes');
    const first = await screen.findByRole('region', { name: 'Change this first' });
    expect(within(first).getByRole('heading', { level: 3, name: 'Look Sensitivity' })).toBeInTheDocument();
    expect(within(first).getByText('Yours').nextSibling).toHaveTextContent('18');
  });

  it('names the fields as the knowledge base does', () => {
    render('/tune/l1/settings');
    for (const id of ['ads-inheritance', 'game-settings-sync', 'smoothing', 'aiming-curve', 'quantization', 'velocity-mapping']) {
      expect(screen.getByRole('group', { name: term(id).name }), id).toBeInTheDocument();
    }
    expect(term('ads-inheritance').name).toBe('Aim Settings Inheritance');
    expect(screen.getByRole('textbox', { name: `${term('mouse-dpi').name} in your Config` })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: `Hip ${term('sensitivity').name} (cm/360)` })).toBeInTheDocument();
    for (const setting of knowledge.game.requiredSettings) {
      expect(screen.getByRole(/Controls|Layout/.test(setting.name) ? 'group' : 'textbox', { name: setting.name })).toBeInTheDocument();
    }
  });
});
