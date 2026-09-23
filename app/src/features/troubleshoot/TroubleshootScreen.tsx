import { useId, useRef } from 'react';
import { Link } from 'react-router';
import type { Symptom } from '../../../../knowledge/index';
import { EmptyState } from '../../components/EmptyState';
import { ChevronIcon } from '../../components/icons';
import { Screen } from '../../components/Screen';
import { OUTPUT_TYPE_LABELS, PLATFORM_LABELS } from '../../content/labels';
import { useData } from '../../state/data-context';
import { checksForProfile } from '../../state/guidance';
import { useKnowledge } from '../../state/knowledge-context';
import type { ProgressCount } from '../../state/progress';
import type { Profile } from '../../state/schema';
import { useEffectiveProgress } from '../../state/use-progress';
import { SetupChecklist, SetupSummary } from './SetupChecklist';
import { summarizeChecks } from './setup-progress';
import './troubleshoot.css';

/** Which checks are shown, and why: the profile decides, and unset parts keep every check. */
function ProfileNote({ profile }: { profile: Pick<Profile, 'platform' | 'outputType'> }) {
  if (profile.platform === null) {
    return (
      <p className="hint">
        Your profile doesn’t say whether you play on Xbox or PC, so checks for both platforms are shown.{' '}
        <Link to="/profile">Set your platform in your profile</Link>
      </p>
    );
  }
  if (profile.outputType === null) {
    return (
      <p className="hint">
        Showing checks for {PLATFORM_LABELS[profile.platform]}. Your profile doesn’t say which controller output you
        use, so checks for every output type are shown. <Link to="/profile">Set your output in your profile</Link>
      </p>
    );
  }
  return (
    <p className="hint">
      Showing checks for {PLATFORM_LABELS[profile.platform]} with {OUTPUT_TYPE_LABELS[profile.outputType].title}{' '}
      output. <Link to="/profile">Change this in your profile</Link>
    </p>
  );
}

function SymptomCard({ symptom }: { symptom: Symptom }) {
  const isGap = symptom.mapping.confidence === 'gap';
  return (
    <li>
      <Link className="flow-card" to={`/troubleshoot/${symptom.id}`}>
        <span className="flow-card-text">
          <span className="flow-card-title">{symptom.label}</span>
          {symptom.aliases.length > 0 && (
            <span className="flow-card-summary">
              <span className="visually-hidden">Also: </span>
              {symptom.aliases.slice(0, 3).join(' · ')}
            </span>
          )}
          {isGap && (
            <span>
              <span className="tag">No sourced answer yet</span>
            </span>
          )}
        </span>
        <ChevronIcon />
      </Link>
    </li>
  );
}

/** Nudges toward finishing stage 1 first, without blocking stage 2. */
function stage2Hint({ total, done, problem }: ProgressCount): string {
  const checked = done + problem;
  if (checked < total) {
    return `Best after the setup check (you’ve checked ${checked} of ${total}), but you can pick a feel now.`;
  }
  if (problem > 0) {
    return 'Every setup check is marked. Fix the ones marked Needs fixing first, then pick the feel that fits best.';
  }
  return 'Setup check done. Pick the feel that fits best.';
}

/** Flow C: rule out setup mistakes (stage 1), then go from a feel to a setting (stage 2). */
export function TroubleshootScreen() {
  const { kb } = useKnowledge();
  const { data } = useData();
  const progress = useEffectiveProgress();
  const id = useId();
  const stage2Heading = useRef<HTMLHeadingElement>(null);

  const checks = checksForProfile(kb.foundation, data.profile);
  const summary = summarizeChecks(checks, progress);

  return (
    <Screen
      title="Troubleshoot by feel"
      back={{ to: '/', label: 'Home' }}
      intro={
        <>
          <p className="lede">
            For when something feels wrong but you don’t know which setting is responsible. Setup mistakes are the
            best-documented causes of bad-feeling aim, so they get ruled out first. Then you pick what you feel, and
            Dialed points to the setting responsible where a source backs it up, or says so when none does.
          </p>
          {checks.length > 0 && kb.symptoms.length > 0 && (
            <p>
              <button type="button" className="button small secondary" onClick={() => stage2Heading.current?.focus()}>
                Skip to stage 2
              </button>
            </p>
          )}
        </>
      }
    >
      <section className="ts-stage" aria-labelledby={`${id}-stage1`}>
        <h2 className="section-title" id={`${id}-stage1`}>
          <span className="ts-stage-label">
            Stage 1<span className="visually-hidden">:</span>
          </span>{' '}
          Setup check
        </h2>
        <p className="hint">
          Work through each check and mark it Done, or Needs fixing to see how to fix it. Your marks are saved on this
          phone, and Build my config shares them: a check marked here shows as marked there too.
        </p>
        <ProfileNote profile={data.profile} />
        {checks.length === 0 ? (
          <EmptyState title="No setup checks yet" level={3}>
            <p>Dialed’s knowledge base has no setup checks for your setup yet, so there’s nothing to check here.</p>
          </EmptyState>
        ) : (
          <>
            <SetupSummary checks={checks} allowReset />
            <SetupChecklist checks={checks} />
          </>
        )}
      </section>

      <section className="ts-stage" aria-labelledby={`${id}-stage2`}>
        <h2 className="section-title" id={`${id}-stage2`} ref={stage2Heading} tabIndex={-1}>
          <span className="ts-stage-label">
            Stage 2<span className="visually-hidden">:</span>
          </span>{' '}
          What do you feel?
        </h2>
        {checks.length > 0 && <p className="hint">{stage2Hint(summary)}</p>}
        {kb.symptoms.length === 0 ? (
          <EmptyState title="No symptoms yet" level={3}>
            <p>Dialed’s knowledge base has no symptoms written yet.</p>
          </EmptyState>
        ) : (
          <ul className="flow-cards">
            {kb.symptoms.map((symptom) => (
              <SymptomCard key={symptom.id} symptom={symptom} />
            ))}
          </ul>
        )}
      </section>
    </Screen>
  );
}
