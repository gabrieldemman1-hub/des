import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import type { Confidence, Statement } from '../../../../knowledge/index';
import { AimStyleSummary } from '../../components/AimStyleSummary';
import { ConfidenceBadge } from '../../components/ConfidenceBadge';
import { ChevronIcon } from '../../components/icons';
import { PerConfigHint, PerConfigNote } from '../../components/PerConfigNote';
import { Readout } from '../../components/Readout';
import { Screen } from '../../components/Screen';
import { Sheet as DetailSheet } from '../../components/Sheet';
import { StatementView } from '../../components/StatementView';
import { StatusChip, StatusMark, StatusToggles } from '../../components/StatusToggles';
import { TickRuler } from '../../components/TickRuler';
import { AIMING_SOURCE_LABELS, LEVER_DIRECTION_LABELS, whySummary } from '../../content/labels';
import { checkContext, currentAimValue, currentRequiredValue, smoothingNote } from '../../state/current-values';
import { useData } from '../../state/data-context';
import { useKnowledge } from '../../state/knowledge-context';
import { derivedProblemNote, STATUS_TEXT, type ProgressMap } from '../../state/progress';
import type { ProgressState } from '../../state/schema';
import { useDerivedProblemKeys, useEffectiveProgress } from '../../state/use-progress';
import { leverDefaultCaption, planProgress, type BuildPlan, type GuidanceItem } from './build-plan';
import { customSyncKeys, withCustomSync } from './custom-sync';
import { CUSTOM_SYNC_STATEMENT } from '../tune/analysis';
import { statusOf, weaponLines } from './format';
import { CheckContext, Label, LoadoutNotFound, SmoothingNote } from './parts';
import { sheetBack } from './sheet-navigation';
import { sharedCaveat, sheetText } from './sheet-text';
import { buildPath, tunePath, tuneSettingsPath, useBuildPlan } from './use-build-plan';
import './build.css';

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
 * One line of the sheet, the same shape in every section: its state, the setting's name, and
 * the value at the right in the numeric face, so the values line up down the sheet. The row
 * opens a panel with the rest: the value against the player's own, its confidence, the Done /
 * Needs fixing pair (or, when `derived`, the state worked out from their values, with why), and
 * the details passed as children.
 */
function SheetRow({
  name,
  termId,
  value,
  caption,
  valueLabel = 'Set to',
  yours,
  confidence,
  showBadge = false,
  state,
  itemKey,
  derived = false,
  derivedNote,
  children,
}: {
  name: string;
  /** The glossary term the name explains, for the "What is this?" chip. */
  termId?: string;
  value?: string;
  /** A word under the value saying how to read it, e.g. "default". */
  caption?: string;
  /** What the value is, over it in the panel: "XIM’s list", "Direction". */
  valueLabel?: string;
  /** The player's own value, shown under the name, in red when it differs. */
  yours?: { text: string; differs: boolean };
  confidence?: Confidence;
  /** Show the badge on the row too (when the section's rows don't all share one). */
  showBadge?: boolean;
  state: ProgressState | 'none';
  itemKey: string;
  derived?: boolean;
  /** Why a derived state is shown. */
  derivedNote?: ReactNode;
  children?: ReactNode;
}) {
  const nameId = useId();
  const [open, setOpen] = useState(false);
  return (
    <li className={`sheet-row is-${state}`} aria-labelledby={nameId}>
      <button type="button" className="sheet-row-button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span className={`sheet-status is-${state}`}>
          <StatusMark state={state} />
          <span className="visually-hidden">{STATUS_TEXT[state]}: </span>
        </span>
        <span className="sheet-row-text">
          <span className="sheet-name" id={nameId}>
            {name}
          </span>
          {(yours || (showBadge && confidence !== undefined)) && (
            <span className="sheet-row-meta">
              {yours && <span className={`sheet-yours${yours.differs ? ' is-differs' : ''}`}>Yours: {yours.text}</span>}
              {showBadge && confidence !== undefined && <ConfidenceBadge level={confidence} />}
            </span>
          )}
        </span>
        {value !== undefined && (
          <span className="sheet-value">
            <span className="num">{value}</span>
            {caption && <span className="sheet-value-caption">{caption}</span>}
          </span>
        )}
        <ChevronIcon />
      </button>
      <DetailSheet
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        subtitle={
          <div className="sheet-detail-head">
            {value !== undefined && (
              <div className="readouts">
                {yours && (
                  <>
                    <Readout label="Yours" value={yours.text} muted />
                    <span className="readouts-arrow" aria-hidden="true">
                      →
                    </span>
                  </>
                )}
                <Readout
                  label={valueLabel}
                  value={
                    <>
                      {value}
                      {caption && <span className="readout-caption">{caption}</span>}
                    </>
                  }
                />
              </div>
            )}
            <div className="sheet-detail-meta">
              {confidence !== undefined && <ConfidenceBadge level={confidence} />}
              {termId && <ExplainLink termId={termId} name={name} />}
            </div>
          </div>
        }
      >
        {derived ? (
          <div className="sheet-derived">
            <StatusChip state={state} />
            {derivedNote}
          </div>
        ) : (
          <StatusToggles
            itemKey={itemKey}
            state={state === 'none' ? null : state}
            describedBy={nameId}
            className="sheet-toggles"
          />
        )}
        {children}
      </DetailSheet>
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
 * The full statements, one tap away, behind "Why and source" (with a count when there are
 * several). `showBadge` false when the row already shows the badge, `showCaveat` false when the
 * row or the section shows the caveat; `badge` puts one in the summary line itself.
 */
function Why({
  summary,
  badge,
  statements,
  showBadge = true,
  showCaveat = true,
}: {
  summary?: string;
  badge?: Confidence;
  statements: readonly Statement[];
  showBadge?: boolean;
  showCaveat?: boolean;
}) {
  return (
    <details className="why">
      <summary>
        {/* The badge inside the text, so it wraps like its last word rather than beside a column of text. */}
        <span>
          {summary ?? whySummary(statements)}
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
          <StatementView key={i} statement={statement} showBadge={showBadge} showCaveat={showCaveat} />
        ))}
      </div>
    </details>
  );
}

/**
 * One layer of the sheet. When every row in it has the same confidence (the Destiny 2 values are
 * all Official), the badge is said once, beside the title, instead of on every row.
 */
function SheetSection({ title, badge, children }: { title: string; badge?: Confidence; children: ReactNode }) {
  const id = useId();
  return (
    <section className="learn-section sheet-section" aria-labelledby={id}>
      <div className="sheet-section-head">
        <h2 className="section-title" id={id}>
          {title}
        </h2>
        {badge && <ConfidenceBadge level={badge} />}
      </div>
      {children}
    </section>
  );
}

/** The one confidence all these rows share, or undefined when they differ. */
function sharedConfidence(levels: readonly Confidence[]): Confidence | undefined {
  const first = levels[0];
  return first !== undefined && levels.every((level) => level === first) ? first : undefined;
}

type Filter = 'all' | 'problem' | 'todo';

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'problem', label: 'Needs fixing' },
  { id: 'todo', label: 'To go' },
];

function shows(filter: Filter, state: ProgressState | 'none'): boolean {
  return filter === 'all' || (filter === 'problem' ? state === 'problem' : state === 'none');
}

/** Said where a filter leaves a section with no rows. */
function EmptyFilter({ filter }: { filter: Filter }) {
  return <p className="hint">{filter === 'problem' ? 'Nothing here needs fixing.' : 'Nothing left to go here.'}</p>;
}

/** A glossary setting: its value from the knowledge base, the player's own, and the guidance. */
function GuidanceRow({
  item,
  state,
  current,
  showBadge,
}: {
  item: GuidanceItem;
  state: ProgressState | 'none';
  current: string | null;
  showBadge: boolean;
}) {
  return (
    <SheetRow
      name={item.term.name}
      termId={item.term.id}
      value={item.value.text}
      caption={item.value.caption}
      confidence={item.value.confidence}
      yours={current ? { text: current, differs: false } : undefined}
      showBadge={showBadge}
      state={state}
      itemKey={item.key}
    >
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
        <span>From the public copy of XIM’s list: confirm in Manager</span>
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
  const saved = data.progress;
  const custom = customSyncKeys(plan, config);
  // A Custom-sync Config takes two of the Destiny 2 values from the game, so those rows keep the
  // player's own mark (see custom-sync.ts).
  const progress: ProgressMap = withCustomSync(useEffectiveProgress(), saved, custom);
  const derivedKeys = useDerivedProblemKeys();
  const derived = (key: string) => derivedKeys.has(key) && !custom.has(key);
  const [filter, setFilter] = useState<Filter>('all');
  const weapons = weaponLines(loadout, knowledge);
  const status = (key: string) => statusOf(progress, key);
  const termName = (id: string) => termById(id)?.name ?? id;
  const shared = sharedCaveat(plan.settings.map((s) => s.statement));
  const confirmNote = kb.game.notes.find((n) => n.id === 'confirm-in-manager');
  const smoothing = style ? smoothingNote(config?.aim) : null;
  const aimsWith = profile.aimingSources.map((s) => AIMING_SOURCE_LABELS[s].title.toLowerCase()).join(' and ');
  const textId = useId();
  const count = planProgress(plan, progress);
  const counts: Record<Filter, number> = {
    all: count.total,
    problem: count.problem,
    todo: count.total - count.done - count.problem,
  };

  const settings = plan.settings.filter((setting) => shows(filter, status(setting.key)));
  const d2Confidence = sharedConfidence(
    plan.settings.map((s) => (custom.has(s.key) ? CUSTOM_SYNC_STATEMENT : s.statement).confidence),
  );
  const setupConfidence = sharedConfidence(plan.checks.map(({ check }) => check.why.confidence));
  const checks = plan.checks.filter(({ key }) => shows(filter, status(key)));
  const aimItems = [
    ...(plan.sensitivity ? [plan.sensitivity] : []),
    ...(plan.smoothing ? [plan.smoothing] : []),
  ];
  const aimConfidence = sharedConfidence([
    ...aimItems.map((item) => item.value.confidence),
    ...plan.levers.map((item) => item.lever.statement.confidence),
    ...plan.mechanics.map((item) => item.value.confidence),
  ]);
  const visibleAim =
    aimItems.filter((item) => shows(filter, status(item.key))).length +
    plan.levers.filter(({ key }) => shows(filter, status(key))).length +
    plan.mechanics.filter(({ key }) => shows(filter, status(key))).length;

  const {
    state: copyState,
    copy,
    textRef,
  } = useCopySheet(() =>
    sheetText({ plan, weapons, progress, inGame, config, profile, termName, customSync: custom }),
  );

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
                  {w.isMain ? <span className="tag-main">{w.name}</span> : w.name}
                  {w.isMain && <span className="visually-hidden"> (Main)</span>}
                </span>
              </li>
            ))}
          </ul>
          {main ? (
            <AimStyleSummary archetype={main} />
          ) : (
            <p className="hint">The main weapon isn’t in the knowledge base any more, so its aim style is unknown.</p>
          )}
          <div className="sheet-progress">
            <TickRuler count={count} />
            <Link to={buildPath(loadout.id)}>Continue building</Link>
          </div>
        </>
      }
    >
      <div className="sheet-toolbar">
        <div className="filter-chips" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="filter-chip"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label} <span className="num">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="button-row sheet-actions">
          <button type="button" className="button secondary small" onClick={copy}>
            Copy as text
          </button>
          <Link className="button secondary small" to={tuneSettingsPath(loadout.id)}>
            Enter settings
          </Link>
        </div>
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

      <SheetSection title="Destiny 2 settings" badge={d2Confidence}>
        {shared ? (
          <SharedCaveat text={shared} note={confirmNote} />
        ) : (
          confirmNote && <Why summary={confirmNote.title} statements={[confirmNote.statement]} />
        )}
        {plan.settings.length === 0 ? (
          <p className="hint">Destiny 2’s required settings are missing from this build of the knowledge base.</p>
        ) : settings.length === 0 ? (
          <EmptyFilter filter={filter} />
        ) : (
          <ul className="sheet-rows">
            {settings.map((setting) => {
              if (custom.has(setting.key)) {
                return (
                  <SheetRow
                    key={setting.key}
                    name={setting.name}
                    value="Match Config"
                    caption="Custom sync"
                    confidence={CUSTOM_SYNC_STATEMENT.confidence}
                    showBadge={d2Confidence === undefined}
                    state={status(setting.key)}
                    itemKey={setting.key}
                  >
                    <StatementView statement={CUSTOM_SYNC_STATEMENT} showBadge={false} />
                  </SheetRow>
                );
              }
              const current = currentRequiredValue(inGame, setting.name, setting.value);
              const isDerived = derived(setting.key);
              return (
                <SheetRow
                  key={setting.key}
                  name={setting.name}
                  value={setting.value}
                  valueLabel="XIM’s list"
                  yours={current ? { text: current.text, differs: current.comparison === 'differs' } : undefined}
                  confidence={setting.statement.confidence}
                  showBadge={d2Confidence === undefined}
                  state={status(setting.key)}
                  itemKey={setting.key}
                  derived={isDerived}
                  derivedNote={
                    isDerived && (
                      <DerivedNote saved={saved[setting.key]} differs={`your value differs from ${setting.value}`} />
                    )
                  }
                >
                  {!shared && setting.statement.caveat && <Caveat text={setting.statement.caveat} />}
                  <Why statements={[setting.statement]} showBadge={false} showCaveat={false} />
                </SheetRow>
              );
            })}
          </ul>
        )}
      </SheetSection>

      <SheetSection title="MATRIX setup" badge={setupConfidence}>
        {profile.platform === null && (
          <p className="hint">Your platform isn’t set, so the checks for both Xbox and PC are listed.</p>
        )}
        <PerConfigHint checks={plan.checks.map(({ check }) => check)} />
        {plan.checks.length === 0 ? (
          <p className="hint">The setup checks are missing from this build of the knowledge base.</p>
        ) : checks.length === 0 ? (
          <EmptyFilter filter={filter} />
        ) : (
          <ul className="sheet-rows">
            {checks.map(({ key, check }) => {
              const lines = checkContext(check.id, profile, config);
              const isDerived = derived(key);
              return (
                <SheetRow
                  key={key}
                  name={check.title}
                  confidence={check.why.confidence}
                  showBadge={setupConfidence === undefined}
                  state={status(key)}
                  itemKey={key}
                  derived={isDerived}
                  derivedNote={
                    isDerived && (
                      <DerivedNote
                        saved={saved[key]}
                        differs={
                          lines.some((line) => line.differs)
                            ? 'the values below differ'
                            : 'another loadout’s Config differs'
                        }
                      />
                    )
                  }
                >
                  <PerConfigNote checkId={check.id} />
                  <CheckContext lines={lines} />
                  <p>{check.check}</p>
                  <details className="why">
                    <summary>
                      <span>Why it matters{check.fix ? ', and how to fix it' : ''}</span>
                    </summary>
                    <div className="build-statements">
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

      <SheetSection title="Aim settings" badge={aimConfidence}>
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
        {visibleAim === 0 ? (
          <EmptyFilter filter={filter} />
        ) : (
          <ul className="sheet-rows">
            {aimItems
              .filter((item) => shows(filter, status(item.key)))
              .map((item) => (
                <GuidanceRow
                  key={item.key}
                  item={item}
                  state={status(item.key)}
                  current={currentAimValue(config, item === plan.sensitivity ? 'sensitivity' : 'smoothing')}
                  showBadge={aimConfidence === undefined}
                />
              ))}
            {plan.levers
              .filter(({ key }) => shows(filter, status(key)))
              .map((item) => {
                const { key, lever, guidance } = item;
                const current = currentAimValue(config, lever.termId);
                return (
                  <SheetRow
                    key={key}
                    name={termName(lever.termId)}
                    termId={lever.termId}
                    value={LEVER_DIRECTION_LABELS[lever.direction]}
                    caption={leverDefaultCaption(item)}
                    valueLabel="Direction"
                    yours={current ? { text: current, differs: false } : undefined}
                    confidence={lever.statement.confidence}
                    showBadge={aimConfidence === undefined}
                    state={status(key)}
                    itemKey={key}
                  >
                    {lever.statement.caveat && <Caveat text={lever.statement.caveat} />}
                    <Why statements={[lever.statement]} showBadge={false} showCaveat={false} />
                    {/* XIM's own guidance on the setting, which this row carries in place of a row of its own. */}
                    {guidance && (
                      <Why
                        summary={`Guidance on ${guidance.term.name} (${guidance.lead.length + guidance.more.length})`}
                        statements={[...guidance.lead, ...guidance.more]}
                      />
                    )}
                  </SheetRow>
                );
              })}
            {plan.mechanics
              .filter(({ key }) => shows(filter, status(key)))
              .map((item) => (
                <GuidanceRow
                  key={item.key}
                  item={item}
                  state={status(item.key)}
                  current={currentAimValue(config, item.term.id)}
                  showBadge={aimConfidence === undefined}
                />
              ))}
          </ul>
        )}
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
            <Link to={tunePath(loadout.id)}>Tune this loadout</Link>
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
