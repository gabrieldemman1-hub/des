import { Link, Navigate, useParams } from 'react-router';
import { ClearAimMarks } from '../../components/ClearAimMarks';
import { Screen } from '../../components/Screen';
import { progressSummary } from '../../state/progress';
import { useEffectiveProgress } from '../../state/use-progress';
import {
  BUILD_STEPS,
  stepById,
  stepProgress,
  type BuildPlan,
  type BuildStepInfo,
  type ChecklistStepId,
  type ProgressCount,
} from './build-plan';
import { AimSettingsStep, GameSettingsStep, MatrixSetupStep, SheetStep } from './BuildSteps';
import { LoadoutNotFound } from './parts';
import { buildPath, useBuildPlan } from './use-build-plan';
import './build.css';

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="m3 8.5 3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function StepIndicator({
  plan,
  current,
  counts,
}: {
  plan: BuildPlan;
  current: BuildStepInfo;
  counts: Record<ChecklistStepId, ProgressCount>;
}) {
  return (
    <nav aria-label="Build steps">
      <ol className="build-steps">
        {BUILD_STEPS.map((step, i) => {
          const count = step.id === 'sheet' ? undefined : counts[step.id];
          const complete = count !== undefined && count.total > 0 && count.done === count.total;
          const isCurrent = step.id === current.id;
          return (
            <li key={step.id}>
              <Link
                className={`build-step${complete ? ' is-complete' : ''}`}
                to={buildPath(plan.loadout.id, step.id)}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className="build-step-number" aria-hidden="true">
                  {complete ? <CheckMark /> : i + 1}
                </span>
                <span className="build-step-name" aria-hidden="true">
                  {step.short}
                </span>
                <span className="visually-hidden">
                  {`Step ${i + 1}: ${step.title}${count ? `, ${progressSummary(count)}` : ''}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Back and Next, each naming the step it leads to. Once at the end of the step, and on the setup
 * checks again (smaller) under the progress count at the top, so that long step can be left
 * without scrolling to its end.
 */
function StepPager({ plan, index, at = 'end' }: { plan: BuildPlan; index: number; at?: 'top' | 'end' }) {
  const prev = BUILD_STEPS[index - 1];
  const next = BUILD_STEPS[index + 1];
  const id = plan.loadout.id;
  const size = at === 'top' ? ' small' : '';
  return (
    <nav
      className={`build-pager${at === 'top' ? ' is-top' : ''}`}
      aria-label={at === 'top' ? 'Previous and next step, above the list' : 'Previous and next step'}
    >
      {prev ? (
        <Link className={`button secondary${size}`} to={buildPath(id, prev.id)}>
          Back: {prev.title}
        </Link>
      ) : (
        <Link className={`button secondary${size}`} to="/build">
          All loadouts
        </Link>
      )}
      {next ? (
        <Link className={`button primary${size}`} to={buildPath(id, next.id)}>
          Next: {next.title}
        </Link>
      ) : (
        <Link className={`button secondary${size}`} to="/build">
          All loadouts
        </Link>
      )}
    </nav>
  );
}


/** One step of the walkthrough, at /build/<loadoutId>/<stepId>. */
export function BuildStepScreen() {
  const { loadoutId, stepId } = useParams();
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
  const step = stepById(stepId);
  if (!step) return <Navigate to={buildPath(plan.loadout.id)} replace />;

  const index = BUILD_STEPS.indexOf(step);
  const counts = stepProgress(plan, progress);
  const title = step.id === 'aim' ? `Aim settings for ${plan.loadout.name}` : step.title;

  return (
    <Screen
      // A new screen per step, so focus moves to the new heading.
      key={step.id}
      title={title}
      documentTitle={`${title} · Build my config`}
      back={{ to: '/build', label: 'Build my config' }}
      intro={
        <>
          <p className="build-step-of">
            Step {index + 1} of {BUILD_STEPS.length} · {plan.loadout.name}
          </p>
          <StepIndicator plan={plan} current={step} counts={counts} />
        </>
      }
    >
      {step.id === 'destiny-2' && <GameSettingsStep plan={plan} count={counts['destiny-2']} />}
      {step.id === 'matrix' && (
        <MatrixSetupStep plan={plan} count={counts.matrix} pager={<StepPager plan={plan} index={index} at="top" />} />
      )}
      {step.id === 'aim' && <AimSettingsStep plan={plan} count={counts.aim} />}
      {step.id === 'sheet' && <SheetStep plan={plan} />}
      <StepPager plan={plan} index={index} />
      <ClearAimMarks loadout={plan.loadout} />
    </Screen>
  );
}
