import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { knowledge } from '../../../../knowledge/index';
import { EASING_CAVEAT } from '../../../../knowledge/integrity';
import { createKnowledgeApi } from '../../state/knowledge-context';
import { progressKey } from '../../state/progress';
import { emptyConfig, emptyInGame, type AppData } from '../../state/schema';
import { STORAGE_KEY } from '../../state/storage';
import { sampleData, sampleLoadout } from '../../test/fixtures';
import { MemoryStorage } from '../../test/memory-storage';
import { renderApp } from '../../test/render';

const real = createKnowledgeApi(knowledge);

function render(path: string, data: AppData) {
  return renderApp({ path, knowledge: real, storage: new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) }) });
}

function pulseWithConfig(): AppData {
  const config = emptyConfig();
  config.aim.precision = 40;
  return sampleData({
    loadouts: [sampleLoadout()],
    inGame: { ...emptyInGame(), lookSensitivity: 18, adsSensitivityModifier: 1.5 },
    configs: { l1: config },
    progress: { [progressKey.requiredSetting('Axial Deadzone')]: 'done', [progressKey.check('firmware-current')]: 'problem' },
  });
}

describe('Config sheet', () => {
  it('shows the loadout, and each Destiny 2 value with its confidence and state', () => {
    render('/loadouts/l1/sheet', pulseWithConfig());
    expect(screen.getByRole('heading', { level: 1, name: 'Pulse + shotgun' })).toBeInTheDocument();
    expect(document.title).toBe('Pulse + shotgun config sheet · Dialed');
    expect(screen.getByRole('list', { name: 'Weapons' })).toHaveTextContent(/KineticPulse RifleMain/);
    expect(screen.getByText('Tracking', { selector: '.aim-style-name' })).toBeInTheDocument();

    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    for (const setting of knowledge.game.requiredSettings) {
      const row = within(d2).getByRole('listitem', { name: setting.name });
      expect(row).toHaveTextContent(setting.value);
      expect(within(row).getByText('Official', { selector: '.badge' })).toBeInTheDocument();
    }
    expect(within(d2).getByRole('listitem', { name: 'Axial Deadzone' })).toHaveTextContent('Done');
    expect(within(d2).getByRole('listitem', { name: 'Radial Deadzone' })).toHaveTextContent('Not checked yet');
    // The caveat every value shares is shown once.
    expect(d2).toHaveTextContent(/confirm it in XIM MATRIX Manager/i);

    const setup = screen.getByRole('region', { name: 'MATRIX setup' });
    const firmware = knowledge.foundation.find((c) => c.id === 'firmware-current')!;
    expect(within(setup).getByRole('listitem', { name: firmware.title })).toHaveTextContent('Needs fixing');
  });

  it('flags a current Destiny 2 value that differs from the required one', () => {
    render('/loadouts/l1/sheet', pulseWithConfig());
    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    const look = within(d2).getByRole('listitem', { name: 'Look Sensitivity' });
    expect(look).toHaveTextContent('Your current value: 18');
    expect(within(look).getByText('Differs from 20')).toBeInTheDocument();

    const ads = within(d2).getByRole('listitem', { name: 'ADS Sensitivity Modifier' });
    expect(ads).toHaveTextContent('Your current value: 1.5');
    expect(within(ads).queryByText(/Differs/)).not.toBeInTheDocument();
  });

  it('lists the aim settings with direction, confidence and the current value', () => {
    render('/loadouts/l1/sheet', pulseWithConfig());
    const aim = screen.getByRole('region', { name: 'Aim settings' });
    const precision = within(aim).getByRole('listitem', { name: 'Precision' });
    expect(precision).toHaveTextContent('Raise');
    expect(within(precision).getByText('Reasoned', { selector: '.badge' })).toBeInTheDocument();
    expect(precision).toHaveTextContent('Your current value: 40');
    expect(within(aim).getByRole('listitem', { name: 'Sensitivity' })).toHaveTextContent('Gap');
    for (const name of ['Smoothing', 'Aiming Curve', 'Quantization', 'Velocity Mapping']) {
      expect(within(aim).getByRole('listitem', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Continue building' })).toHaveAttribute('href', '/build/l1');
    expect(screen.getByRole('link', { name: 'Enter your current settings' })).toHaveAttribute('href', '/tune/l1/settings');
  });

  it('keeps the Easing caveat on a hand cannon sheet', () => {
    render(
      '/loadouts/l2/sheet',
      sampleData({
        loadouts: [sampleLoadout({ id: 'l2', name: 'Peek', weapons: { kinetic: 'hand-cannon', energy: null, power: null } })],
      }),
    );
    const easing = within(screen.getByRole('region', { name: 'Aim settings' })).getByRole('listitem', { name: 'Easing' });
    expect(easing).toHaveTextContent('Lower');
    expect(easing).toHaveTextContent(EASING_CAVEAT);
  });

  it('copies the sheet as text', async () => {
    const { user } = render('/loadouts/l1/sheet', pulseWithConfig());
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0]![0];
    expect(text).toContain('Pulse + shotgun: config sheet');
    expect(text).toContain('- Look Sensitivity: 20 [Official] · Not checked yet · Yours: 18 (differs)');
    expect(text).toContain('- Precision: Raise · Not checked yet · Yours: 40');
    expect(screen.getByRole('status')).toHaveTextContent('Copied the sheet as text.');
    expect(screen.queryByRole('textbox', { name: 'The sheet as text' })).not.toBeInTheDocument();
  });

  it('shows the text, selected, when the clipboard refuses', async () => {
    const { user } = render('/loadouts/l1/sheet', pulseWithConfig());
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Not allowed'));
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    const box = await screen.findByRole('textbox', { name: 'The sheet as text' });
    expect(box).toHaveAttribute('readonly');
    expect((box as HTMLTextAreaElement).value).toContain('Look Sensitivity: 20');
    expect(box).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(/Couldn’t copy automatically/);
  });

  it('shows the aim marks made in Tune my config', async () => {
    const data = pulseWithConfig();
    data.inGame = { ...emptyInGame(), lookSensitivity: 20 }; // nothing to fix, so the aim changes come first
    const { user, router } = render('/tune/l1/changes', data);
    await user.click(screen.getByRole('button', { name: 'Done: show the next change' }));
    await user.click(screen.getByRole('button', { name: 'Done: show the next change' }));
    await user.click(screen.getByRole('link', { name: 'See the config sheet' }));
    expect(router.state.location.pathname).toBe('/loadouts/l1/sheet');
    const aim = screen.getByRole('region', { name: 'Aim settings' });
    expect(within(aim).getByRole('listitem', { name: 'Sensitivity' })).toHaveTextContent('Done');
    expect(within(aim).getByRole('listitem', { name: 'Precision' })).toHaveTextContent('Done');
    expect(within(aim).getByRole('listitem', { name: 'Aiming Curve' })).toHaveTextContent('Not checked yet');

    // Opened from Tune my config, so its back link goes back there.
    const back = document.querySelector<HTMLAnchorElement>('.back-link')!;
    expect(back).toHaveTextContent('Tune my config');
    await user.click(back);
    expect(router.state.location.pathname).toBe('/tune/l1/changes');
  });

  it('goes back to Loadouts when opened from anywhere else', () => {
    render('/loadouts/l1/sheet', pulseWithConfig());
    const back = document.querySelector('.back-link');
    expect(back).toHaveTextContent('Loadouts');
    expect(back).toHaveAttribute('href', '/loadouts');
  });

  it('shows a check whose values differ as Needs fixing, even when it was ticked Done', () => {
    const data = pulseWithConfig();
    data.profile = { ...data.profile, mouseDpi: 1600 };
    data.configs.l1!.matrix.configDpi = 800;
    data.progress[progressKey.check('mouse-dpi-matches')] = 'done';
    render('/loadouts/l1/sheet', data);
    const setup = screen.getByRole('region', { name: 'MATRIX setup' });
    const dpi = within(setup).getByRole('listitem', {
      name: knowledge.foundation.find((c) => c.id === 'mouse-dpi-matches')!.title,
    });
    expect(dpi).toHaveTextContent('Needs fixing');
    expect(dpi).not.toHaveTextContent(/^Done/);
    expect(dpi).toHaveTextContent('This loadout’s Config (current settings): 800 DPI');
    expect(dpi).toHaveTextContent('You marked this Done, but the values above differ.');
    expect(dpi).toHaveTextContent('Check this in every Config you use — each loadout has its own.');
    // The Destiny 2 settings check is in the Destiny 2 settings section, not here.
    expect(
      within(setup).queryByRole('listitem', {
        name: knowledge.foundation.find((c) => c.id === 'destiny2-required-settings')!.title,
      }),
    ).not.toBeInTheDocument();
  });

  it('shows only the values that belong to Classic smoothing, with the smoothing note', async () => {
    const data = pulseWithConfig();
    Object.assign(data.configs.l1!.aim, { smoothing: 'classic', smooth: 12, quantization: false, quantizationAngle: 30 });
    const { user } = render('/loadouts/l1/sheet', data);
    const aim = screen.getByRole('region', { name: 'Aim settings' });
    expect(within(aim).getByRole('note')).toHaveTextContent(
      'Your smoothing is Custom Classic. These directions assume Standard smoothing.',
    );
    expect(within(aim).getByRole('listitem', { name: 'Precision' })).not.toHaveTextContent('Your current value');
    expect(within(aim).getByRole('listitem', { name: 'Smoothing' })).toHaveTextContent(
      'Your current value: Custom Classic (Smooth 12)',
    );
    // A reasoned statement on the sheet says it was worked out.
    expect(within(aim).getByRole('listitem', { name: 'Precision' })).toHaveTextContent(/Reasoned/);

    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    const text = writeText.mock.calls[0]![0];
    expect(text).toContain('Note: Your smoothing is Custom Classic. These directions assume Standard smoothing.');
    expect(text).toContain('- Smoothing · Not checked yet · Yours: Custom Classic (Smooth 12)');
    expect(text).toContain('- Quantization · Not checked yet · Yours: Off\n');
    expect(text).toContain('- Precision: Raise · Not checked yet\n');
    expect(text).toContain('Worked out from XIM’s definitions, not stated by a source.');
  });

  it('shows not found for an unknown loadout', () => {
    render('/loadouts/nope/sheet', sampleData());
    expect(screen.getByRole('heading', { level: 1, name: 'Loadout not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See your loadouts' })).toHaveAttribute('href', '/loadouts');
  });
});
