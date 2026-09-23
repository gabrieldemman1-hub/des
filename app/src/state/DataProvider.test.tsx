import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { sampleData, sampleLoadout } from '../test/fixtures';
import { MemoryStorage } from '../test/memory-storage';
import { renderApp } from '../test/render';
import { useData, type DataApi } from './data-context';
import { DataProvider } from './DataProvider';
import { defaultProfile, type AppData } from './schema';
import { STORAGE_KEY } from './storage';

/** What another tab or window would do: write the data, then the browser fires `storage` here. */
function saveFromAnotherTab(data: AppData | string, storageArea: Storage = localStorage) {
  const newValue = typeof data === 'string' ? data : JSON.stringify(data);
  const oldValue = storageArea.getItem(STORAGE_KEY);
  storageArea.setItem(STORAGE_KEY, newValue);
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, oldValue, newValue, storageArea }));
  });
}

function storedData(): AppData {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as AppData;
}

function Probe({ onApi }: { onApi: (api: DataApi) => void }) {
  const api = useData();
  useEffect(() => {
    onApi(api);
  });
  return null;
}

function renderProvider(storage: Storage | null) {
  let latest: DataApi | undefined;
  render(
    <DataProvider storage={storage}>
      <Probe
        onApi={(api) => {
          latest = api;
        }}
      />
    </DataProvider>,
  );
  return () => latest!;
}

describe('DataProvider', () => {
  it('takes in changes saved by Dialed in another tab, so its next save keeps them', async () => {
    const { user } = renderApp({ path: '/profile', storage: localStorage });
    expect(screen.getByRole('radio', { name: 'PC' })).not.toBeChecked();

    saveFromAnotherTab(sampleData({ profile: { ...defaultProfile(), platform: 'pc', mouseDpi: 1600 } }));
    expect(screen.getByRole('radio', { name: 'PC' })).toBeChecked();
    // The DPI field keeps its own text, so it starts again from the new data.
    expect(screen.getByRole('textbox', { name: 'Mouse DPI' })).toHaveValue('1600');

    await user.click(screen.getByRole('radio', { name: 'Crucible' }));
    expect(storedData().profile).toMatchObject({ platform: 'pc', mouseDpi: 1600, focus: 'crucible' });
  });

  it('keeps the loadouts another tab saved when this tab saves', async () => {
    const { user } = renderApp({ path: '/profile', storage: localStorage });
    saveFromAnotherTab(sampleData({ loadouts: [sampleLoadout()] }));
    await user.click(screen.getByRole('radio', { name: 'Xbox' }));
    expect(storedData().loadouts).toEqual([sampleLoadout()]);
    expect(storedData().profile.platform).toBe('xbox');
  });

  it('ignores other keys, other storage areas and data it cannot read', () => {
    const get = renderProvider(localStorage);
    act(() => get().updateProfile({ platform: 'xbox' }));

    localStorage.setItem('someone-else', 'x');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'someone-else', newValue: 'x', storageArea: localStorage }));
    });
    saveFromAnotherTab(sampleData({ profile: { ...defaultProfile(), platform: 'pc' } }), sessionStorage);
    saveFromAnotherTab('{broken');
    expect(get().data.profile.platform).toBe('xbox');

    // Removed by something else on the same origin: the data in memory is kept.
    localStorage.removeItem(STORAGE_KEY);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: null, storageArea: localStorage }));
    });
    expect(get().data.profile.platform).toBe('xbox');
  });

  it('reports whether the latest change was saved', () => {
    const storage = new MemoryStorage();
    const get = renderProvider(storage);
    expect(get().saveState).toBe('idle');
    act(() => get().updateProfile({ platform: 'pc' }));
    expect(get().saveState).toBe('saved');

    storage.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    act(() => get().updateProfile({ platform: 'xbox' }));
    expect(get().saveState).toBe('failed');
    expect(get().notice).toBe('save-failed');
  });

  it('starts as not saved when storage is unavailable', () => {
    const get = renderProvider(null);
    expect(get().saveState).toBe('failed');
    expect(get().notice).toBe('unavailable');
  });

  it('only saves a valid profile', () => {
    const storage = new MemoryStorage();
    const get = renderProvider(storage);
    act(() => get().updateProfile({ feel: 9 })); // a number, but out of range
    expect(get().data.profile.feel).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    act(() => get().updateProfile({ feel: 4 }));
    expect(get().data.profile.feel).toBe(4);
  });
});
