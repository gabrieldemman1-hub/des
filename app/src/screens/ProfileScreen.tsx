import { useId, useState, type ChangeEvent } from 'react';
import { AIMING_SOURCES, OUTPUT_TYPES_BY_PLATFORM, type AimingSource, type Platform } from '../../../knowledge/index';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Screen } from '../components/Screen';
import { SegmentedField } from '../components/SegmentedField';
import { StatementView } from '../components/StatementView';
import {
  AIMING_SOURCE_LABELS,
  FEEL_LABELS,
  FOCUS_LABELS,
  OUTPUT_TYPE_LABELS,
  PLATFORM_LABELS,
  SENSITIVITY_LABELS,
  STYLE_LABELS,
} from '../content/labels';
import { useData, type SaveState } from '../state/data-context';
import { useKnowledge } from '../state/knowledge-context';
import { hasConfigValues } from '../state/current-values';
import { hasInGameValues } from '../state/required-settings';
import { MAX_MOUSE_MODEL_LENGTH, POLLING_RATES, type AppData, type PollingRate } from '../state/schema';
import { backupFileName, createBackup, parseBackup } from '../state/storage';

function options<K extends string>(labels: Record<K, string>) {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}

const FEEL_OPTIONS = ([1, 2, 3, 4, 5] as const).map((value) => ({ value, label: FEEL_LABELS[value] }));

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A positive whole number, or null for an empty field; undefined when the text is invalid. */
function parseDpi(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value > 0 && Number.isSafeInteger(value) ? value : undefined;
}

/** The guide page each platform's controller-output setup is on. */
const OUTPUT_GUIDE_PAGE: Record<Platform, string> = {
  xbox: 'guide.xim.tech/Gaming-On-Xbox/',
  pc: 'guide.xim.tech/Gaming-On-PC-Output-C/',
};

function OutputTypeField() {
  const { data, updateProfile } = useData();
  const { termById } = useKnowledge();
  const { platform, outputType } = data.profile;
  const ids = { label: useId(), hint: useId() };
  // What each output needs, from the glossary's sourced Output type statements for this platform.
  const needs =
    platform === null
      ? []
      : (termById('output-type')?.explanation ?? []).filter((statement) =>
          statement.citations.some((c) => c.url.includes(OUTPUT_GUIDE_PAGE[platform])),
        );

  return (
    <fieldset className="field" aria-labelledby={ids.label} aria-describedby={ids.hint}>
      <legend id={ids.label}>Output type</legend>
      <p className="hint" id={ids.hint}>
        Controller output only; PC mouse-and-keyboard output is out of scope.
      </p>
      {platform === null && <p className="fixed-value">Pick a platform first.</p>}
      {platform === 'xbox' && (
        <p className="fixed-value">
          {OUTPUT_TYPE_LABELS['xbox-controller'].title} <span className="tag">Fixed</span>
        </p>
      )}
      {platform === 'pc' && (
        <div className="choice-list">
          {OUTPUT_TYPES_BY_PLATFORM.pc.map((type) => (
            <label className="choice" key={type}>
              <input
                type="radio"
                name={`${ids.label}-output`}
                value={type}
                checked={outputType === type}
                onChange={() => updateProfile({ outputType: type })}
              />
              <span className="choice-text">
                <span className="choice-title">{OUTPUT_TYPE_LABELS[type].title}</span>
                <span className="choice-sub">{OUTPUT_TYPE_LABELS[type].sub}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {needs.length > 0 && (
        <details className="why">
          <summary>What each output needs</summary>
          {needs.map((statement) => (
            <StatementView key={statement.text} statement={statement} />
          ))}
        </details>
      )}
    </fieldset>
  );
}

function AimingSourcesField() {
  const { data, updateProfile } = useData();
  const selected = data.profile.aimingSources;
  const hintId = useId();

  const toggle = (source: AimingSource, on: boolean) => {
    const next = on ? [...selected, source] : selected.filter((s) => s !== source);
    // Keep the order of AIMING_SOURCES, and at least one source.
    if (next.length > 0) updateProfile({ aimingSources: AIMING_SOURCES.filter((s) => next.includes(s)) });
  };

  return (
    <fieldset className="field" aria-describedby={hintId}>
      <legend>What you aim with</legend>
      <p className="hint" id={hintId}>
        Pick every aiming source your Configs use. Advice that only applies to gyro aim, such as Stability, shows only if
        you pick Gyro.
      </p>
      <div className="choice-list">
        {AIMING_SOURCES.map((source) => {
          const checked = selected.includes(source);
          const last = checked && selected.length === 1;
          return (
            <label className={`choice${last ? ' is-disabled' : ''}`} key={source}>
              <input
                type="checkbox"
                value={source}
                checked={checked}
                disabled={last}
                onChange={(e) => toggle(source, e.target.checked)}
              />
              <span className="choice-text">
                <span className="choice-title">{AIMING_SOURCE_LABELS[source].title}</span>
                <span className="choice-sub">{AIMING_SOURCE_LABELS[source].sub}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ProfileFields() {
  const { data, updateProfile } = useData();
  const profile = data.profile;
  const [dpiText, setDpiText] = useState(profile.mouseDpi === null ? '' : String(profile.mouseDpi));
  const dpiValue = parseDpi(dpiText);
  const ids = { model: useId(), dpi: useId(), dpiHint: useId(), dpiError: useId(), rate: useId(), rateHint: useId() };

  const onDpiChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setDpiText(text);
    const value = parseDpi(text);
    if (value !== undefined) updateProfile({ mouseDpi: value });
  };

  return (
    <>
      <section className="form-section" aria-labelledby="profile-hardware">
        <h2 id="profile-hardware">Platform and hardware</h2>

        <SegmentedField
          legend="Platform"
          hint="Decides which setup steps apply, such as the Xbox authentication controller or tool conflicts on PC."
          options={options(PLATFORM_LABELS)}
          value={profile.platform}
          onChange={(platform) => updateProfile({ platform })}
        />

        <OutputTypeField />

        <AimingSourcesField />

        <div className="field">
          <label htmlFor={ids.model}>Mouse model</label>
          <input
            id={ids.model}
            type="text"
            autoComplete="off"
            maxLength={MAX_MOUSE_MODEL_LENGTH}
            placeholder="Make and model"
            value={profile.mouseModel}
            onChange={(e) => updateProfile({ mouseModel: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor={ids.dpi}>Mouse DPI</label>
          <p className="hint" id={ids.dpiHint}>
            The DPI your mouse is set to. The DPI in your Config must match it.
          </p>
          <input
            id={ids.dpi}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 1600"
            value={dpiText}
            onChange={onDpiChange}
            aria-invalid={dpiValue === undefined}
            aria-describedby={dpiValue === undefined ? `${ids.dpiHint} ${ids.dpiError}` : ids.dpiHint}
          />
          {dpiValue === undefined && (
            <p className="error" id={ids.dpiError}>
              Enter a whole number above 0.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={ids.rate}>Mouse polling rate</label>
          <p className="hint" id={ids.rateHint}>
            What your mouse is set to report. Manager’s Check Rate tool shows what it actually reaches.
          </p>
          <select
            id={ids.rate}
            aria-describedby={ids.rateHint}
            value={profile.pollingRate === null ? '' : String(profile.pollingRate)}
            onChange={(e) =>
              updateProfile({ pollingRate: e.target.value === '' ? null : (Number(e.target.value) as PollingRate) })
            }
          >
            <option value="">Not set</option>
            {POLLING_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate.toLocaleString('en-US')} Hz
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="form-section" aria-labelledby="profile-playstyle">
        <h2 id="profile-playstyle">Playstyle</h2>
        <SegmentedField
          legend="Main focus"
          options={options(FOCUS_LABELS)}
          value={profile.focus}
          onChange={(focus) => updateProfile({ focus })}
        />
        <SegmentedField
          legend="How you play"
          hint="Deliberate means careful, patient play. It isn’t the Precision setting."
          options={options(STYLE_LABELS)}
          value={profile.style}
          onChange={(style) => updateProfile({ style })}
        />
      </section>

      <section className="form-section" aria-labelledby="profile-feel">
        <h2 id="profile-feel">Feel preferences</h2>
        <p className="hint">Where the evidence supports a range, these pick the point within it.</p>
        <SegmentedField
          legend="Snappy or smooth"
          hint="How you like your aim to feel. This isn’t the Smooth or Smoothing setting."
          options={FEEL_OPTIONS}
          value={profile.feel as keyof typeof FEEL_LABELS | null}
          onChange={(feel) => updateProfile({ feel })}
        />
        <SegmentedField
          legend="Sensitivity"
          hint="How fast you like to aim. Faster means a lower cm/360."
          options={options(SENSITIVITY_LABELS)}
          value={profile.sensitivity}
          onChange={(sensitivity) => updateProfile({ sensitivity })}
        />
      </section>
    </>
  );
}

interface PendingRestore {
  data: AppData;
  exportedAt: string;
}

/** Current settings entered in Tune my config: Destiny 2's, or any loadout's Config. */
function hasCurrentSettings(data: AppData): boolean {
  return hasInGameValues(data.inGame) || Object.values(data.configs).some(hasConfigValues);
}

function hasMarks(data: AppData): boolean {
  return Object.keys(data.progress).length > 0;
}

/** What a restore would do, including what it would clear that the backup doesn't have. */
function RestoreSummary({ backup, current }: { backup: PendingRestore; current: AppData }) {
  const { data } = backup;
  const marks = Object.keys(data.progress).length;
  const has = [
    plural(data.loadouts.length, 'loadout'),
    hasCurrentSettings(data) ? 'current settings' : 'no current settings',
    marks === 0 ? 'no checklist marks' : plural(marks, 'checklist mark'),
  ];
  // What the phone has and the backup doesn't: restoring clears it (e.g. a version 1 backup,
  // made before Dialed kept current settings and marks).
  const lost = [
    hasCurrentSettings(current) && !hasCurrentSettings(data) ? 'current settings' : null,
    hasMarks(current) && !hasMarks(data) ? 'checklist marks' : null,
  ].filter((part) => part !== null);

  return (
    <>
      <p>
        The backup from {formatDate(backup.exportedAt)} has {has[0]}, {has[1]} and {has[2]}. It will replace the
        profile, {plural(current.loadouts.length, 'loadout')}, current settings and checklist marks on this phone. This
        can’t be undone.
      </p>
      {lost.length > 0 && (
        <p>
          <strong>
            This backup has no {lost.join(' or ')}, so restoring it clears the {lost.join(' and ')} on this phone.
          </strong>
        </p>
      )}
    </>
  );
}

function BackupSection() {
  const { data, replaceData } = useData();
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'done'; text: string } | null>(null);
  const restoreId = useId();

  const download = () => {
    const blob = new Blob([createBackup(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName();
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ kind: 'done', text: 'Backup downloaded.' });
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // so picking the same file again still triggers a change
    if (!file) return;
    setMessage(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMessage({ kind: 'error', text: 'That file couldn’t be read.' });
      return;
    }
    const result = parseBackup(text);
    if (result.ok) setPending({ data: result.data, exportedAt: result.exportedAt });
    else setMessage({ kind: 'error', text: result.error });
  };

  const confirmRestore = () => {
    if (!pending) return;
    replaceData(pending.data);
    setPending(null);
    setMessage({ kind: 'done', text: 'Backup restored.' });
  };

  return (
    <section className="form-section" aria-labelledby="profile-backup">
      <h2 id="profile-backup">Backup</h2>
      <p className="hint">
        Your profile, loadouts, current settings and checklist marks are saved only on this phone. Download a backup to
        keep a copy or move them to another device.
      </p>
      <div className="button-row">
        <button type="button" className="button secondary" onClick={download}>
          Download backup
        </button>
        <label className="button secondary file-button" htmlFor={restoreId}>
          Restore from backup
          <input
            id={restoreId}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={(e) => void onFile(e)}
          />
        </label>
      </div>
      <div aria-live="polite">
        {message && <p className={message.kind === 'error' ? 'error' : 'success'}>{message.text}</p>}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Replace your data with this backup?"
        confirmLabel="Replace"
        danger
        onConfirm={confirmRestore}
        onCancel={() => setPending(null)}
      >
        {pending && <RestoreSummary backup={pending} current={data} />}
      </ConfirmDialog>
    </section>
  );
}

const SAVE_STATUS: Record<SaveState, string> = {
  idle: 'Changes save automatically on this phone.',
  saved: 'Saved on this phone.',
  failed: 'Not saved on this phone. Download a backup to keep a copy.',
};

export function ProfileScreen() {
  const { saveState, revision } = useData();

  return (
    <Screen
      title="Profile"
      intro={<p className="lede">Dialed tailors its advice to these. Change them any time.</p>}
    >
      <p className={saveState === 'failed' ? 'save-status is-failed' : 'save-status'} aria-live="polite">
        {SAVE_STATUS[saveState]}
      </p>
      <form className="form" onSubmit={(e) => e.preventDefault()} aria-label="Profile">
        {/* Remounted when the data is replaced (a restore, another tab) so the DPI text starts again from it. */}
        <ProfileFields key={revision} />
      </form>
      <BackupSection />
    </Screen>
  );
}
