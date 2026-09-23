import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { Confidence, Statement } from '../../../../knowledge/index';
import { AimStyleSummary } from '../../components/AimStyleSummary';
import { ConfidenceBadge } from '../../components/ConfidenceBadge';
import { Screen } from '../../components/Screen';
import { StatementView } from '../../components/StatementView';
import { TermLink } from '../../components/TermLink';
import { AIMING_SOURCE_LABELS, LEVER_DIRECTION_LABELS } from '../../content/labels';
import { useData } from '../../state/data-context';
import { useKnowledge } from '../../state/knowledge-context';
import type { ProgressState } from '../../state/schema';
import { planProgress, progressText, type BuildPlan, type GuidanceItem } from './build-plan';
import { checkContext, currentAimValue, currentRequiredValue, nonStandardSmoothing } from './current-values';
import { STATUS_TEXT, statusOf, weaponLines } from './format';
import { CheckContext, CurrentValue, Label, LoadoutNotFound } from './parts';
import { sharedCaveat, sheetText } from './sheet-text';
import { buildPath, tunePath, useBuildPlan } from './use-build-plan';
import './build.css';

function StatusChip({ state }: { state: ProgressState | 'none' }) {
  return (
    <span className={`sheet-status is-${state}`}>
      <span className="sheet-status-mark" aria-hidden="true" />
      {STATUS_TEXT[state]}
    </span>
  );
}

/** One line of the sheet: the setting's name, its value, confidence and state, then details. */
function SheetRow({
  name,
  value,
  confidence,
  state,
  children,
}: {
  name: ReactNode;
  value?: ReactNode;
  confidence?: Confidence;
  state?: ProgressState | 'none';
  children?: ReactNode;
}) {
  const nameId = useId();
  return (
    <li className="sheet-row" aria-labelledby={nameId}>
      <div className="sheet-row-head">
        <span className="sheet-name" id={nameId}>
          {name}
        </span>
        {value !== undefined && <span className="sheet-value">{value}</span>}
      </div>
      {(confidence !== undefined || state !== undefined) && (
        <div className="sheet-meta">
          {confidence !== undefined && <ConfidenceBadge level={confidence} />}
          {state !== undefined && <StatusChip state={state} />}
        </div>
      )}
      {children}
    </li>
  );
}

function Caveat({ text }: { text: string }) {
  return (
    <p className="sheet-caveat">
      <strong>Caveat:</strong> {text}
    </p>
  );
}

/** A statement's text, badge and caveat, for scanning; the reasoning and sources are one tap away. */
function StatementLine({ statement }: { statement: Statement }) {
  return (
    <div className="sheet-statement">
      <p>
        <ConfidenceBadge level={statement.confidence} /> {statement.text}
      </p>
      {statement.caveat && <Caveat text={statement.caveat} />}
    </div>
  );
}

/** The full statements, one tap away. `showBadge` false when the row already shows the badge. */
function Why({
  summary = 'Reasons and sources',
  statements,
  showBadge = true,
}: {
  summary?: string;
  statements: readonly Statement[];
  showBadge?: boolean;
}) {
  return (
    <details className="why">
      <summary>{summary}</summary>
      <div className="build-statements">
        {statements.map((statement, i) => (
          <StatementView key={i} statement={statement} showBadge={showBadge} />
        ))}
      </div>
    </details>
  );
}

function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="learn-section sheet-section" aria-labelledby={id}>
      <h2 className="section-title" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function GuidanceRow({
  item,
  name,
  state,
  current,
}: {
  item: GuidanceItem;
  name: ReactNode;
  state: ProgressState | 'none';
  current: string | null;
}) {
  return (
    <SheetRow name={name} state={state}>
      {item.lead.map((statement, i) => (
        <StatementLine key={i} statement={statement} />
      ))}
      {current && <CurrentValue value={current} />}
      <Why statements={[...item.lead, ...item.more]} />
    </SheetRow>
  );
}

type CopyState = { kind: 'idle' } | { kind: 'copied' } | { kind: 'manual'; text: string };

/** "Copy as text": the clipboard when the browser allows it, else a selected text box. */
function useCopySheet(makeText: () => string) {
  const [state, setState] = useState<CopyState>({ kind: 'idle' });
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.kind !== 'manual') return;
    textRef.current?.focus();
    textRef.current?.select();
  }, [state]);

  const copy = () => {
    const text = makeText();
    // A new state object each time, so a second failed copy selects the text again.
    const manual = () => setState({ kind: 'manual', text });
    // Missing over plain http (e.g. the dev server opened on a phone), so check first.
    const clipboard = (navigator as Partial<Navigator>).clipboard;
    if (!clipboard || typeof clipboard.writeText !== 'function') {
      manual();
      return;
    }
    try {
      clipboard.writeText(text).then(() => setState({ kind: 'copied' }), manual);
    } catch {
      manual();
    }
  };

  return { state, copy, textRef };
}

function Sheet({ plan }: { plan: BuildPlan }) {
  const knowledge = useKnowledge();
  const { kb, termById } = knowledge;
  const { data } = useData();
  const { profile, progress } = data;
  const { loadout, main, style } = plan;
  const config = data.configs[loadout.id];
  const weapons = weaponLines(loadout, knowledge);
  const status = (key: string) => statusOf(progress, key);
  const termName = (id: string) => termById(id)?.name ?? id;
  const shared = sharedCaveat(plan.settings.map((s) => s.statement));
  const confirmNote = kb.game.notes.find((n) => n.id === 'confirm-in-manager');
  const smoothing = style ? nonStandardSmoothing(config) : null;
  const aimsWith = profile.aimingSources.map((s) => AIMING_SOURCE_LABELS[s].title.toLowerCase()).join(' and ');
  const textId = useId();

  const { state: copyState, copy, textRef } = useCopySheet(() =>
    sheetText({ plan, weapons, progress, config, profile, termName }),
  );

  return (
    <Screen
      title={loadout.name}
      documentTitle={`${loadout.name} config sheet`}
      back={{ to: '/loadouts', label: 'Loadouts' }}
      intro={
        <>
          <p className="eyebrow">Config sheet</p>
          <ul className="slot-list" aria-label="Weapons">
            {weapons.map((w) => (
              <li key={w.slot}>
                <span className="slot-name">{w.slotName}</span>
                <span className="slot-weapon">
                  {w.name}
                  {w.isMain && <span className="tag tag-main">Main</span>}
                </span>
              </li>
            ))}
          </ul>
          {main ? (
            <AimStyleSummary archetype={main} />
          ) : (
            <p className="hint">The main weapon isn’t in the knowledge base any more, so its aim style is unknown.</p>
          )}
          <p className="build-count">{progressText(planProgress(plan, progress), 'steps')}</p>
        </>
      }
    >
      <div className="button-row sheet-actions">
        <button type="button" className="button primary" onClick={copy}>
          Copy as text
        </button>
        <Link className="button secondary" to={buildPath(loadout.id)}>
          Continue building
        </Link>
        <Link className="button secondary" to={tunePath(loadout.id)}>
          Enter current settings
        </Link>
      </div>
      <p className="sheet-copy-status" role="status">
        {copyState.kind === 'copied' && 'Copied the sheet as text.'}
        {copyState.kind === 'manual' &&
          'Couldn’t copy automatically, so the text is below, selected. Use your phone’s Copy command.'}
      </p>
      {copyState.kind === 'manual' && (
        <div className="field">
          <label htmlFor={textId}>The sheet as text</label>
          <textarea id={textId} ref={textRef} className="sheet-text" readOnly rows={12} value={copyState.text} />
        </div>
      )}

      <SheetSection title="Destiny 2 settings">
        {shared && <Caveat text={shared} />}
        {confirmNote && <Why summary={confirmNote.title} statements={[confirmNote.statement]} />}
        {plan.settings.length === 0 ? (
          <p className="hint">Destiny 2’s required settings are missing from this build of the knowledge base.</p>
        ) : (
          <ul className="sheet-rows">
            {plan.settings.map((setting) => {
              const current = currentRequiredValue(config, setting.name, setting.value);
              return (
                <SheetRow
                  key={setting.key}
                  name={setting.name}
                  value={setting.value}
                  confidence={setting.statement.confidence}
                  state={status(setting.key)}
                >
                  {current && (
                    <CurrentValue
                      value={current.text}
                      differs={current.comparison === 'differs'}
                      expected={setting.value}
                    />
                  )}
                  {!shared && setting.statement.caveat && <Caveat text={setting.statement.caveat} />}
                  <Why summary="Why and source" statements={[setting.statement]} showBadge={false} />
                </SheetRow>
              );
            })}
          </ul>
        )}
      </SheetSection>

      <SheetSection title="MATRIX setup">
        {profile.platform === null && (
          <p className="hint">Your platform isn’t set, so the checks for both Xbox and PC are listed.</p>
        )}
        {plan.checks.length === 0 ? (
          <p className="hint">The setup checks are missing from this build of the knowledge base.</p>
        ) : (
          <ul className="sheet-rows">
            {plan.checks.map(({ key, check }) => (
              <SheetRow key={key} name={check.title} confidence={check.why.confidence} state={status(key)}>
                <CheckContext lines={checkContext(check.id, profile, config)} />
                <details className="why">
                  <summary>What to check, and why</summary>
                  <div className="build-statements">
                    <p>{check.check}</p>
                    <Label>Why it matters</Label>
                    <StatementView statement={check.why} />
                    {check.fix && (
                      <>
                        <Label>How to fix it</Label>
                        <StatementView statement={check.fix} />
                      </>
                    )}
                  </div>
                </details>
              </SheetRow>
            ))}
          </ul>
        )}
      </SheetSection>

      <SheetSection title="Aim settings">
        {style && (
          <div className="sheet-favours">
            <ConfidenceBadge level={style.favours.confidence} />
            <Why
              summary={`What ${style.name.toLowerCase()} settings should favour`}
              statements={[style.favours]}
              showBadge={false}
            />
          </div>
        )}
        {main && main.aimStyle === null && (
          <p className="hint">
            {main.name} has no aim style in Dialed’s knowledge base, so this sheet has no weapon-aware directions (see
            why, above).
          </p>
        )}
        {smoothing && (
          <p className="build-note" role="note">
            <strong>Your current settings say smoothing is {smoothing}.</strong> The directions below assume Standard
            smoothing: see what {style?.name.toLowerCase()} settings should favour, above.
          </p>
        )}
        <ul className="sheet-rows">
          {plan.sensitivity && (
            <GuidanceRow
              item={plan.sensitivity}
              name={<TermLink id="sensitivity" />}
              state={status(plan.sensitivity.key)}
              current={currentAimValue(config, 'sensitivity')}
            />
          )}
          {plan.smoothing && (
            <GuidanceRow
              item={plan.smoothing}
              name={<TermLink id="smoothing" />}
              state={status(plan.smoothing.key)}
              current={currentAimValue(config, 'smoothing')}
            />
          )}
          {plan.levers.map(({ key, lever }) => {
            const current = currentAimValue(config, lever.termId);
            return (
              <SheetRow
                key={key}
                name={<TermLink id={lever.termId}>{termName(lever.termId)}</TermLink>}
                value={LEVER_DIRECTION_LABELS[lever.direction]}
                confidence={lever.statement.confidence}
                state={status(key)}
              >
                {current && <CurrentValue value={current} />}
                {lever.statement.caveat && <Caveat text={lever.statement.caveat} />}
                <Why statements={[lever.statement]} showBadge={false} />
              </SheetRow>
            );
          })}
          {plan.mechanics.map((item) => (
            <GuidanceRow
              key={item.key}
              item={item}
              name={<TermLink id={item.term.id} />}
              state={status(item.key)}
              current={currentAimValue(config, item.term.id)}
            />
          ))}
        </ul>
        {plan.hiddenLevers > 0 && (
          <p className="footnote">
            {plan.hiddenLevers === 1 ? 'One setting' : `${plan.hiddenLevers} settings`} for other ways of aiming{' '}
            {plan.hiddenLevers === 1 ? 'is' : 'are'} left out, because your profile says you aim with {aimsWith}.
          </p>
        )}
      </SheetSection>
    </Screen>
  );
}

/** A loadout's config sheet: every value across the layers, to keep next to the console. */
export function ConfigSheetScreen() {
  const { loadoutId } = useParams();
  const plan = useBuildPlan(loadoutId);
  if (!plan) {
    return (
      <LoadoutNotFound back={{ to: '/loadouts', label: 'Loadouts' }} link={{ to: '/loadouts', label: 'See your loadouts' }} />
    );
  }
  return <Sheet key={plan.loadout.id} plan={plan} />;
}
