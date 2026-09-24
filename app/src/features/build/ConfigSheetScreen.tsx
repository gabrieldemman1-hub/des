import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import type { Confidence, Statement } from '../../../../knowledge/index';
import { AimStyleSummary } from '../../components/AimStyleSummary';
import { ConfidenceBadge } from '../../components/ConfidenceBadge';
import { PerConfigNote } from '../../components/PerConfigNote';
import { Screen } from '../../components/Screen';
import { StatementView } from '../../components/StatementView';
import { AIMING_SOURCE_LABELS, LEVER_DIRECTION_LABELS, reasonedLabel } from '../../content/labels';
import { checkContext, currentAimValue, currentRequiredValue, smoothingNote } from '../../state/current-values';
import { useData } from '../../state/data-context';
import { useKnowledge } from '../../state/knowledge-context';
import { derivedProblemNote, progressSummary } from '../../state/progress';
import type { ProgressState } from '../../state/schema';
import { useDerivedProblemKeys, useEffectiveProgress } from '../../state/use-progress';
import { planProgress, type BuildPlan, type GuidanceItem } from './build-plan';
import { STATUS_TEXT, statusOf, weaponLines } from './format';
import { CheckContext, CurrentValue, Label, LoadoutNotFound, SmoothingNote } from './parts';
import { sheetBack } from './sheet-navigation';
import { sharedCaveat, sheetText } from './sheet-text';
import { buildPath, tunePath, tuneSettingsPath, useBuildPlan } from './use-build-plan';
import './build.css';

/** A state worked out from the player's values (see `derivedProblemKeys`), so it can't be changed here. */
function StatusChip({ state }: { state: ProgressState | 'none' }) {
  return (
    <span className={`sheet-status is-${state}`}>
      <span className="sheet-status-mark" aria-hidden="true" />
      {STATUS_TEXT[state]}
    </span>
  );
}

const TOGGLE_STATES: readonly ProgressState[] = ['done', 'problem'];

/**
 * The same "Done" and "Needs fixing" pair as every checklist (see ChecklistItem), bound to the
 * row's progress key, which Build my config, Tune my config and Troubleshoot by feel share.
 * Tapping the active one again clears it.
 */
function StatusToggles({ itemKey, state, nameId }: { itemKey: string; state: ProgressState | 'none'; nameId: string }) {
  const { data, setProgress } = useData();
  const saved = data.progress[itemKey] ?? null;
  return (
    <div className="checklist-actions sheet-toggles" role="group" aria-label="Status">
      {TOGGLE_STATES.map((s) => (
        <button
          key={s}
          type="button"
          className={`button small ${state === s ? 'primary' : 'secondary'}`}
          aria-pressed={state === s}
          aria-describedby={nameId}
          onClick={() => setProgress(itemKey, saved === s ? null : s)}
        >
          {STATUS_TEXT[s]}
        </button>
      ))}
    </div>
  );
}

/** "What is this?": the setting's explanation in Explain a concept, as a chip beside the name. */
function ExplainLink({ termId, name }: { termId: string; name: string }) {
  const { termById } = useKnowledge();
  if (!termById(termId)) return null;
  return (
    <Link className="sheet-explain" to={`/learn/${termId}`}>
      <span className="tag">
        What is this?<span className="visually-hidden"> ({name})</span>
      </span>
    </Link>
  );
}

/**
 * One line of the sheet, the same shape in every section: the setting's name and its value,
 * then its confidence and state, then details. The state is the player's to change, unless
 * `derived` (worked out from their values, so shown, with a note saying why).
 */
function SheetRow({
  name,
  termId,
  value,
  caption,
  confidence,
  state,
  itemKey,
  derived = false,
  children,
}: {
  name: string;
  /** The glossary term the name explains, for the "What is this?" chip. */
  termId?: string;
  value?: string;
  /** A word under the value saying how to read it, e.g. "default". */
  caption?: string;
  confidence?: Confidence;
  state: ProgressState | 'none';
  itemKey: string;
  derived?: boolean;
  children?: ReactNode;
}) {
  const nameId = useId();
  return (
    <li className="sheet-row" aria-labelledby={nameId}>
      <div className="sheet-row-head">
        <span className="sheet-title">
          <span className="sheet-name" id={nameId}>
            {name}
          </span>
          {termId && <ExplainLink termId={termId} name={name} />}
        </span>
        {value !== undefined && (
          <span className="sheet-value">
            {value}
            {caption && <span className="sheet-value-caption">{caption}</span>}
          </span>
        )}
      </div>
      <div className="sheet-meta">
        {confidence !== undefined && <ConfidenceBadge level={confidence} />}
        {derived ? <StatusChip state={state} /> : <StatusToggles itemKey={itemKey} state={state} nameId={nameId} />}
      </div>
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

/** Why a derived row says Needs fixing: the tick it overrides, if any, and what differs. */
function DerivedNote({ saved, differs }: { saved: ProgressState | undefined; differs: string }) {
  return <p className="sheet-caveat">{derivedProblemNote(saved, differs)}</p>;
}

/**
 * The full statements, one tap away. `showBadge` false when the row already shows the badge;
 * `badge` puts one in the summary line itself.
 */
function Why({
  summary = 'Reasons and sources',
  badge,
  statements,
  showBadge = true,
}: {
  summary?: string;
  badge?: Confidence;
  statements: readonly Statement[];
  showBadge?: boolean;
}) {
  return (
    <details className="why">
      <summary>
        {/* The badge inside the text, so it wraps like its last word rather than beside a column of text. */}
        <span>
          {summary}
          {badge && (
            <>
              {' '}
              <ConfidenceBadge level={badge} />
            </>
          )}
        </span>
      </summary>
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

/** A glossary setting: its value from the knowledge base, the player's own, and the guidance. */
function GuidanceRow({
  item,
  state,
  current,
}: {
  item: GuidanceItem;
  state: ProgressState | 'none';
  current: string | null;
}) {
  return (
    <SheetRow
      name={item.term.name}
      termId={item.term.id}
      value={item.value.text}
      caption={item.value.caption}
      confidence={item.value.confidence}
      state={state}
      itemKey={item.key}
    >
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

/** The Destiny 2 rows' shared caveat, one line at a glance and in full on tap, with how to confirm. */
function SharedCaveat({ text, note }: { text: string; note: { title: string; statement: Statement } | undefined }) {
  return (
    <details className="why">
      <summary>
        <span>From the public copy of XIM’s list — confirm in Manager</span>
      </summary>
      <div className="build-statements">
        <Caveat text={text} />
        {note && (
          <>
            <Label>{note.title}</Label>
            <StatementView statement={note.statement} />
          </>
        )}
      </div>
    </details>
  );
}

function Sheet({ plan }: { plan: BuildPlan }) {
  const knowledge = useKnowledge();
  const { kb, termById } = knowledge;
  const { data } = useData();
  const location = useLocation();
  const { profile, inGame } = data;
  const { loadout, main, style } = plan;
  const config = data.configs[loadout.id];
  const progress = useEffectiveProgress();
  const derived = useDerivedProblemKeys();
  const saved = data.progress;
  const weapons = weaponLines(loadout, knowledge);
  const status = (key: string) => statusOf(progress, key);
  const termName = (id: string) => termById(id)?.name ?? id;
  const shared = sharedCaveat(plan.settings.map((s) => s.statement));
  const confirmNote = kb.game.notes.find((n) => n.id === 'confirm-in-manager');
  const smoothing = style ? smoothingNote(config?.aim) : null;
  const aimsWith = profile.aimingSources.map((s) => AIMING_SOURCE_LABELS[s].title.toLowerCase()).join(' and ');
  const textId = useId();

  const {
    state: copyState,
    copy,
    textRef,
  } = useCopySheet(() => sheetText({ plan, weapons, progress, inGame, config, profile, termName }));

  return (
    <Screen
      title={loadout.name}
      documentTitle={`${loadout.name} config sheet`}
      back={sheetBack(location.state)}
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
          <p className="sheet-progress">
            <span className="build-count">{progressSummary(planProgress(plan, progress), 'items')}</span>
            <Link to={buildPath(loadout.id)}>Continue building</Link>
          </p>
        </>
      }
    >
      <div className="button-row sheet-actions">
        <button type="button" className="button secondary small" onClick={copy}>
          Copy as text
        </button>
        <Link className="button secondary small" to={tuneSettingsPath(loadout.id)}>
          Enter settings
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
        {shared ? (
          <SharedCaveat text={shared} note={confirmNote} />
        ) : (
          confirmNote && <Why summary={confirmNote.title} statements={[confirmNote.statement]} />
        )}
        {plan.settings.length === 0 ? (
          <p className="hint">Destiny 2’s required settings are missing from this build of the knowledge base.</p>
        ) : (
          <ul className="sheet-rows">
            {plan.settings.map((setting) => {
              const current = currentRequiredValue(inGame, setting.name, setting.value);
              return (
                <SheetRow
                  key={setting.key}
                  name={setting.name}
                  value={setting.value}
                  confidence={setting.statement.confidence}
                  state={status(setting.key)}
                  itemKey={setting.key}
                  derived={derived.has(setting.key)}
                >
                  {current && (
                    <CurrentValue
                      value={current.text}
                      differs={current.comparison === 'differs'}
                      expected={setting.value}
                    />
                  )}
                  {derived.has(setting.key) && (
                    <DerivedNote saved={saved[setting.key]} differs={`your value differs from ${setting.value}`} />
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
            {plan.checks.map(({ key, check }) => {
              const lines = checkContext(check.id, profile, config);
              return (
                <SheetRow
                  key={key}
                  name={check.title}
                  confidence={check.why.confidence}
                  state={status(key)}
                  itemKey={key}
                  derived={derived.has(key)}
                >
                  <PerConfigNote checkId={check.id} />
                  <CheckContext lines={lines} />
                  {derived.has(key) && (
                    <DerivedNote
                      saved={saved[key]}
                      differs={
                        lines.some((line) => line.differs)
                          ? 'the values above differ'
                          : 'another loadout’s Config differs'
                      }
                    />
                  )}
                  <details className="why">
                    <summary>
                      <span>What to check, and why</span>
                    </summary>
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
              );
            })}
          </ul>
        )}
      </SheetSection>

      <SheetSection title="Aim settings">
        {style && (
          <Why
            summary={`What ${style.name.toLowerCase()} settings should favour`}
            badge={style.favours.confidence}
            statements={[style.favours]}
            showBadge={false}
          />
        )}
        {main && main.aimStyle === null && (
          <p className="hint">
            {main.name} has no aim style in Dialed’s knowledge base, so this sheet has no weapon-aware directions (see
            why, above).
          </p>
        )}
        {smoothing && <SmoothingNote text={smoothing.text} />}
        <ul className="sheet-rows">
          {plan.sensitivity && (
            <GuidanceRow
              item={plan.sensitivity}
              state={status(plan.sensitivity.key)}
              current={currentAimValue(config, 'sensitivity')}
            />
          )}
          {plan.smoothing && (
            <GuidanceRow
              item={plan.smoothing}
              state={status(plan.smoothing.key)}
              current={currentAimValue(config, 'smoothing')}
            />
          )}
          {plan.levers.map(({ key, lever }) => {
            const current = currentAimValue(config, lever.termId);
            return (
              <SheetRow
                key={key}
                name={termName(lever.termId)}
                termId={lever.termId}
                value={LEVER_DIRECTION_LABELS[lever.direction]}
                confidence={lever.statement.confidence}
                state={status(key)}
                itemKey={key}
              >
                {current && <CurrentValue value={current} />}
                {lever.statement.confidence === 'reasoned' && (
                  <p className="sheet-caveat">{reasonedLabel(lever.statement)}</p>
                )}
                {lever.statement.caveat && <Caveat text={lever.statement.caveat} />}
                <Why statements={[lever.statement]} showBadge={false} />
              </SheetRow>
            );
          })}
          {plan.mechanics.map((item) => (
            <GuidanceRow
              key={item.key}
              item={item}
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

      {/* After the last row, like the build steps' pager: pick the build up, or go on from here. */}
      <div className="sheet-end">
        <Link className="button primary" to={buildPath(loadout.id)}>
          Continue building
        </Link>
        <ul className="related-links" aria-label="More for this loadout">
          <li>
            <Link to={tunePath(loadout.id)}>Tune this config</Link>
          </li>
          <li>
            <Link to="/troubleshoot">Troubleshoot by feel</Link>
          </li>
          <li>
            <Link to="/loadouts">All loadouts</Link>
          </li>
        </ul>
      </div>
    </Screen>
  );
}

/** A loadout's config sheet: every value across the layers, to keep next to the console. */
export function ConfigSheetScreen() {
  const { loadoutId } = useParams();
  const plan = useBuildPlan(loadoutId);
  if (!plan) {
    return (
      <LoadoutNotFound
        back={{ to: '/loadouts', label: 'Loadouts' }}
        link={{ to: '/loadouts', label: 'See your loadouts' }}
      />
    );
  }
  return <Sheet key={plan.loadout.id} plan={plan} />;
}
