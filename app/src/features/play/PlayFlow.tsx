import { Route, Routes } from 'react-router';
import { NotFoundScreen } from '../../screens/NotFoundScreen';
import { FrameworkScreen } from './FrameworkScreen';
import { LoadoutPlanScreen } from './LoadoutPlanScreen';
import { MapScreen } from './MapScreen';
import { PlayIndexScreen } from './PlayIndexScreen';
import { PrincipleScreen } from './PrincipleScreen';
import { SessionScreen } from './SessionScreen';
import './play.css';

/**
 * Flow E, Play (CONCEPT.md §5), mounted at `play/*`: the index, one framework, one principle,
 * one loadout plan, one map card, and the session's death tally.
 */
export function PlayFlow() {
  return (
    <Routes>
      <Route index element={<PlayIndexScreen />} />
      <Route path="frameworks/:frameworkId" element={<FrameworkScreen />} />
      <Route path="mindset/:principleId" element={<PrincipleScreen />} />
      <Route path="loadouts/:planId" element={<LoadoutPlanScreen />} />
      <Route path="maps/:mapId" element={<MapScreen />} />
      <Route path="session" element={<SessionScreen />} />
      <Route path="*" element={<NotFoundScreen />} />
    </Routes>
  );
}
