import { Route, Routes } from 'react-router';
import { NotFoundScreen } from '../../screens/NotFoundScreen';
import { TuneIndexScreen } from './TuneIndexScreen';
import { TuneLoadoutScreen } from './TuneLoadoutScreen';

/**
 * Tune my config (CONCEPT.md §5 Flow B), mounted at `tune/*`:
 * - /tune: pick a loadout
 * - /tune/:loadoutId: goes to "What to change" once something is entered, else "Your settings"
 * - /tune/:loadoutId/settings: the player's current settings (autosaved)
 * - /tune/:loadoutId/changes: what to change, ordered by impact
 */
export function TuneFlow() {
  return (
    <Routes>
      <Route index element={<TuneIndexScreen />} />
      <Route path=":loadoutId" element={<TuneLoadoutScreen />} />
      <Route path=":loadoutId/:tab" element={<TuneLoadoutScreen />} />
      <Route path="*" element={<NotFoundScreen />} />
    </Routes>
  );
}
