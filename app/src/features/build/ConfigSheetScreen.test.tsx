import { screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
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

type User = ReturnType<typeof userEvent.setup>;

/** Taps the row, which opens its detail sheet, and returns the sheet. */
async function openRow(user: User, row: HTMLElement) {
  await user.click(row.querySelector<HTMLElement>('.sheet-row-button')!);
  // Named by the row's own name, so a screen reader hears which setting the panel is about.
  return within(row).getByRole('dialog', { name: row.querySelector('.sheet-name')!.textContent });
}

/** The row's Done / Needs fixing pair (in its open detail sheet), as `{ done, problem }` pressed states. */
function pressed(row: HTMLElement) {
  const group = within(row).getByRole('group', { name: 'Status' });
  return {
    done: within(group).getByRole('button', { name: 'Done' }).getAttribute('aria-pressed'),
    problem: within(group).getByRole('button', { name: 'Needs fixing' }).getAttribute('aria-pressed'),
  };
}

describe('Config sheet', () => {
  it('shows the loadout, and each Destiny 2 value with its confidence and state', async () => {
    const { user } = render('/loadouts/l1/sheet', pulseWithConfig());
    expect(screen.getByRole('heading', { level: 1, name: 'Pulse + shotgun' })).toBeInTheDocument();
    expect(document.title).toBe('Pulse + shotgun config sheet · Dialed');
    // The main weapon carries the amber diamond, and says "(Main)" to a screen reader.
    const weapons = screen.getByRole('list', { name: 'Weapons' });
    expect(weapons).toHaveTextContent(/KineticPulse Rifle \(Main\)Energy/);
    expect(within(weapons).getByText('Pulse Rifle')).toHaveClass('tag-main');
    expect(screen.getByText('Tracking', { selector: '.aim-style-name' })).toBeInTheDocument();

    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    // Every value here is Official, so the badge is said once, beside the section's title.
    expect(within(d2).getByText('Official', { selector: '.sheet-section-head .badge' })).toBeInTheDocument();
    for (const setting of knowledge.game.requiredSettings) {
      const row = within(d2).getByRole('listitem', { name: setting.name });
      expect(within(row).getByText(setting.value, { selector: '.sheet-value .num' })).toBeInTheDocument();
      expect(within(row).queryByText('Official', { selector: '.badge' })).not.toBeInTheDocument();
    }
    const axial = within(d2).getByRole('listitem', { name: 'Axial Deadzone' });
    expect(axial.querySelector('.sheet-status')).toHaveClass('is-done');
    const axialSheet = await openRow(user, axial);
    // The panel says the value, the badge, and the Done / Needs fixing pair.
    expect(within(axialSheet).getByText('Official', { selector: '.badge' })).toBeInTheDocument();
    expect(pressed(axial)).toEqual({ done: 'true', problem: 'false' });
    await user.keyboard('{Escape}');
    expect(within(axial).queryByRole('dialog')).not.toBeInTheDocument();
    const radial = within(d2).getByRole('listitem', { name: 'Radial Deadzone' });
    await openRow(user, radial);
    expect(pressed(radial)).toEqual({ done: 'false', problem: 'false' });
    await user.click(within(radial).getByRole('button', { name: 'Close' }));
    // The caveat every value shares is shown once, behind a one-line summary.
    expect(d2).toHaveTextContent('From the public copy of XIM’s list: confirm in Manager');
    expect(d2).toHaveTextContent(/confirm it in XIM MATRIX Manager/i);
    expect(d2).toHaveTextContent('Confirm the required settings in Manager');

    const setup = screen.getByRole('region', { name: 'MATRIX setup' });
    const firmware = within(setup).getByRole('listitem', {
      name: knowledge.foundation.find((c) => c.id === 'firmware-current')!.title,
    });
    await openRow(user, firmware);
    expect(pressed(firmware)).toEqual({ done: 'false', problem: 'true' });
    // Axial Deadzone done; the firmware check and Look Sensitivity (18, not 20) need fixing. The
    // same words as the loadout cards' "Sheet 1 of 22 done", on a ruler with one tick per row.
    const ruler = screen.getByRole('img', { name: '1 of 22 done · 2 need fixing' });
    expect(ruler.children).toHaveLength(22);
    expect(screen.getByText('1 of 22 done · 2 need fixing', { selector: '.ruler-summary' })).toBeInTheDocument();
  });

  it('marks a row Done or Needs fixing on the sheet itself, with the marks Build my config uses', async () => {
    const { user } = render('/loadouts/l1/sheet', pulseWithConfig());
    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    const row = within(d2).getByRole('listitem', { name: 'Movement Controls' });
    await openRow(user, row);
    await user.click(within(row).getByRole('button', { name: 'Done' }));
    expect(pressed(row)).toEqual({ done: 'true', problem: 'false' });
    expect(screen.getByText('2 of 22 done · 2 need fixing')).toBeInTheDocument();
    // The row's own mark follows, behind the panel.
    expect(row.querySelector('.sheet-status')).toHaveClass('is-done');
    // The same toggles as every checklist: a mark in a tinted box, never the accent fill.
    expect(within(row).getByRole('button', { name: 'Done' })).toHaveClass('status-toggle', 'is-done');
    expect(within(row).getByRole('button', { name: 'Done' })).not.toHaveClass('primary');
    await user.click(within(row).getByRole('button', { name: 'Needs fixing' }));
    expect(pressed(row)).toEqual({ done: 'false', problem: 'true' });
    expect(screen.getByText('1 of 22 done · 3 need fixing')).toBeInTheDocument();
    // Tapping the active one again clears it.
    await user.click(within(row).getByRole('button', { name: 'Needs fixing' }));
    expect(pressed(row)).toEqual({ done: 'false', problem: 'false' });
    expect(screen.getByText('1 of 22 done · 2 need fixing')).toBeInTheDocument();
  });

  it('flags a current Destiny 2 value that differs from the required one as Needs fixing', async () => {
    const { user } = render('/loadouts/l1/sheet', pulseWithConfig());
    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    const look = within(d2).getByRole('listitem', { name: 'Look Sensitivity' });
    expect(within(look).getByText('Yours: 18')).toHaveClass('sheet-yours', 'is-differs');
    expect(look.querySelector('.sheet-status')).toHaveClass('is-problem');
    const sheet = await openRow(user, look);
    // Yours, then XIM's list: the value to change, then what to change it to.
    expect([...sheet.querySelectorAll('.readout')].map((r) => r.textContent)).toEqual(['Yours18', 'XIM’s list20']);
    // Worked out from the value, so it can't be marked here: a chip with the same mark as the toggles.
    const chip = within(look).getByText('Needs fixing', { selector: '.status-chip' });
    expect(chip).toHaveClass('is-problem');
    expect(chip.querySelector('svg.status-mark')).not.toBeNull();
    expect(within(look).queryByRole('group', { name: 'Status' })).not.toBeInTheDocument();
    expect(look).toHaveTextContent('Shown as Needs fixing because your value differs from 20.');

    await user.keyboard('{Escape}');
    const ads = within(d2).getByRole('listitem', { name: 'ADS Sensitivity Modifier' });
    expect(within(ads).getByText('Yours: 1.5')).not.toHaveClass('is-differs');
    await openRow(user, ads);
    expect(within(ads).getByRole('group', { name: 'Status' })).toBeInTheDocument();
  });

  it('shows a Destiny 2 value that differs as Needs fixing even when it was ticked Done, and counts it', async () => {
    const data = pulseWithConfig();
    data.inGame = { ...data.inGame, adsSensitivityModifier: 1 };
    data.progress[progressKey.requiredSetting('ADS Sensitivity Modifier')] = 'done';
    const { user } = render('/loadouts/l1/sheet', data);
    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    const ads = within(d2).getByRole('listitem', { name: 'ADS Sensitivity Modifier' });
    expect(within(ads).getByText('Yours: 1')).toHaveClass('is-differs');
    await openRow(user, ads);
    expect(within(ads).getByText('Needs fixing', { selector: '.status-chip' })).toBeInTheDocument();
    expect(within(ads).queryByText('Done', { selector: '.status-chip' })).not.toBeInTheDocument();
    expect(ads).toHaveTextContent('You marked this Done, but your value differs from 1.5.');
    // Axial Deadzone done; firmware, Look Sensitivity and ADS Sensitivity Modifier need fixing.
    expect(screen.getByText('1 of 22 done · 3 need fixing')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    const text = writeText.mock.calls[0]![0];
    expect(text).toContain('- ADS Sensitivity Modifier: 1.5 [Official] · Needs fixing · Yours: 1 (differs)');
    expect(text).toContain('Progress: 1 of 22 done · 3 need fixing');
  });

  it('lists the aim settings with a value, confidence and the current value', async () => {
    const { user } = render('/loadouts/l1/sheet', pulseWithConfig());
    const aim = screen.getByRole('region', { name: 'Aim settings' });
    const precision = within(aim).getByRole('listitem', { name: 'Precision' });
    expect(within(precision).getByText('Raise', { selector: '.sheet-value .num' })).toBeInTheDocument();
    // The aim rows' confidence differs, so each row says its own, beside the player's value.
    expect(within(aim).queryByText(/./, { selector: '.sheet-section-head .badge' })).not.toBeInTheDocument();
    expect(within(precision).getByText('Reasoned', { selector: '.sheet-row-meta .badge' })).toBeInTheDocument();
    expect(within(precision).getByText('Yours: 40')).toBeInTheDocument();
    const sheet = await openRow(user, precision);
    expect([...sheet.querySelectorAll('.readout')].map((r) => r.textContent)).toEqual(['Yours40', 'DirectionRaise']);
    expect(within(sheet).getByRole('link', { name: /^What is this\?\s*\(Precision\)$/ })).toHaveAttribute('href', '/learn/precision');
    await user.keyboard('{Escape}');

    // Every aim row has a value in the same place as the Destiny 2 rows, from the knowledge base.
    const row = (name: string) => within(aim).getByRole('listitem', { name });
    const value = (name: string) => row(name).querySelector('.sheet-value')!.textContent;
    expect(value('Sensitivity')).toBe('Your cm/360by feel');
    // The row's badge is the value's; the statements keep their own inside the panel.
    expect(within(row('Sensitivity')).getByText('Gap', { selector: '.sheet-row-meta .badge' })).toBeInTheDocument();
    expect(value('Smoothing')).toBe('A presetby feel');
    expect(value('Aiming Curve')).toBe('Lineardefault');
    expect(value('Quantization')).toBe('Offdefault');
    expect(value('Velocity Mapping')).toBe('Standarddefault');
    expect(within(row('Aiming Curve')).getByText('Official', { selector: '.sheet-row-meta .badge' })).toBeInTheDocument();
    // The guidance is in the row's panel, behind the one label every evidence disclosure uses,
    // with a count when it holds several statements.
    const curve = row('Aiming Curve');
    await openRow(user, curve);
    expect(curve).toHaveTextContent('The default is linear.');
    expect(within(curve).getByText(/^Why and source \(\d+\)$/).closest('details')).not.toHaveAttribute('open');
    await user.keyboard('{Escape}');
    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    const axial = within(d2).getByRole('listitem', { name: 'Axial Deadzone' });
    await openRow(user, axial);
    expect(within(axial).getByText('Why and source')).toBeInTheDocument();
    expect(screen.queryByText('Reasons and sources')).not.toBeInTheDocument();

    // The section header's badge is part of the summary line.
    const favours = within(aim).getByText('What tracking settings should favour').closest('summary')!;
    expect(within(favours).getByText('Reasoned', { selector: '.badge' })).toBeInTheDocument();
  });

  it('shows a precision-hold loadout’s aiming curve once: its lever, with XIM’s default and guidance', async () => {
    const scout = sampleLoadout({ weapons: { kinetic: 'scout-rifle', energy: null, power: null } });
    const { user } = render('/loadouts/l1/sheet', sampleData({ loadouts: [scout] }));
    const aim = screen.getByRole('region', { name: 'Aim settings' });
    const curves = within(aim).getAllByRole('listitem', { name: 'Aiming Curve' });
    expect(curves).toHaveLength(1);
    const curve = curves[0]!;
    expect(curve.querySelector('.sheet-value')).toHaveTextContent('It dependsXIM’s default: Linear');
    expect(within(curve).getByText('Reasoned', { selector: '.sheet-row-meta .badge' })).toBeInTheDocument();
    // XIM's guidance on the curve comes with the lever, in its panel.
    await openRow(user, curve);
    const guidance = real.termById('aiming-curve')!.guidance;
    const more = within(curve).getByText(`Guidance on Aiming Curve (${guidance.length})`).closest('details')!;
    expect(more).not.toHaveAttribute('open');
    for (const statement of guidance) expect(more).toHaveTextContent(statement.text);
  });

  it('links on from the top and from the end of the sheet', () => {
    render('/loadouts/l1/sheet', pulseWithConfig());
    const building = screen.getAllByRole('link', { name: 'Continue building' });
    expect(building).toHaveLength(2);
    for (const link of building) expect(link).toHaveAttribute('href', '/build/l1');
    expect(screen.getByRole('link', { name: 'Enter settings' })).toHaveAttribute('href', '/tune/l1/settings');
    const more = screen.getByRole('list', { name: 'More for this loadout' });
    expect(within(more).getByRole('link', { name: 'Tune this loadout' })).toHaveAttribute('href', '/tune/l1');
    expect(within(more).getByRole('link', { name: 'Troubleshoot by feel' })).toHaveAttribute('href', '/troubleshoot');
    expect(within(more).getByRole('link', { name: 'All loadouts' })).toHaveAttribute('href', '/loadouts');
  });

  it('keeps the Easing caveat on a hand cannon sheet', async () => {
    const { user } = render(
      '/loadouts/l2/sheet',
      sampleData({
        loadouts: [sampleLoadout({ id: 'l2', name: 'Peek', weapons: { kinetic: 'hand-cannon', energy: null, power: null } })],
      }),
    );
    const easing = within(screen.getByRole('region', { name: 'Aim settings' })).getByRole('listitem', { name: 'Easing' });
    expect(within(easing).getByText('Lower', { selector: '.sheet-value .num' })).toBeInTheDocument();
    await openRow(user, easing);
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
    const marks: [string, { done: string; problem: string }][] = [
      ['Sensitivity', { done: 'true', problem: 'false' }],
      ['Precision', { done: 'true', problem: 'false' }],
      ['Aiming Curve', { done: 'false', problem: 'false' }],
    ];
    for (const [name, expected] of marks) {
      const row = within(aim).getByRole('listitem', { name });
      await openRow(user, row);
      expect(pressed(row)).toEqual(expected);
      await user.keyboard('{Escape}');
    }

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

  it('shows a check whose values differ as Needs fixing, even when it was ticked Done', async () => {
    const data = pulseWithConfig();
    data.profile = { ...data.profile, mouseDpi: 1600 };
    data.configs.l1!.matrix.configDpi = 800;
    data.progress[progressKey.check('mouse-dpi-matches')] = 'done';
    const { user } = render('/loadouts/l1/sheet', data);
    const setup = screen.getByRole('region', { name: 'MATRIX setup' });
    const dpi = within(setup).getByRole('listitem', {
      name: knowledge.foundation.find((c) => c.id === 'mouse-dpi-matches')!.title,
    });
    expect(dpi.querySelector('.sheet-status')).toHaveClass('is-problem');
    await openRow(user, dpi);
    expect(within(dpi).getByText('Needs fixing', { selector: '.status-chip' })).toBeInTheDocument();
    expect(within(dpi).queryByRole('group', { name: 'Status' })).not.toBeInTheDocument();
    expect(dpi).toHaveTextContent('This Config: 800 DPI');
    expect(dpi).toHaveTextContent('You marked this Done, but the values below differ.');
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
    expect(within(aim).getByRole('listitem', { name: 'Precision' })).not.toHaveTextContent('Yours');
    expect(within(aim).getByRole('listitem', { name: 'Smoothing' })).toHaveTextContent(
      'Yours: Custom Classic (Smooth 12)',
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

  it('filters the rows to the ones that need fixing, or the ones still to go', async () => {
    const { user } = render('/loadouts/l1/sheet', pulseWithConfig());
    const show = screen.getByRole('group', { name: 'Show' });
    const chip = (name: RegExp) => within(show).getByRole('button', { name });
    expect(chip(/^All 22$/)).toHaveAttribute('aria-pressed', 'true');
    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    const setup = screen.getByRole('region', { name: 'MATRIX setup' });
    const aim = screen.getByRole('region', { name: 'Aim settings' });
    const names = (section: HTMLElement) =>
      [...section.querySelectorAll('.sheet-row')].map((row) => row.querySelector('.sheet-name')!.textContent);

    await user.click(chip(/^Needs fixing 2$/));
    expect(chip(/^Needs fixing 2$/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^All 22$/)).toHaveAttribute('aria-pressed', 'false');
    expect(names(d2)).toEqual(['Look Sensitivity']);
    expect(names(setup)).toEqual([knowledge.foundation.find((c) => c.id === 'firmware-current')!.title]);
    expect(aim).toHaveTextContent('Nothing here needs fixing.');
    // The count is the whole sheet's, whatever is shown.
    expect(screen.getByText('1 of 22 done · 2 need fixing')).toBeInTheDocument();

    await user.click(chip(/^To go 19$/));
    expect(names(d2)).not.toContain('Look Sensitivity');
    expect(names(d2)).not.toContain('Axial Deadzone');
    expect(names(d2)).toContain('Movement Controls');

    await user.click(chip(/^All 22$/));
    expect(names(d2)).toHaveLength(knowledge.game.requiredSettings.length);
  });

  it('takes Look Sensitivity and ADS Sensitivity Modifier from the game when the Config uses Custom sync', async () => {
    const data = pulseWithConfig();
    data.configs.l1!.matrix.syncMethod = 'custom';
    const { user } = render('/loadouts/l1/sheet', data);
    const d2 = screen.getByRole('region', { name: 'Destiny 2 settings' });
    const look = within(d2).getByRole('listitem', { name: 'Look Sensitivity' });
    // Not compared with XIM's list, so 18 isn't a problem: the row keeps the player's own mark.
    expect(look.querySelector('.sheet-value')).toHaveTextContent('Match ConfigCustom sync');
    expect(look).not.toHaveTextContent('Yours');
    expect(look.querySelector('.sheet-status')).toHaveClass('is-none');
    // Worked out rather than Official, so the badges move from the title onto the rows.
    expect(within(d2).queryByText(/./, { selector: '.sheet-section-head .badge' })).not.toBeInTheDocument();
    expect(within(look).getByText('Reasoned', { selector: '.badge' })).toBeInTheDocument();
    const axial = within(d2).getByRole('listitem', { name: 'Axial Deadzone' });
    expect(within(axial).getByText('Official', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.getByText('1 of 22 done · 1 needs fixing')).toBeInTheDocument();

    await openRow(user, look);
    expect(pressed(look)).toEqual({ done: 'false', problem: 'false' });
    expect(look).toHaveTextContent(/doesn't compare Look Sensitivity or ADS Sensitivity Modifier with XIM's list/);
    await user.click(within(look).getByRole('button', { name: 'Done' }));
    expect(screen.getByText('2 of 22 done · 1 needs fixing')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    const text = writeText.mock.calls[0]![0];
    expect(text).toContain('- Look Sensitivity: Match Config (Custom sync) [Reasoned] · Done\n');
    expect(text).toContain('- ADS Sensitivity Modifier: Match Config (Custom sync) [Reasoned] · Not checked yet\n');
    expect(text).toContain('Progress: 2 of 22 done · 1 needs fixing');
  });

  it('counts a Custom-sync loadout on its card the way its sheet does', () => {
    const data = pulseWithConfig();
    data.configs.l1!.matrix.syncMethod = 'custom';
    render('/loadouts', data);
    expect(screen.getByRole('img', { name: 'Sheet 1 of 22 done · 1 needs fixing' })).toBeInTheDocument();
  });

  it('shows not found for an unknown loadout', () => {
    render('/loadouts/nope/sheet', sampleData());
    expect(screen.getByRole('heading', { level: 1, name: 'Loadout not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See your loadouts' })).toHaveAttribute('href', '/loadouts');
  });
});
