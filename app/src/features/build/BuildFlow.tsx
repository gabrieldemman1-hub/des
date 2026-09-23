import { Navigate, Route, Routes, useParams } from 'react-router';
import { NotFoundScreen } from '../../screens/NotFoundScreen';
import { useEffectiveProgress } from '../../state/use-progress';
import { resumeStep } from './build-plan';
import { BuildIndexScreen } from './BuildIndexScreen';
import { BuildStepScreen } from './BuildStepScreen';
import { LoadoutNotFound } from './parts';
import { buildPath, useBuildPlan } from './use-build-plan';

/** /build/<loadoutId>: picks up at the first step that isn't fully done. */
function ResumeBuild() {
  const { loadoutId } = useParams();
  const progress = useEffectiveProgress();
  const plan = useBuildPlan(loadoutId);
  if (!plan) {
    return (
      <LoadoutNotFound
        back={{ to: '/build', label: 'Build my config' }}
        link={{ to: '/build', label: 'Choose another loadout' }}
      />
    );
  }
  return <Navigate to={buildPath(plan.loadout.id, resumeStep(plan, progress))} replace />;
}

/**
 * Flow A, Build my config (CONCEPT.md §5): pick a loadout, then walk through its Config in
 * dependency order, ending at its config sheet. The step is part of the address, so a reload
 * keeps your place.
 */
export function BuildFlow() {
  return (
    <Routes>
      <Route index element={<BuildIndexScreen />} />
      <Route path=":loadoutId" element={<ResumeBuild />} />
      <Route path=":loadoutId/:stepId" element={<BuildStepScreen />} />
      <Route path="*" element={<NotFoundScreen />} />
    </Routes>
  );
}
