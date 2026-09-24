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

/** The row's Done / Needs fixing pair, as `{ done, problem }` pressed states. */
function pressed(row: HTMLElement) {
  const group = within(row).getByRole('group', { name: 'Status' });
  return {
    done: within(group).getByRole('button', { name: 'Done' }).getAttribute('aria-pressed'),
    problem: within(group).getByRole('button', { name: 'Needs fixing' }).getAttribute('aria-pressed'),
  };
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
    expect(pressed(within(d2).getByRole('listitem', { name: 'Axial Deadzone' }))).toEqual({ done: 'true', problem: 'false' });
    expect(pressed(within(d2).getByRole('listitem', { name: 'Radial Deadzone' }))).toEqual({ done: 'false', problem: 'false' });
    // The caveat every value shares is shown once, behind a one-line summary.
    expect(d2).toHaveTextContent('From the public copy of XIM’s list — confirm in Manager');
    expect(d2).toHaveTextContent(/confirm it in XIM MATRIX Manager/i);
    expect(d2).toHaveTextContent('Confirm the required settings in Manager');

    const setup = screen.getByRole('region', { name: 'MATRIX setup' });
    const firmware = knowledge.foundation.find((c) => c.id === 'firmware-current')!;
    expect(pressed(within(setup).getByRole('listitem', { name: firmware.title }))).toEqual({ done: 'false', problem: 'true' });
    // Axial Deadzone done; the firmware check and Look Sensitivity (18, not 20) need fixing.
    expect(screen.getByText('1 of 21 items done · 2 need fixing')).toBeInTheDocument();
  });

  it('marks a row Done or Needs fixing on the sheet itself, with the marks Build my config uses', async () => {
    const { user } = render('/loadouts/l1/sheet', pulseWithConfig());
    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    const row = within(d2).getByRole('listitem', { name: 'Movement Controls' });
    await user.click(within(row).getByRole('button', { name: 'Done' }));
    expect(pressed(row)).toEqual({ done: 'true', problem: 'false' });
    expect(screen.getByText('2 of 21 items done · 2 need fixing')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Needs fixing' }));
    expect(pressed(row)).toEqual({ done: 'false', problem: 'true' });
    expect(screen.getByText('1 of 21 items done · 3 need fixing')).toBeInTheDocument();
    // Tapping the active one again clears it.
    await user.click(within(row).getByRole('button', { name: 'Needs fixing' }));
    expect(pressed(row)).toEqual({ done: 'false', problem: 'false' });
    expect(screen.getByText('1 of 21 items done · 2 need fixing')).toBeInTheDocument();
  });

  it('flags a current Destiny 2 value that differs from the required one as Needs fixing', () => {
    render('/loadouts/l1/sheet', pulseWithConfig());
    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    const look = within(d2).getByRole('listitem', { name: 'Look Sensitivity' });
    expect(look).toHaveTextContent('Your current value: 18');
    expect(within(look).getByText('Differs from 20')).toBeInTheDocument();
    // Worked out from the value, so it can't be marked here.
    expect(within(look).getByText('Needs fixing', { selector: '.sheet-status' })).toBeInTheDocument();
    expect(within(look).queryByRole('group', { name: 'Status' })).not.toBeInTheDocument();
    expect(look).toHaveTextContent('Shown as Needs fixing because your value differs from 20.');

    const ads = within(d2).getByRole('listitem', { name: 'ADS Sensitivity Modifier' });
    expect(ads).toHaveTextContent('Your current value: 1.5');
    expect(within(ads).queryByText(/Differs/)).not.toBeInTheDocument();
    expect(within(ads).getByRole('group', { name: 'Status' })).toBeInTheDocument();
  });

  it('shows a Destiny 2 value that differs as Needs fixing even when it was ticked Done, and counts it', async () => {
    const data = pulseWithConfig();
    data.inGame = { ...data.inGame, adsSensitivityModifier: 1 };
    data.progress[progressKey.requiredSetting('ADS Sensitivity Modifier')] = 'done';
    const { user } = render('/loadouts/l1/sheet', data);
    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    const ads = within(d2).getByRole('listitem', { name: 'ADS Sensitivity Modifier' });
    expect(within(ads).getByText('Differs from 1.5')).toBeInTheDocument();
    expect(within(ads).getByText('Needs fixing', { selector: '.sheet-status' })).toBeInTheDocument();
    expect(within(ads).queryByText('Done', { selector: '.sheet-status' })).not.toBeInTheDocument();
    expect(ads).toHaveTextContent('You marked this Done, but your value differs from 1.5.');
    // Axial Deadzone done; firmware, Look Sensitivity and ADS Sensitivity Modifier need fixing.
    expect(screen.getByText('1 of 21 items done · 3 need fixing')).toBeInTheDocument();

    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    const text = writeText.mock.calls[0]![0];
    expect(text).toContain('- ADS Sensitivity Modifier: 1.5 [Official] · Needs fixing · Yours: 1 (differs)');
    expect(text).toContain('Progress: 1 of 21 items done · 3 need fixing');
  });

  it('lists the aim settings with a value, confidence and the current value', () => {
    render('/loadouts/l1/sheet', pulseWithConfig());
    const aim = screen.getByRole('region', { name: 'Aim settings' });
    const precision = within(aim).getByRole('listitem', { name: 'Precision' });
    expect(within(precision).getByText('Raise', { selector: '.sheet-value' })).toBeInTheDocument();
    expect(within(precision).getByText('Reasoned', { selector: '.badge' })).toBeInTheDocument();
    expect(precision).toHaveTextContent('Your current value: 40');
    expect(within(precision).getByRole('link', { name: /^What is this\?\s*\(Precision\)$/ })).toHaveAttribute('href', '/learn/precision');

    // Every aim row has a value in the same place as the Destiny 2 rows, from the knowledge base.
    const value = (name: string) => within(aim).getByRole('listitem', { name }).querySelector('.sheet-value')!.textContent;
    expect(value('Sensitivity')).toBe('Your cm/360by feel');
    // The badge in the meta row is the value's; the statements keep their own inside the disclosure.
    const meta = (name: string) => within(aim).getByRole('listitem', { name }).querySelector<HTMLElement>('.sheet-meta')!;
    expect(within(meta('Sensitivity')).getByText('Gap', { selector: '.badge' })).toBeInTheDocument();
    expect(value('Smoothing')).toBe('A presetby feel');
    expect(value('Aiming Curve')).toBe('Lineardefault');
    expect(value('Quantization')).toBe('Offdefault');
    expect(value('Velocity Mapping')).toBe('Standarddefault');
    expect(within(meta('Aiming Curve')).getByText('Official', { selector: '.badge' })).toBeInTheDocument();
    // The guidance is still there, one tap away.
    expect(within(aim).getByRole('listitem', { name: 'Aiming Curve' })).toHaveTextContent('The default is linear.');

    // The section header's badge is part of the summary line.
    const favours = within(aim).getByText('What tracking settings should favour').closest('summary')!;
    expect(within(favours).getByText('Reasoned', { selector: '.badge' })).toBeInTheDocument();
  });

  it('links on from the top and from the end of the sheet', () => {
    render('/loadouts/l1/sheet', pulseWithConfig());
    const building = screen.getAllByRole('link', { name: 'Continue building' });
    expect(building).toHaveLength(2);
    for (const link of building) expect(link).toHaveAttribute('href', '/build/l1');
    expect(screen.getByRole('link', { name: 'Enter settings' })).toHaveAttribute('href', '/tune/l1/settings');
    const more = screen.getByRole('list', { name: 'More for this loadout' });
    expect(within(more).getByRole('link', { name: 'Tune this config' })).toHaveAttribute('href', '/tune/l1');
    expect(within(more).getByRole('link', { name: 'Troubleshoot by feel' })).toHaveAttribute('href', '/troubleshoot');
    expect(within(more).getByRole('link', { name: 'All loadouts' })).toHaveAttribute('href', '/loadouts');
  });

  it('keeps the Easing caveat on a hand cannon sheet', () => {
    render(
      '/loadouts/l2/sheet',
      sampleData({
        loadouts: [sampleLoadout({ id: 'l2', name: 'Peek', weapons: { kinetic: 'hand-cannon', energy: null, power: null } })],
      }),
    );
    const easing = within(screen.getByRole('region', { name: 'Aim settings' })).getByRole('listitem', { name: 'Easing' });
    expect(within(easing).getByText('Lower', { selector: '.sheet-value' })).toBeInTheDocument();
    expect(easing).toHaveTextContent(EASING_CAVEAT);
  });

  it('copies the sheet as text', async () => {
    const { user } = render('/loadouts/l1/sheet', pulseWithConfig());
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0]![0];
    expect(text).toContain('Pulse + shotgun: config sheet');
    expect(text).toContain('- Look Sensitivity: 20 [Official] · Needs fixing · Yours: 18 (differs)');
    expect(text).toContain('- Precision: Raise · Not checked yet · Yours: 40');
    expect(text).toContain('- Sensitivity: Your cm/360 (by feel) · Not checked yet\n');
    expect(text).toContain('- Aiming Curve: Linear (default) · Not checked yet\n');
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
    expect(pressed(within(aim).getByRole('listitem', { name: 'Sensitivity' }))).toEqual({ done: 'true', problem: 'false' });
    expect(pressed(within(aim).getByRole('listitem', { name: 'Precision' }))).toEqual({ done: 'true', problem: 'false' });
    expect(pressed(within(aim).getByRole('listitem', { name: 'Aiming Curve' }))).toEqual({ done: 'false', problem: 'false' });

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
    expect(within(dpi).getByText('Needs fixing', { selector: '.sheet-status' })).toBeInTheDocument();
    expect(within(dpi).queryByRole('group', { name: 'Status' })).not.toBeInTheDocument();
    expect(dpi).toHaveTextContent('This Config: 800 DPI');
    expect(dpi).toHaveTextContent('You marked this Done, but the values above differ.');
    expect(within(dpi).getByText('Per Config', { selector: '.tag' })).toBeInTheDocument();
    expect(within(setup).getByText(/marks a check to repeat in every Config you use/)).toHaveClass('hint');
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
    expect(text).toContain('- Smoothing: A preset (by feel) · Not checked yet · Yours: Custom Classic (Smooth 12)');
    expect(text).toContain('- Quantization: Off (default) · Not checked yet · Yours: Off\n');
    expect(text).toContain('- Precision: Raise · Not checked yet\n');
    expect(text).toContain('Worked out from XIM’s definitions, not stated by a source.');
  });

  it('shows not found for an unknown loadout', () => {
    render('/loadouts/nope/sheet', sampleData());
    expect(screen.getByRole('heading', { level: 1, name: 'Loadout not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See your loadouts' })).toHaveAttribute('href', '/loadouts');
  });
});
