import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { PreferenceInput, Statement } from '../../../../knowledge/index';
import { AimStyleSummary } from '../../components/AimStyleSummary';
import { ConfidenceBadge } from '../../components/ConfidenceBadge';
import { ChecklistItem } from '../../components/ChecklistItem';
import { StatementView } from '../../components/StatementView';
import { TermLink } from '../../components/TermLink';
import {
  AIMING_SOURCE_LABELS,
  FEEL_LABELS,
  FOCUS_LABELS,
  LEVER_DIRECTION_LABELS,
  SENSITIVITY_LABELS,
  STYLE_LABELS,
} from '../../content/labels';
import { useData } from '../../state/data-context';
import { useKnowledge } from '../../state/knowledge-context';
import type { Profile } from '../../state/schema';
import {
  BUILD_STEPS,
  CHECKLIST_STEPS,
  GAME_NOTE_IDS,
  moreGameNoteIds,
  progressText,
  stepProgress,
  type BuildPlan,
  type GuidanceItem,
  type ProgressCount,
} from './build-plan';
import { checkContext, currentAimValue, currentRequiredValue, nonStandardSmoothing } from './current-values';
import { CheckContext, CurrentValue, GuidanceStatements, Label } from './parts';
import { buildPath, sheetPath, tunePath } from './use-build-plan';
import './build.css';

interface StepProps {
  plan: BuildPlan;
  count: ProgressCount;
}

function StepSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="learn-section" aria-labelledby={id}>
      <h2 className="section-title" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StepCount({ count }: { count: ProgressCount }) {
  return <p className="build-count">{progressText(count)}</p>;
}

// ---------------------------------------------------------------------------------------
// Step 1: Destiny 2 settings
// ---------------------------------------------------------------------------------------

/** A game note: its title and confidence up front, the full statement on tap. */
function GameNote({ title, statement, open = false }: { title: string; statement: Statement; open?: boolean }) {
  return (
    <details className="why card build-game-note" open={open}>
      <summary>
        <span className="build-game-note-title">
          <span>{title}</span>
          <ConfidenceBadge level={statement.confidence} />
        </span>
      </summary>
      <StatementView statement={statement} showBadge={false} />
    </details>
  );
}

export function GameSettingsStep({ plan, count }: StepProps) {
  const { kb } = useKnowledge();
  const { data } = useData();
  const config = data.configs[plan.loadout.id];
  const noteById = (id: string) => kb.game.notes.find((n) => n.id === id);
  const notes = GAME_NOTE_IDS.flatMap((id) => noteById(id) ?? []);
  const more = moreGameNoteIds(data.profile.platform).flatMap((id) => noteById(id) ?? []);

  return (
    <>
      {notes.length > 0 && (
        <StepSection title="Before you start">
          <p className="hint">Tap a note to read it, with its reasoning and sources.</p>
          <ul className="statement-list">
            {notes.map((note, i) => (
              <li key={note.id}>
                <GameNote title={note.title} statement={note.statement} open={i === 0} />
              </li>
            ))}
          </ul>
          {more.length > 0 && (
            <details className="why card">
              <summary>More about Destiny 2’s settings ({more.length})</summary>
              <ul className="statement-list">
                {more.map((note) => (
                  <li key={note.id}>
                    <GameNote title={note.title} statement={note.statement} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </StepSection>
      )}

      <StepSection title="Set these in Destiny 2">
        <p className="hint">Tick each setting once it matches.</p>
        <StepCount count={count} />
        {plan.settings.length === 0 ? (
          <p className="empty-state">Destiny 2’s required settings are missing from this build of the knowledge base.</p>
        ) : (
          <ol className="checklist">
            {plan.settings.map((setting) => {
              const current = currentRequiredValue(config, setting.name, setting.value);
              return (
                <ChecklistItem key={setting.key} itemKey={setting.key} title={`${setting.name}: ${setting.value}`}>
                  {current && (
                    <CurrentValue
                      value={current.text}
                      differs={current.comparison === 'differs'}
                      expected={setting.value}
                    />
                  )}
                  <StatementView statement={setting.statement} />
                </ChecklistItem>
              );
            })}
          </ol>
        )}
      </StepSection>
    </>
  );
}

// ---------------------------------------------------------------------------------------
// Step 2: MATRIX setup
// ---------------------------------------------------------------------------------------

export function MatrixSetupStep({ plan, count }: StepProps) {
  const { data } = useData();
  const { profile } = data;
  const config = data.configs[plan.loadout.id];

  return (
    <StepSection title="Setup checks">
      {profile.platform === null && (
        <p className="build-note" role="note">
          Your platform isn’t set, so the checks for both Xbox and PC are shown.{' '}
          <Link to="/profile">Set your platform</Link>
        </p>
      )}
      {profile.platform === 'pc' && profile.outputType === null && (
        <p className="build-note" role="note">
          Your output type isn’t set, so the checks for every PC output type are shown.{' '}
          <Link to="/profile">Set your output type</Link>
        </p>
      )}
      <p className="hint">Work through them in order, and tick each one once it checks out.</p>
      <StepCount count={count} />
      {plan.checks.length === 0 ? (
        <p className="empty-state">The setup checks are missing from this build of the knowledge base.</p>
      ) : (
        <ol className="checklist">
          {plan.checks.map(({ key, check }) => (
            <ChecklistItem key={key} itemKey={key} title={check.title}>
              <p>{check.check}</p>
              <CheckContext lines={checkContext(check.id, profile, config)} />
              <Label>Why it matters</Label>
              <StatementView statement={check.why} />
              {check.fix && (
                <details className="why">
                  <summary>How to fix it</summary>
                  <StatementView statement={check.fix} />
                </details>
              )}
              {check.termIds.length > 0 && (
                <>
                  <Label>Settings involved</Label>
                  <ul className="related-links">
                    {check.termIds.map((id) => (
                      <li key={id}>
                        <TermLink id={id} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </ChecklistItem>
          ))}
        </ol>
      )}
    </StepSection>
  );
}

// ---------------------------------------------------------------------------------------
// Step 3: Aim settings
// ---------------------------------------------------------------------------------------

function GuidanceChecklistItem({ item, title, current }: { item: GuidanceItem; title: ReactNode; current: string | null }) {
  return (
    <ChecklistItem itemKey={item.key} title={title}>
      {current && <CurrentValue value={current} />}
      <GuidanceStatements item={item} />
    </ChecklistItem>
  );
}

const PREFERENCES: { input: PreferenceInput; label: string; value: (p: Profile) => string | null }[] = [
  {
    input: 'feel',
    label: 'Snappy or smooth',
    value: (p) => (p.feel === null ? null : FEEL_LABELS[p.feel as keyof typeof FEEL_LABELS]),
  },
  {
    input: 'sensitivity',
    label: 'Sensitivity',
    value: (p) => (p.sensitivity === null ? null : SENSITIVITY_LABELS[p.sensitivity]),
  },
  { input: 'focus', label: 'Main focus', value: (p) => (p.focus === null ? null : FOCUS_LABELS[p.focus]) },
  { input: 'style', label: 'How you play', value: (p) => (p.style === null ? null : STYLE_LABELS[p.style]) },
];

/** What the knowledge base says each preference the player has set can (or can't) change. */
function PreferenceNotes({ profile }: { profile: Profile }) {
  const { kb } = useKnowledge();
  const set = PREFERENCES.flatMap((pref) => {
    const value = pref.value(profile);
    const statements = kb.game.preferences.filter((p) => p.input === pref.input).map((p) => p.statement);
    return value !== null && statements.length > 0 ? [{ ...pref, value, statements }] : [];
  });

  return (
    <StepSection title="Your preferences">
      {set.length === 0 ? (
        <p className="hint">
          Your profile has no feel or playstyle preferences yet. Set them in your <Link to="/profile">profile</Link> to
          see what the evidence says about them.
        </p>
      ) : (
        <>
          <p className="hint">What the evidence says about the preferences in your profile.</p>
          {set.map((pref) => (
            <details className="why card" key={pref.input}>
              <summary>
                {pref.label}: {pref.value}
              </summary>
              <div className="build-statements">
                {pref.statements.map((statement, i) => (
                  <StatementView key={i} statement={statement} />
                ))}
              </div>
            </details>
          ))}
        </>
      )}
    </StepSection>
  );
}

export function AimSettingsStep({ plan, count }: StepProps) {
  const { termById } = useKnowledge();
  const { data } = useData();
  const { profile } = data;
  const config = data.configs[plan.loadout.id];
  const { main, style } = plan;
  const smoothing = style ? nonStandardSmoothing(config) : null;
  const aimsWith = profile.aimingSources.map((s) => AIMING_SOURCE_LABELS[s].title.toLowerCase()).join(' and ');

  return (
    <>
      <StepSection title="Main weapon’s aim style">
        {!main && (
          <p className="build-note" role="note">
            The main weapon isn’t in the knowledge base any more, so its aim style is unknown. The general aim steps are
            still below.
          </p>
        )}
        {main && <AimStyleSummary archetype={main} />}
        {main && main.aimStyle === null && (
          <div className="card build-statements">
            <p>
              {main.name} has no aim style in Dialed’s knowledge base, so this step has no weapon-aware directions.
              Here is what the knowledge base says:
            </p>
            <StatementView statement={main.mapping} />
          </div>
        )}
        {main && main.aimStyle !== null && !style && (
          <p className="build-note" role="note">
            The directions for this aim style are missing from this build of the knowledge base.
          </p>
        )}
        {style && (
          <>
            <h3 className="build-note-title">What the settings should favour</h3>
            <div className="card">
              <StatementView statement={style.favours} />
            </div>
          </>
        )}
        {smoothing && (
          <p className="build-note" role="note">
            <strong>Your current settings for this loadout say smoothing is {smoothing}.</strong> The directions below
            assume Standard smoothing, as “What the settings should favour” explains above. Read about{' '}
            <TermLink id="smoothing-standard">Standard</TermLink> and <TermLink id="smoothing-classic">Classic</TermLink>{' '}
            smoothing.
          </p>
        )}
      </StepSection>

      <StepSection title="Work through these in Manager">
        <p className="hint">Tick each one once you’ve dealt with it in this loadout’s Config.</p>
        <StepCount count={count} />
        <ol className="checklist">
          {plan.sensitivity && (
            <GuidanceChecklistItem
              item={plan.sensitivity}
              title={
                <>
                  Start with <TermLink id="sensitivity" />
                </>
              }
              current={currentAimValue(config, 'sensitivity')}
            />
          )}
          {plan.smoothing && (
            <GuidanceChecklistItem
              item={plan.smoothing}
              title={<TermLink id="smoothing" />}
              current={currentAimValue(config, 'smoothing')}
            />
          )}
          {plan.levers.map(({ key, lever }) => {
            const current = currentAimValue(config, lever.termId);
            return (
              <ChecklistItem
                key={key}
                itemKey={key}
                title={
                  <>
                    <TermLink id={lever.termId}>{termById(lever.termId)?.name ?? lever.termId}</TermLink>:{' '}
                    <span className="build-direction">{LEVER_DIRECTION_LABELS[lever.direction]}</span>
                  </>
                }
              >
                {current && <CurrentValue value={current} />}
                <StatementView statement={lever.statement} />
              </ChecklistItem>
            );
          })}
          {plan.mechanics.map((item) => (
            <GuidanceChecklistItem
              key={item.key}
              item={item}
              title={<TermLink id={item.term.id} />}
              current={currentAimValue(config, item.term.id)}
            />
          ))}
        </ol>
        {plan.hiddenLevers > 0 && (
          <p className="footnote">
            {plan.hiddenLevers === 1 ? 'One setting' : `${plan.hiddenLevers} settings`} for other ways of aiming{' '}
            {plan.hiddenLevers === 1 ? 'is' : 'are'} hidden, because your profile says you aim with {aimsWith}.{' '}
            <Link to="/profile">Change this in your profile</Link>
          </p>
        )}
      </StepSection>

      <PreferenceNotes profile={profile} />
    </>
  );
}

// ---------------------------------------------------------------------------------------
// Step 4: Your config sheet
// ---------------------------------------------------------------------------------------

export function SheetStep({ plan }: { plan: BuildPlan }) {
  const { kb } = useKnowledge();
  const { data } = useData();
  const counts = stepProgress(plan, data.progress);
  const id = plan.loadout.id;

  return (
    <>
      <StepSection title="Where you are">
        <ul className="build-summary">
          {CHECKLIST_STEPS.map((stepId) => {
            const step = BUILD_STEPS.find((s) => s.id === stepId);
            const count = counts[stepId];
            const complete = count.total > 0 && count.done === count.total;
            return (
              <li key={stepId} className={complete ? 'is-complete' : undefined}>
                <Link to={buildPath(id, stepId)}>{step?.title ?? stepId}</Link>
                <span>{progressText(count)}</span>
              </li>
            );
          })}
        </ul>
      </StepSection>

      <StepSection title="Take it to the console">
        <p>
          The config sheet puts every value for “{plan.loadout.name}” on one screen, to keep next to you while you work
          in XIM MATRIX Manager and Destiny 2.
        </p>
        <Link className="button primary block" to={sheetPath(id)}>
          Open the config sheet
        </Link>
        <p className="hint">
          Enter what you have set now in Tune my config. The sheet then shows your current value next to each setting.
        </p>
        <Link className="button secondary block" to={tunePath(id)}>
          Enter your current settings
        </Link>
      </StepSection>

      <StepSection title="Before you change anything else">
        <div className="card">
          <StatementView statement={kb.guardrail} />
        </div>
      </StepSection>

      <StepSection title="Loading this loadout’s Config">
        <p className="hint">Each loadout has its own Config. Read how Configs are loaded and switched:</p>
        <ul className="related-links">
          {['config', 'load-config', 'navigate-mode'].map((termId) => (
            <li key={termId}>
              <TermLink id={termId} />
            </li>
          ))}
        </ul>
      </StepSection>
    </>
  );
}
