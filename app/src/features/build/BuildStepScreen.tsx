import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Screen } from '../../components/Screen';
import { useData } from '../../state/data-context';
import { loadoutPrefix } from '../../state/progress';
import {
  BUILD_STEPS,
  progressText,
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
                  {`Step ${i + 1}: ${step.title}${count ? `, ${progressText(count)}` : ''}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepPager({ plan, index }: { plan: BuildPlan; index: number }) {
  const prev = BUILD_STEPS[index - 1];
  const next = BUILD_STEPS[index + 1];
  const id = plan.loadout.id;
  return (
    <nav className="build-pager" aria-label="Previous and next step">
      {prev ? (
        <Link className="button secondary" to={buildPath(id, prev.id)}>
          Back
        </Link>
      ) : (
        <Link className="button secondary" to="/build">
          All loadouts
        </Link>
      )}
      {next ? (
        <Link className="button primary" to={buildPath(id, next.id)}>
          Next: {next.title}
        </Link>
      ) : (
        <Link className="button secondary" to="/build">
          All loadouts
        </Link>
      )}
    </nav>
  );
}

/** Clears this loadout's own ticks. The shared Destiny 2 and setup ticks stay. */
function ResetLoadoutSteps({ plan }: { plan: BuildPlan }) {
  const { clearProgress } = useData();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const name = plan.loadout.name;

  return (
    <div className="build-reset">
      <button type="button" className="button secondary small" onClick={() => setOpen(true)}>
        Reset this loadout’s steps
      </button>
      <p className="hint" role="status">
        {message}
      </p>
      <ConfirmDialog
        open={open}
        title={`Reset the steps for “${name}”?`}
        confirmLabel="Reset"
        danger
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          clearProgress(loadoutPrefix(plan.loadout.id));
          setOpen(false);
          setMessage(`Cleared the aim settings you ticked for “${name}”.`);
        }}
      >
        <p>
          This clears what you’ve ticked in Aim settings for this loadout. The Destiny 2 settings and MATRIX setup are
          shared with your other loadouts and with Troubleshoot by feel, so they stay as they are.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/** One step of the walkthrough, at /build/<loadoutId>/<stepId>. */
export function BuildStepScreen() {
  const { loadoutId, stepId } = useParams();
  const { data } = useData();
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
  const counts = stepProgress(plan, data.progress);
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
      {step.id === 'matrix' && <MatrixSetupStep plan={plan} count={counts.matrix} />}
      {step.id === 'aim' && <AimSettingsStep plan={plan} count={counts.aim} />}
      {step.id === 'sheet' && <SheetStep plan={plan} />}
      <StepPager plan={plan} index={index} />
      <ResetLoadoutSteps plan={plan} />
    </Screen>
  );
}
