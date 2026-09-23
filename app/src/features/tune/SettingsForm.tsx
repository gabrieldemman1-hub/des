import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { SegmentedField } from '../../components/SegmentedField';
import { TermLink } from '../../components/TermLink';
import { useData, type ConfigPatch, type SaveState } from '../../state/data-context';
import { useKnowledge } from '../../state/knowledge-context';
import { inGameFieldName, type InGameField } from '../../state/required-settings';
import { emptyConfig, type CurrentConfig, type InGameSettings, type Loadout } from '../../state/schema';
import { CHOICE_LABELS } from './analysis';
import { parseNumberInput, type NumberRule } from './number-input';

/**
 * A field's hint, followed by a link to the setting's explanation in Explain a concept when
 * the glossary has the term. Undefined when there is neither.
 */
function useHint(text: ReactNode | undefined, termId: string | undefined): ReactNode | undefined {
  const { termById } = useKnowledge();
  const term = termId === undefined ? undefined : termById(termId);
  if (text === undefined && term === undefined) return undefined;
  return (
    <>
      {text}
      {text !== undefined && term ? ' ' : null}
      {term && <TermLink id={term.id}>{`About ${term.name}`}</TermLink>}
    </>
  );
}

/**
 * Field names as the knowledge base spells them: a glossary term's name, or a Destiny 2
 * required setting's name. The fallback only shows if the knowledge base lacks the entry.
 */
function useNames() {
  const { kb, termById } = useKnowledge();
  return {
    term: (id: string, fallback: string) => termById(id)?.name ?? fallback,
    inGame: (field: InGameField, fallback: string) => inGameFieldName(kb, field) ?? fallback,
  };
}

interface ChoiceFieldProps<T extends string> {
  legend: string;
  hint?: ReactNode;
  termId?: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}

/** A SegmentedField whose hint links to the setting's explanation. */
function ChoiceField<T extends string>({ hint, termId, ...props }: ChoiceFieldProps<T>) {
  return <SegmentedField {...props} hint={useHint(hint, termId)} />;
}

interface NumberFieldProps {
  label: string;
  value: number | null;
  rule: NumberRule;
  onSave: (value: number | null) => void;
  hint?: ReactNode;
  termId?: string;
  placeholder?: string;
}

/**
 * A number the player types. It keeps its own text, so a half-typed or invalid value stays on
 * screen with an error and isn't saved. A valid value (or a cleared field) saves at once.
 */
function NumberField({ label, value, rule, onSave, hint, termId, placeholder }: NumberFieldProps) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const parsed = parseNumberInput(text, rule);
  const ids = { input: useId(), hint: useId(), error: useId() };
  const fullHint = useHint(hint, termId);
  const describedBy = [fullHint !== undefined ? ids.hint : null, parsed.ok ? null : ids.error].filter((id) => id !== null).join(' ');

  return (
    <div className="field">
      <label htmlFor={ids.input}>{label}</label>
      {fullHint !== undefined && (
        <p className="hint" id={ids.hint}>
          {fullHint}
        </p>
      )}
      <input
        id={ids.input}
        type="text"
        inputMode={rule.integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next = parseNumberInput(e.target.value, rule);
          if (next.ok) onSave(next.value);
        }}
        aria-invalid={!parsed.ok}
        aria-describedby={describedBy || undefined}
      />
      {!parsed.ok && (
        <p className="error" id={ids.error}>
          {parsed.error}
        </p>
      )}
    </div>
  );
}

/** Bounds from the CurrentConfig schema: they reject nonsense, and say nothing about good values. */
const RULES = {
  lookSensitivity: { min: 0, max: 1000 },
  percent: { min: 0, max: 100 },
  dpi: { min: 1, max: 1_000_000, integer: true },
  cm360: { min: 0, max: 10_000 },
  classic: { min: 0, max: 1000 },
  yScale: { min: 0, max: 1000 },
} as const satisfies Record<string, NumberRule>;

const CHOICE_OPTIONS = [
  { value: 'default', label: CHOICE_LABELS.default },
  { value: 'other', label: CHOICE_LABELS.other },
] as const;

const SYNC_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'custom', label: 'Custom' },
  { value: 'manual', label: 'Manual' },
] as const;

const YES_NO = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
] as const;

const OFF_ON = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
] as const;

const INHERITANCE_OPTIONS = [
  { value: 'inherit-all', label: 'Inherit All' },
  { value: 'sensitivity-only', label: 'Sensitivity Only' },
  { value: 'inherit-nothing', label: 'Inherit Nothing' },
] as const;

const SMOOTHING_OPTIONS = [
  { value: 'preset', label: 'Preset' },
  { value: 'standard', label: 'Custom Standard' },
  { value: 'classic', label: 'Custom Classic' },
  { value: 'off', label: 'Off' },
] as const;

const CURVE_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'custom', label: 'Custom' },
] as const;

const VELOCITY_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'other', label: 'Other' },
] as const;

function yesNo(value: boolean | null): 'yes' | 'no' | null {
  return value === null ? null : value ? 'yes' : 'no';
}

function onOff(value: boolean | null): 'on' | 'off' | null {
  return value === null ? null : value ? 'on' : 'off';
}

interface SectionProps {
  title: string;
  hint: string;
  termId?: string;
  children: ReactNode;
}

function Section({ title, hint, termId, children }: SectionProps) {
  const id = useId();
  return (
    <section className="form-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p className="hint">{useHint(hint, termId)}</p>
      {children}
    </section>
  );
}

function InGameSection({ values, save }: { values: InGameSettings; save: (patch: Partial<InGameSettings>) => void }) {
  const name = useNames();
  return (
    <Section
      title="Destiny 2 settings"
      hint="Copy these from Destiny 2’s own settings. Dialed keeps one set of these for all your loadouts, so what you enter here shows for every loadout."
      termId="required-game-settings"
    >
      <ChoiceField
        legend={name.inGame('movementControls', 'Movement Controls')}
        options={CHOICE_OPTIONS}
        value={values.movementControls}
        onChange={(movementControls) => save({ movementControls })}
      />
      <ChoiceField
        legend={name.inGame('buttonLayout', 'Button Layout')}
        options={CHOICE_OPTIONS}
        value={values.buttonLayout}
        onChange={(buttonLayout) => save({ buttonLayout })}
      />
      <NumberField
        label={name.inGame('lookSensitivity', 'Look Sensitivity')}
        value={values.lookSensitivity}
        rule={RULES.lookSensitivity}
        onSave={(lookSensitivity) => save({ lookSensitivity })}
      />
      <NumberField
        label={name.inGame('adsSensitivityModifier', 'ADS Sensitivity Modifier')}
        value={values.adsSensitivityModifier}
        rule={RULES.percent}
        onSave={(adsSensitivityModifier) => save({ adsSensitivityModifier })}
      />
      <NumberField
        label={name.inGame('axialDeadzone', 'Axial Deadzone')}
        value={values.axialDeadzone}
        rule={RULES.percent}
        termId="deadzone"
        onSave={(axialDeadzone) => save({ axialDeadzone })}
      />
      <NumberField
        label={name.inGame('radialDeadzone', 'Radial Deadzone')}
        value={values.radialDeadzone}
        rule={RULES.percent}
        termId="deadzone"
        onSave={(radialDeadzone) => save({ radialDeadzone })}
      />
    </Section>
  );
}

function MatrixSection({ config, save }: { config: CurrentConfig['matrix']; save: (patch: ConfigPatch['matrix']) => void }) {
  const { data } = useData();
  const name = useNames();
  const mouseDpi = data.profile.mouseDpi;
  return (
    <Section title="MATRIX setup" hint="From XIM MATRIX Manager, for the Config you use with this loadout.">
      <NumberField
        label={`${name.term('mouse-dpi', 'Mouse DPI')} in your Config`}
        value={config.configDpi}
        rule={RULES.dpi}
        placeholder="e.g. 1600"
        termId="mouse-dpi"
        hint={
          mouseDpi === null ? (
            <>
              Add your mouse DPI to your <Link to="/profile">profile</Link> so Dialed can compare the two.
            </>
          ) : (
            `Your profile says your mouse is set to ${mouseDpi} DPI.`
          )
        }
        onSave={(configDpi) => save({ configDpi })}
      />
      <ChoiceField
        legend={name.term('game-settings-sync', 'Game Settings')}
        hint="The sync method your Config uses."
        termId="game-settings-sync"
        options={SYNC_OPTIONS}
        value={config.syncMethod}
        onChange={(syncMethod) => save({ syncMethod })}
      />
      <ChoiceField
        legend="Smart Translator warning"
        hint="Does Manager warn that this Config’s Smart Translator is out of date?"
        termId="smart-translation"
        options={YES_NO}
        value={yesNo(config.translatorWarning)}
        onChange={(value) => save({ translatorWarning: value === 'yes' })}
      />
    </Section>
  );
}

function AimSection({ config, save }: { config: CurrentConfig['aim']; save: (patch: ConfigPatch['aim']) => void }) {
  const presetId = useId();
  const name = useNames();
  const sensitivity = name.term('sensitivity', 'Sensitivity');
  return (
    <Section title="Aim settings" hint="From this Config’s aim settings in Manager.">
      <NumberField
        label={`Hip ${sensitivity} (cm/360)`}
        value={config.hipSensitivity}
        rule={RULES.cm360}
        termId="sensitivity"
        onSave={(hipSensitivity) => save({ hipSensitivity })}
      />
      <NumberField
        label={`ADS ${sensitivity} (cm/360)`}
        value={config.adsSensitivity}
        rule={RULES.cm360}
        termId="sensitivity"
        onSave={(adsSensitivity) => save({ adsSensitivity })}
      />
      <ChoiceField
        legend={name.term('ads-inheritance', 'Aim Settings Inheritance')}
        termId="ads-inheritance"
        options={INHERITANCE_OPTIONS}
        value={config.adsInheritance}
        onChange={(adsInheritance) => save({ adsInheritance })}
      />

      <ChoiceField
        legend={name.term('smoothing', 'Smoothing')}
        hint="A preset, or your own Standard or Classic values."
        termId="smoothing"
        options={SMOOTHING_OPTIONS}
        value={config.smoothing}
        onChange={(smoothing) => save({ smoothing })}
      />
      {config.smoothing === 'preset' && (
        <div className="tune-subfields">
          <div className="field">
            <label htmlFor={presetId}>Preset name</label>
            <input
              id={presetId}
              type="text"
              autoComplete="off"
              maxLength={40}
              value={config.presetName}
              onChange={(e) => save({ presetName: e.target.value })}
            />
          </div>
        </div>
      )}
      {config.smoothing === 'standard' && (
        <div className="tune-subfields">
          <NumberField
            label={name.term('precision', 'Precision')}
            value={config.precision}
            rule={RULES.percent}
            termId="precision"
            onSave={(precision) => save({ precision })}
          />
          <NumberField
            label={name.term('response', 'Response')}
            value={config.response}
            rule={RULES.percent}
            termId="response"
            onSave={(response) => save({ response })}
          />
          <NumberField
            label={name.term('easing', 'Easing')}
            value={config.easing}
            rule={RULES.percent}
            termId="easing"
            onSave={(easing) => save({ easing })}
          />
        </div>
      )}
      {config.smoothing === 'classic' && (
        <div className="tune-subfields">
          <NumberField
            label={name.term('smooth', 'Smooth')}
            value={config.smooth}
            rule={RULES.classic}
            termId="smooth"
            onSave={(smooth) => save({ smooth })}
          />
          <NumberField
            label={name.term('decay', 'Decay')}
            value={config.decay}
            rule={RULES.classic}
            termId="decay"
            onSave={(decay) => save({ decay })}
          />
          <NumberField
            label={name.term('synch', 'Synch')}
            value={config.synch}
            rule={RULES.classic}
            termId="synch"
            onSave={(synch) => save({ synch })}
          />
        </div>
      )}

      <ChoiceField
        legend={name.term('aiming-curve', 'Aiming Curve')}
        termId="aiming-curve"
        options={CURVE_OPTIONS}
        value={config.aimingCurve}
        onChange={(aimingCurve) => save({ aimingCurve })}
      />
      <NumberField
        label={name.term('y-scale', 'Y Scale')}
        value={config.yScale}
        rule={RULES.yScale}
        termId="y-scale"
        onSave={(yScale) => save({ yScale })}
      />

      <ChoiceField
        legend={name.term('quantization', 'Quantization')}
        termId="quantization"
        options={OFF_ON}
        value={onOff(config.quantization)}
        onChange={(value) => save({ quantization: value === 'on' })}
      />
      {config.quantization === true && (
        <div className="tune-subfields">
          <NumberField
            label={name.term('quantization-magnitude', 'Magnitude Quantization')}
            value={config.quantizationMagnitude}
            rule={RULES.percent}
            termId="quantization-magnitude"
            onSave={(quantizationMagnitude) => save({ quantizationMagnitude })}
          />
          <NumberField
            label={name.term('quantization-angle', 'Angle Quantization')}
            value={config.quantizationAngle}
            rule={RULES.percent}
            termId="quantization-angle"
            onSave={(quantizationAngle) => save({ quantizationAngle })}
          />
        </div>
      )}

      <ChoiceField
        legend={name.term('velocity-mapping', 'Velocity Mapping')}
        termId="velocity-mapping"
        options={VELOCITY_OPTIONS}
        value={config.velocityMapping}
        onChange={(velocityMapping) => save({ velocityMapping })}
      />
    </Section>
  );
}

function SettingsFields({ loadoutId }: { loadoutId: string }) {
  const { data, updateConfig, updateInGame } = useData();
  const config = data.configs[loadoutId] ?? emptyConfig();
  return (
    <>
      <InGameSection values={data.inGame} save={updateInGame} />
      <MatrixSection config={config.matrix} save={(matrix) => updateConfig(loadoutId, { matrix })} />
      <AimSection config={config.aim} save={(aim) => updateConfig(loadoutId, { aim })} />
    </>
  );
}

const SAVE_STATUS: Record<SaveState, string> = {
  idle: 'Changes save automatically on this phone.',
  saved: 'Saved on this phone.',
  failed: 'Not saved on this phone. Download a backup from your profile to keep a copy.',
};

/** "Your settings": the loadout's current settings, as the player sees them in the game and in Manager. */
export function SettingsForm({ loadout, changesPath }: { loadout: Loadout; changesPath: string }) {
  const { saveState, revision } = useData();
  return (
    <>
      <p>
        Enter what you have now, as Destiny 2 and XIM MATRIX Manager show it. Leave out anything you’re not sure of:
        Dialed works with whatever you fill in. It all stays on this phone; nothing is sent anywhere.
      </p>
      <p className={saveState === 'failed' ? 'save-status is-failed' : 'save-status'} aria-live="polite">
        {SAVE_STATUS[saveState]}
      </p>
      <form className="form" onSubmit={(e) => e.preventDefault()} aria-label={`Your settings for ${loadout.name}`}>
        {/* Remounted when the data is replaced (a restore, another tab) so the typed text starts again from it. */}
        <SettingsFields key={`${loadout.id}:${revision}`} loadoutId={loadout.id} />
      </form>
      <Link className="button primary block" to={changesPath}>
        See what to change
      </Link>
    </>
  );
}
