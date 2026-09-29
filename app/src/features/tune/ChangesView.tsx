import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { Link } from 'react-router';
import type { Statement } from '../../../../knowledge/index';
import { AimStyleSummary } from '../../components/AimStyleSummary';
import { ClearAimMarks } from '../../components/ClearAimMarks';
import { ConfidenceBadge } from '../../components/ConfidenceBadge';
import { EmptyState } from '../../components/EmptyState';
import { SharedCaveatNote, StatementView } from '../../components/StatementView';
import { hoistedCaveat } from '../../components/statements';
import { StatusChip, StatusMark } from '../../components/StatusToggles';
import { TermLink } from '../../components/TermLink';
import { AIMING_SOURCE_LABELS, LEVER_DIRECTION_LABELS, whySummary } from '../../content/labels';
import { useData } from '../../state/data-context';
import { leversForProfile } from '../../state/guidance';
import { useKnowledge } from '../../state/knowledge-context';
import type { Loadout } from '../../state/schema';
import { sheetLinkState } from '../build/sheet-navigation';
import { sheetPath } from '../build/use-build-plan';
import {
  analyzeConfig,
  checkRequiredSettings,
  firstChange,
  groupFindings,
  hasEnteredSettings,
  mainWeapon,
  type Finding,
  type RequiredSettingStatus,
} from './analysis';

/**
 * Aim changes have no value that settles them, so the player marks them done to move on. The
 * marks are the loadout's shared aim marks: Build my config's Aim settings step shows them too.
 */
function canMarkDone(finding: Finding): finding is Finding & { progressKey: string } {
  return finding.actionable && finding.progressKey !== undefined;
}

/** Shown when a group's only finding is the one in "Change this first". */
const ONLY_ONE = 'The change above is the only one here.';

function names(settings: readonly RequiredSettingStatus[]) {
  return settings.map((s) => s.name).join(', ');
}

/** "Easing, Lower": how the next change is announced. */
function describeChange(finding: Finding): string {
  return finding.direction ? `${finding.title}, ${LEVER_DIRECTION_LABELS[finding.direction]}` : finding.title;
}

function FindingValues({ finding }: { finding: Finding }) {
  const current = finding.current ?? (finding.status === 'missing' ? 'Not entered yet' : undefined);
  if (current === undefined && finding.required === undefined) return null;
  return (
    <dl className="finding-values">
      {current !== undefined && (
        <div>
          <dt>Yours</dt>
          <dd>{current}</dd>
        </div>
      )}
      {finding.required !== undefined && (
        <div>
          <dt>XIM’s list</dt>
          <dd>{finding.required}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * The main statement (its badge is in the card's head; `showCaveat` false when the card shows
 * the caveat above), then the ones that belong with it.
 */
function FindingStatements({ finding, showCaveat = true }: { finding: Finding; showCaveat?: boolean }) {
  return (
    <div className="finding-statements">
      <StatementView statement={finding.statement} showBadge={false} showCaveat={showCaveat} />
      {finding.more.map((statement, i) => (
        <StatementView key={i} statement={statement} />
      ))}
    </div>
  );
}

/**
 * What a card shows of its statement before "Why and source": its caveat, like the config
 * sheet, unless a note above the cards (`hoisted`) already has it.
 */
function StatementNotes({ statement, hoisted }: { statement: Statement; hoisted?: string }) {
  if (!statement.caveat || statement.caveat === hoisted) return null;
  return (
    <p className="finding-note">
      <strong>Caveat:</strong> {statement.caveat}
    </p>
  );
}

function TermLinks({ termIds }: { termIds: readonly string[] }) {
  if (termIds.length === 0) return null;
  return (
    <p className="finding-terms">
      <span className="finding-terms-label">Explained:</span>
      {termIds.map((id) => (
        <TermLink key={id} id={id} />
      ))}
    </p>
  );
}

interface FindingCardProps {
  finding: Finding;
  /** The prominent "Change this first" card: its statement shows in full. */
  first?: boolean;
  done?: boolean;
  /** A caveat the section shows once above its cards. */
  hoisted?: string;
  actions?: ReactNode;
}

function FindingCard({ finding, first = false, done = false, hoisted, actions }: FindingCardProps) {
  const Tag = first ? 'div' : 'li';
  return (
    <Tag className={`card finding${first ? ' tune-first' : ''}${done ? ' is-done' : ''}`}>
      <div className="finding-head">
        <h3>{finding.title}</h3>
        <span className="finding-tags">
          <ConfidenceBadge level={finding.statement.confidence} />
          {finding.direction && (
            <span className="tag tag-direction">
              <span className="visually-hidden">Direction: </span>
              {LEVER_DIRECTION_LABELS[finding.direction]}
            </span>
          )}
          {done && <StatusChip state="done" />}
        </span>
      </div>
      <FindingValues finding={finding} />
      {finding.smoothing && <p className="hint">{finding.smoothing.text}</p>}
      {first ? (
        <FindingStatements finding={finding} />
      ) : (
        <>
          <StatementNotes statement={finding.statement} hoisted={hoisted} />
          <details className="why">
            <summary>{whySummary([finding.statement, ...finding.more])}</summary>
            <FindingStatements finding={finding} showCaveat={false} />
          </details>
        </>
      )}
      <TermLinks termIds={finding.termIds} />
      {actions}
    </Tag>
  );
}

function Section({
  title,
  headingRef,
  children,
}: {
  title: string;
  /** For a heading that receives focus. */
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="tune-section" aria-labelledby={id}>
      <h2 className="section-title" id={id} ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function NothingEntered({ settingsPath }: { settingsPath: string }) {
  return (
    <EmptyState title="Nothing entered yet">
      <p>
        Dialed compares the settings you have now with the evidence. Start with your Destiny 2 settings: Dialed checks
        those first, then your MATRIX setup, then your aim settings.
      </p>
      <p>
        <Link className="button primary" to={settingsPath}>
          Enter your settings
        </Link>
      </p>
    </EmptyState>
  );
}


/** "What to change": the findings for this loadout, the first one up front, then by group. */
export function ChangesView({ loadout, settingsPath }: { loadout: Loadout; settingsPath: string }) {
  const { data, setProgress } = useData();
  const { kb } = useKnowledge();
  const [announcement, setAnnouncement] = useState('');
  const [moved, setMoved] = useState(0);
  const firstHeading = useRef<HTMLHeadingElement>(null);
  const doneButton = useRef<HTMLButtonElement>(null);

  // After "Done: show the next change", focus stays on the button while there is a next change
  // to mark; when the button is gone, it moves to the section heading rather than being lost.
  useEffect(() => {
    if (moved > 0 && !doneButton.current) firstHeading.current?.focus();
  }, [moved]);

  const config = data.configs[loadout.id];
  const { inGame } = data;
  if (!hasEnteredSettings(config, inGame)) return <NothingEntered settingsPath={settingsPath} />;

  const findings = analyzeConfig(kb, data.profile, loadout, config, inGame);
  const isDone = (f: Finding) => canMarkDone(f) && data.progress[f.progressKey] === 'done';
  const first = firstChange(findings, isDone);
  const groups = groupFindings(findings.filter((f) => f !== first));

  const required = checkRequiredSettings(kb, inGame);
  const missing = required.filter((s) => s.state === 'missing');
  const matching = required.filter((s) => s.state === 'ok');
  const unknown = required.filter((s) => s.state === 'unknown');
  // XIM's list comes with one caveat for every value, so the section says it once (the card in
  // "Change this first" sits above the section and keeps its own).
  const fixCaveat = hoistedCaveat([...groups.fix, ...unknown].map((f) => f.statement));

  const { archetype, style } = mainWeapon(kb, loadout);
  const hiddenLevers = style ? style.levers.length - leversForProfile(style.levers, data.profile).length : 0;
  const aimsWith = data.profile.aimingSources.map((s) => AIMING_SOURCE_LABELS[s].title.toLowerCase()).join(' and ');

  const configDpi = config?.matrix.configDpi ?? null;
  const mouseDpi = data.profile.mouseDpi;
  const dpiMatches = configDpi !== null && configDpi === mouseDpi;

  const markDone = (finding: Finding & { progressKey: string }, done: boolean) =>
    setProgress(finding.progressKey, done ? 'done' : null);

  const showNext = (current: Finding & { progressKey: string }) => {
    markDone(current, true);
    const next = firstChange(findings, (f) => f === current || isDone(f));
    setAnnouncement(
      next ? `Next: ${describeChange(next)}` : 'Marked done. Dialed has no other change to suggest from what you’ve entered.',
    );
    setMoved((n) => n + 1);
  };

  const cardFor = (finding: Finding, hoisted?: string) => {
    const done = isDone(finding);
    return (
      <FindingCard
        key={finding.id}
        finding={finding}
        done={done}
        hoisted={hoisted}
        actions={
          canMarkDone(finding) && (
            <div className="checklist-actions">
              <button
                type="button"
                className="button small secondary status-toggle is-done"
                aria-pressed={done}
                aria-label={`${finding.title}: done`}
                onClick={() => markDone(finding, !done)}
              >
                <StatusMark state={done ? 'done' : 'none'} />
                Done
              </button>
            </div>
          )
        }
      />
    );
  };

  return (
    <>
      <Section title="Change this first" headingRef={firstHeading}>
        <p className="visually-hidden" role="status">
          {announcement}
        </p>
        {first ? (
          <>
            <FindingCard
              finding={first}
              first
              actions={
                <div className="checklist-actions">
                  {canMarkDone(first) ? (
                    <button ref={doneButton} type="button" className="button primary" onClick={() => showNext(first)}>
                      Done: show the next change
                    </button>
                  ) : (
                    <Link className="button secondary" to={settingsPath}>
                      Update your settings
                    </Link>
                  )}
                </div>
              }
            />
            {missing.length > 0 && first.group !== 'fix' && (
              <p className="hint">
                Some Destiny 2 settings aren’t entered yet ({names(missing)}). Dialed checks those before anything else,
                so enter them in <Link to={settingsPath}>Your settings</Link>.
              </p>
            )}
          </>
        ) : (
          <p>Dialed has no other change to suggest from what you’ve entered.</p>
        )}
      </Section>

      <Section title={groups.fix.length > 0 ? 'Fix these Destiny 2 settings' : 'Destiny 2 settings'}>
        <p className="hint">Your Destiny 2 settings are shared by every loadout.</p>
        {fixCaveat && <SharedCaveatNote>{fixCaveat}</SharedCaveatNote>}
        {groups.fix.length > 0 && (
          <ul className="finding-list">{groups.fix.map((finding) => cardFor(finding, fixCaveat))}</ul>
        )}
        {matching.length > 0 && <p>Already the same as XIM’s list: {names(matching)}.</p>}
        {missing.length > 0 && (
          <p>
            Not entered yet: {names(missing)}. <Link to={settingsPath}>Enter them</Link>
          </p>
        )}
        {groups.fix.length === 0 && missing.length === 0 && matching.length === 0 && unknown.length === 0 && (
          <p className="hint">
            {first?.group === 'fix' ? ONLY_ONE : 'Dialed has no Destiny 2 settings to compare.'}
          </p>
        )}
        {unknown.length > 0 && (
          <>
            <p>Dialed can’t compare these, so check them yourself:</p>
            <ul className="finding-list">
              {unknown.map((setting) => (
                <li className="card finding" key={setting.name}>
                  <div className="finding-head">
                    <h3>{setting.name}</h3>
                    <span className="finding-tags">
                      <ConfidenceBadge level={setting.statement.confidence} />
                    </span>
                  </div>
                  <dl className="finding-values">
                    <div>
                      <dt>XIM’s list</dt>
                      <dd>{setting.required}</dd>
                    </div>
                  </dl>
                  <StatementNotes statement={setting.statement} hoisted={fixCaveat} />
                  <details className="why">
                    <summary>Why and source</summary>
                    <StatementView statement={setting.statement} showBadge={false} showCaveat={false} />
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Setup">
        {groups.setup.length > 0 && <ul className="finding-list">{groups.setup.map((finding) => cardFor(finding))}</ul>}
        {dpiMatches && <p>The DPI in your MATRIX Config matches the mouse DPI in your profile.</p>}
        {configDpi !== null && mouseDpi === null && (
          <p>
            Add your mouse DPI to your <Link to="/profile">profile</Link> so Dialed can compare it with the DPI in your
            MATRIX Config.
          </p>
        )}
        {groups.setup.length === 0 && (configDpi === null || mouseDpi !== null) && !dpiMatches && (
          <p className="hint">{first?.group === 'setup' ? ONLY_ONE : 'Nothing to flag from what you’ve entered.'}</p>
        )}
      </Section>

      <Section title={style ? `Aim settings for ${style.name.toLowerCase()}` : 'Aim settings'}>
        {archetype ? (
          <AimStyleSummary archetype={archetype} />
        ) : (
          <p className="hint">The main weapon isn’t in the knowledge base any more, so its aim style is unknown.</p>
        )}
        {groups.aim.length > 0 && <ul className="finding-list">{groups.aim.map((finding) => cardFor(finding))}</ul>}
        {hiddenLevers > 0 && (
          <p className="footnote">
            {hiddenLevers === 1 ? 'One setting' : `${hiddenLevers} settings`} for other ways of aiming{' '}
            {hiddenLevers === 1 ? 'is' : 'are'} hidden, because your profile says you aim with {aimsWith}.{' '}
            <Link to="/profile">Change this in your profile</Link>
          </p>
        )}
      </Section>

      {groups.info.length > 0 && (
        <Section title="Good to know">
          <ul className="finding-list">{groups.info.map((finding) => cardFor(finding))}</ul>
        </Section>
      )}

      <Section title="One change at a time">
        <div className="card">
          <StatementView statement={kb.guardrail} />
        </div>
      </Section>

      <ul className="related-links" aria-label="More for this loadout">
        <li>
          <Link
            to={sheetPath(loadout.id)}
            state={sheetLinkState({ to: `/tune/${encodeURIComponent(loadout.id)}/changes`, label: 'Tune my config' })}
          >
            See the config sheet
          </Link>
        </li>
        <li>
          <Link to="/troubleshoot">Troubleshoot by feel</Link>
        </li>
      </ul>

      {/* After everything, away from "Done: show the next change": the aim marks, cleared with a confirmation. */}
      <ClearAimMarks loadout={loadout} />
    </>
  );
}
