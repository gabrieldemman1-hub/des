import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { sampleData, sampleLoadout } from '../test/fixtures';
import { MemoryStorage } from '../test/memory-storage';
import { renderApp } from '../test/render';
import { defaultProfile, type AppData } from '../state/schema';
import { STORAGE_KEY, createBackup } from '../state/storage';

function stored(storage: MemoryStorage): AppData {
  return storage.json(STORAGE_KEY) as AppData;
}

describe('Profile screen', () => {
  it('shows every profile field, labelled', () => {
    renderApp({ path: '/profile' });
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();

    const platform = screen.getByRole('group', { name: 'Platform' });
    expect(within(platform).getByRole('radio', { name: 'Xbox' })).not.toBeChecked();
    expect(within(platform).getByRole('radio', { name: 'PC' })).not.toBeChecked();

    const output = screen.getByRole('group', { name: 'Output type' });
    expect(output).toHaveTextContent('Controller output');
    expect(output).toHaveTextContent(/controller output only/);

    expect(screen.getByRole('textbox', { name: 'Mouse model' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Mouse DPI' })).toHaveValue('');
    const rate = screen.getByRole('combobox', { name: 'Mouse polling rate' });
    expect(within(rate).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Not set',
      '125 Hz',
      '250 Hz',
      '500 Hz',
      '1,000 Hz',
      '2,000 Hz',
      '4,000 Hz',
      '8,000 Hz',
    ]);

    for (const [group, options] of [
      ['Main focus', ['Crucible', 'PvE', 'Both']],
      ['How you play', ['Aggressive', 'Balanced', 'Precise']],
      ['Snappy or smooth', ['Snappy', 'Lean snappy', 'Middle', 'Lean smooth', 'Smooth']],
      ['Sensitivity', ['Low', 'Medium', 'High']],
    ] as const) {
      const radios = within(screen.getByRole('group', { name: group })).getAllByRole('radio');
      expect(radios.map((r) => r.closest('label')?.textContent)).toEqual(options);
    }
  });

  it('saves each change straight away', async () => {
    const { user, storage } = renderApp({ path: '/profile' });

    await user.click(screen.getByRole('radio', { name: 'PC' }));
    expect(stored(storage!).profile.platform).toBe('pc');
    expect(screen.getByText('Saved on this phone.')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Mouse model' }), 'Test Mouse');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Mouse polling rate' }), '4000');
    await user.click(screen.getByRole('radio', { name: 'Crucible' }));
    await user.click(screen.getByRole('radio', { name: 'Precise' }));
    await user.click(screen.getByRole('radio', { name: 'Lean smooth' }));
    await user.click(screen.getByRole('radio', { name: 'High' }));

    expect(stored(storage!).profile).toEqual({
      ...defaultProfile(),
      platform: 'pc',
      mouseModel: 'Test Mouse',
      pollingRate: 4000,
      focus: 'crucible',
      style: 'precise',
      feel: 4,
      sensitivity: 'high',
    });
  });

  it('only saves a DPI that is a positive whole number', async () => {
    const { user, storage } = renderApp({ path: '/profile' });
    const dpi = screen.getByRole('textbox', { name: 'Mouse DPI' });

    await user.type(dpi, '1600');
    expect(dpi).not.toHaveAttribute('aria-invalid', 'true');
    expect(stored(storage!).profile.mouseDpi).toBe(1600);

    await user.clear(dpi);
    await user.type(dpi, '16.5');
    expect(dpi).toHaveAttribute('aria-invalid', 'true');
    expect(dpi).toHaveAccessibleDescription(/Enter a whole number above 0/);
    expect(stored(storage!).profile.mouseDpi).toBe(16); // the last valid value, typed on the way

    await user.clear(dpi);
    await user.type(dpi, '0');
    expect(screen.getByText('Enter a whole number above 0.')).toBeInTheDocument();

    await user.clear(dpi);
    expect(stored(storage!).profile.mouseDpi).toBeNull();
    expect(screen.queryByText('Enter a whole number above 0.')).not.toBeInTheDocument();
  });

  it('shows saved values when it opens', () => {
    const data = sampleData({
      profile: { ...defaultProfile(), platform: 'xbox', mouseDpi: 800, pollingRate: 1000, feel: 1 },
    });
    renderApp({ path: '/profile', storage: new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) }) });
    expect(screen.getByRole('radio', { name: 'Xbox' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Mouse DPI' })).toHaveValue('800');
    expect(screen.getByRole('combobox', { name: 'Mouse polling rate' })).toHaveValue('1000');
    expect(screen.getByRole('radio', { name: 'Snappy' })).toBeChecked();
  });

  it('downloads a backup of everything saved', async () => {
    const data = sampleData({ profile: { ...defaultProfile(), platform: 'pc' }, loadouts: [sampleLoadout()] });
    let blob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blob = b as Blob;
      return 'blob:backup';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const { user } = renderApp({ path: '/profile', storage: new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) }) });
    await user.click(screen.getByRole('button', { name: 'Download backup' }));

    expect(click).toHaveBeenCalledOnce();
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^dialed-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const backup = JSON.parse(await blob!.text()) as Record<string, unknown>;
    expect(backup).toMatchObject({ app: 'dialed', version: 1, profile: data.profile, loadouts: data.loadouts });
    expect(screen.getByText('Backup downloaded.')).toBeInTheDocument();
  });

  it('restores a backup after confirmation', async () => {
    const { user, storage } = renderApp({ path: '/profile' });
    await user.click(screen.getByRole('radio', { name: 'Xbox' }));

    const backup = sampleData({
      profile: { ...defaultProfile(), platform: 'pc', mouseDpi: 3200 },
      loadouts: [sampleLoadout()],
    });
    const file = new File([createBackup(backup, new Date('2026-09-01T00:00:00Z'))], 'backup.json', {
      type: 'application/json',
    });
    await user.upload(screen.getByLabelText('Restore from backup'), file);

    const dialog = await screen.findByRole('alertdialog', { name: 'Replace your data with this backup?' });
    expect(dialog).toHaveTextContent('has 1 loadout');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(stored(storage!).profile.platform).toBe('xbox'); // nothing replaced yet

    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(stored(storage!)).toEqual(backup);
    expect(screen.getByRole('radio', { name: 'PC' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Mouse DPI' })).toHaveValue('3200');
    expect(screen.getByText('Backup restored.')).toBeInTheDocument();
  });

  it('keeps everything when the restore is cancelled', async () => {
    const { user, storage } = renderApp({ path: '/profile' });
    await user.click(screen.getByRole('radio', { name: 'Xbox' }));
    const file = new File([createBackup(sampleData(), new Date())], 'backup.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Restore from backup'), file);

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(stored(storage!).profile.platform).toBe('xbox');
  });

  it('explains why a file cannot be restored', async () => {
    const { user } = renderApp({ path: '/profile' });
    const file = new File(['{"hello":"world"}'], 'other.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Restore from backup'), file);
    await waitFor(() => expect(screen.getByText('That file isn’t a Dialed backup.')).toBeInTheDocument());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
