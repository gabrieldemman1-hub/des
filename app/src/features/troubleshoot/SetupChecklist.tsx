import { useState } from 'react';
import type { FoundationCheck } from '../../../../knowledge/index';
import { ChecklistItem } from '../../components/ChecklistItem';
import { ConfidenceBadge } from '../../components/ConfidenceBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PerConfigHint, PerConfigNote } from '../../components/PerConfigNote';
import { StatementView } from '../../components/StatementView';
import { TermLink } from '../../components/TermLink';
import { useData } from '../../state/data-context';
import { REQUIRED_SETTINGS_CHECK_ID, derivedProblemNote, progressKey, progressSummary } from '../../state/progress';
import { useDerivedProblemKeys, useEffectiveProgress } from '../../state/use-progress';
import { CHECK_PREFIX, hasCheckMarks, summarizeChecks } from './setup-progress';
import './troubleshoot.css';

/** One setup check: what to do, why (sourced), and how to fix it (sourced). */
function SetupCheckItem({ check }: { check: FoundationCheck }) {
  const { data } = useData();
  const progress = useEffectiveProgress();
  const derived = useDerivedProblemKeys();
  const key = progressKey.check(check.id);
  const needsFixing = progress[key] === 'problem';

  return (
    <ChecklistItem
      itemKey={key}
      title={check.title}
      derivedNote={
        derived.has(key)
          ? derivedProblemNote(data.progress[key], 'a saved Config’s values differ (see Build my config)')
          : undefined
      }
    >
      <p>{check.check}</p>
      <PerConfigNote checkId={check.id} />
      <details className="why">
        <summary>
          Why it matters <ConfidenceBadge level={check.why.confidence} />
        </summary>
        <div className="ts-details-body">
          <StatementView statement={check.why} showBadge={false} />
          {check.termIds.length > 0 && (
            <>
              <p className="hint">Settings in this check:</p>
              <ul className="related-links">
                {check.termIds.map((id) => (
                  <li key={id}>
                    <TermLink id={id} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </details>
      {check.fix && (
        // Opens by itself when the check is marked "Needs fixing"; the player can still close it.
        <details className="why" open={needsFixing}>
          <summary>
            How to fix it <ConfidenceBadge level={check.fix.confidence} />
          </summary>
          <div className="ts-details-body">
            <StatementView statement={check.fix} showBadge={false} />
          </div>
        </details>
      )}
    </ChecklistItem>
  );
}

/** The setup checks as a checklist. Marks are shared with Build my config (same keys). */
export function SetupChecklist({ checks }: { checks: readonly FoundationCheck[] }) {
  return (
    <>
      <PerConfigHint checks={checks} />
      <ul className="checklist">
        {checks.map((check) => (
          <SetupCheckItem key={check.id} check={check} />
        ))}
      </ul>
    </>
  );
}

interface SummaryProps {
  checks: readonly FoundationCheck[];
  /** Offer to clear every setup-check mark (with a confirmation). */
  allowReset?: boolean;
}

/** "5 of 10 done · 1 needs fixing", read out when it changes, and optionally a reset. */
export function SetupSummary({ checks, allowReset = false }: SummaryProps) {
  const { data, clearProgress } = useData();
  const progress = useEffectiveProgress();
  const [confirming, setConfirming] = useState(false);
  const summary = summarizeChecks(checks, progress);
  const canReset = hasCheckMarks(data.progress);
  const hasRequiredCheck = checks.some((c) => c.id === REQUIRED_SETTINGS_CHECK_ID);

  return (
    <div className="card ts-summary">
      <p className="ts-summary-count" role="status">
        {progressSummary(summary)}
      </p>
      {allowReset && (
        <>
          {/* aria-disabled rather than disabled keeps the button focusable, so focus has
              somewhere to return to after the marks are cleared. */}
          <button
            type="button"
            className="button small secondary"
            aria-disabled={!canReset}
            onClick={() => {
              if (canReset) setConfirming(true);
            }}
          >
            Clear all marks
          </button>
          <ConfirmDialog
            open={confirming}
            title="Clear the setup check?"
            confirmLabel="Clear marks"
            danger
            onConfirm={() => {
              clearProgress(CHECK_PREFIX);
              setConfirming(false);
            }}
            onCancel={() => setConfirming(false)}
          >
            <p>
              This clears every Done and Needs fixing mark in the setup check on this phone. Build my config uses the
              same checklist, so its marks are cleared too.
            </p>
            {hasRequiredCheck && (
              <p>
                The Destiny 2 settings check still follows the Destiny 2 settings you’ve marked in Build my config.
              </p>
            )}
          </ConfirmDialog>
        </>
      )}
    </div>
  );
}
