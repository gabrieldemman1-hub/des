import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { knowledge } from '../../../../knowledge/index';
import { EASING_CAVEAT } from '../../../../knowledge/integrity';
import { createKnowledgeApi } from '../../state/knowledge-context';
import { progressKey } from '../../state/progress';
import { emptyConfig, type AppData } from '../../state/schema';
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
  config.inGame.lookSensitivity = 18;
  config.inGame.adsSensitivityModifier = 1.5;
  config.aim.precision = 40;
  return sampleData({
    loadouts: [sampleLoadout()],
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
    expect(screen.getByRole('link', { name: 'Enter current settings' })).toHaveAttribute('href', '/tune/l1');
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

  it('shows not found for an unknown loadout', () => {
    render('/loadouts/nope/sheet', sampleData());
    expect(screen.getByRole('heading', { level: 1, name: 'Loadout not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See your loadouts' })).toHaveAttribute('href', '/loadouts');
  });
});
