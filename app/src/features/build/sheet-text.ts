/**
 * The config sheet as plain text, for "Copy as text". Every recommendation keeps its
 * confidence label and caveat, and a legend at the top says once what Reasoned means; the
 * reasons and sources stay in the app.
 */
import type { Statement } from '../../../../knowledge/index';
import { CONFIDENCE_INFO, LEVER_DIRECTION_LABELS, reasonedLabel } from '../../content/labels';
import {
  checkContext,
  currentAimValue,
  currentRequiredValue,
  smoothingNote,
  type CheckContextLine,
} from '../../state/current-values';
import {
  PER_CONFIG_CHECK_IDS,
  PER_CONFIG_CHECK_NOTE,
  STATUS_TEXT,
  progressSummary,
  type ProgressMap,
} from '../../state/progress';
import type { CurrentConfig, InGameSettings, Profile } from '../../state/schema';
import { planProgress, type BuildPlan, type GuidanceItem, type GuidanceValue } from './build-plan';
import { aimStyleName, statusOf, type WeaponLine } from './format';

type ContextProfile = Pick<Profile, 'mouseDpi' | 'pollingRate'>;

export interface SheetTextInput {
  plan: BuildPlan;
  weapons: readonly WeaponLine[];
  /** The effective progress (`effectiveProgress`), which shows the values that differ as Needs fixing. */
  progress: ProgressMap;
  inGame: InGameSettings;
  config: CurrentConfig | undefined;
  profile: ContextProfile;
  termName: (termId: string) => string;
}

function label(statement: Statement): string {
  return `[${CONFIDENCE_INFO[statement.confidence].label}]`;
}

/** The caveat every one of these statements shares, if they all have the same one. */
export function sharedCaveat(statements: readonly Statement[]): string | undefined {
  const [first, ...rest] = statements;
  const caveat = first?.caveat;
  return caveat && rest.every((s) => s.caveat === caveat) ? caveat : undefined;
}

const PER_CONFIG_TAG = 'Per Config';

/** The line under a statement: its caveat (the legend at the top says what Reasoned means). */
function noteLines(statement: Statement, indent: string, { caveat = true } = {}): string[] {
  return caveat && statement.caveat ? [`${indent}Caveat: ${statement.caveat}`] : [];
}

/** Every statement the sheet prints, in order, so the legend can say once what its labels mean. */
function allStatements(plan: BuildPlan): Statement[] {
  const guidance = (item: GuidanceItem | undefined) => (item ? [...item.lead, ...item.more] : []);
  return [
    ...(plan.main ? [plan.main.mapping] : []),
    ...(plan.style ? [plan.style.favours] : []),
    ...plan.settings.map((s) => s.statement),
    ...guidance(plan.sensitivity),
    ...guidance(plan.smoothing),
    ...plan.levers.map((l) => l.lever.statement),
    ...plan.mechanics.flatMap(guidance),
  ];
}

/**
 * What [Reasoned] means, once, for the statements that carry it: worked out from XIM's
 * definitions, or (with nothing cited) Dialed's own reading. Each wording that occurs, once.
 */
function reasonedLegend(statements: readonly Statement[]): string[] {
  const labels = new Set(statements.filter((s) => s.confidence === 'reasoned').map(reasonedLabel));
  return [...labels].map((label) => `[${CONFIDENCE_INFO.reasoned.label}] means: ${label}`);
}

function statementLines(statement: Statement, indent: string): string[] {
  return [`${indent}${label(statement)} ${statement.text}`, ...noteLines(statement, `${indent}  `)];
}

/** "Linear (default)", "Your cm/360 (by feel)": the value as the sheet's big figure reads. */
export function guidanceValueText(value: GuidanceValue): string {
  return value.caption ? `${value.text} (${value.caption})` : value.text;
}

function guidanceLines(item: GuidanceItem, status: string, current: string | null): string[] {
  const head = [`- ${item.term.name}: ${guidanceValueText(item.value)}`, status, ...(current ? [`Yours: ${current}`] : [])];
  return [head.join(' · '), ...[...item.lead, ...item.more].flatMap((s) => statementLines(s, '  '))];
}

function contextText(line: CheckContextLine): string {
  return `${line.label}: ${line.value}${line.differs ? ' (differs)' : ''}`;
}

export function sheetText(input: SheetTextInput): string {
  const { plan, weapons, progress, inGame, config, profile, termName } = input;
  const { loadout, main, style } = plan;
  const lines: string[] = [];
  const status = (key: string) => STATUS_TEXT[statusOf(progress, key)];
  const smoothing = style ? smoothingNote(config?.aim) : null;

  lines.push(`${loadout.name}: config sheet (Dialed)`);
  lines.push(
    `Weapons: ${weapons.map((w) => `${w.slotName}: ${w.name}${w.isMain ? ' (main)' : ''}`).join(' · ') || 'none'}`,
  );
  lines.push(`Aim style: ${aimStyleName(main, style)}`);
  if (main) lines.push(...statementLines(main.mapping, '  '));
  if (style) {
    lines.push('What the settings should favour:');
    lines.push(...statementLines(style.favours, '  '));
  }
  lines.push(`Progress: ${progressSummary(planProgress(plan, progress))}`);
  lines.push(...reasonedLegend(allStatements(plan)));

  // Destiny 2 settings
  lines.push('', 'DESTINY 2 SETTINGS');
  const shared = sharedCaveat(plan.settings.map((s) => s.statement));
  if (shared) lines.push(`Caveat for every value here: ${shared}`);
  for (const setting of plan.settings) {
    const parts = [`- ${setting.name}: ${setting.value} ${label(setting.statement)}`, status(setting.key)];
    const current = currentRequiredValue(inGame, setting.name, setting.value);
    if (current) parts.push(`Yours: ${current.text}${current.comparison === 'differs' ? ' (differs)' : ''}`);
    lines.push(parts.join(' · '));
    lines.push(...noteLines(setting.statement, '  ', { caveat: !shared }));
  }
  if (plan.settings.length === 0) lines.push('- None in this build of the knowledge base.');

  // MATRIX setup
  lines.push('', 'MATRIX SETUP');
  if (plan.checks.some(({ check }) => PER_CONFIG_CHECK_IDS.has(check.id))) {
    lines.push(`${PER_CONFIG_TAG}: ${PER_CONFIG_CHECK_NOTE}`);
  }
  for (const { key, check } of plan.checks) {
    const parts = [`- ${check.title} ${label(check.why)}`, status(key)];
    if (PER_CONFIG_CHECK_IDS.has(check.id)) parts.push(PER_CONFIG_TAG);
    for (const line of checkContext(check.id, profile, config)) parts.push(contextText(line));
    lines.push(parts.join(' · '));
  }
  if (plan.checks.length === 0) lines.push('- None in this build of the knowledge base.');

  // Aim settings
  lines.push('', 'AIM SETTINGS');
  if (smoothing) lines.push(`Note: ${smoothing.text}`);
  if (plan.sensitivity) {
    lines.push(...guidanceLines(plan.sensitivity, status(plan.sensitivity.key), currentAimValue(config, 'sensitivity')));
  }
  if (plan.smoothing) {
    lines.push(...guidanceLines(plan.smoothing, status(plan.smoothing.key), currentAimValue(config, 'smoothing')));
  }
  for (const { key, lever } of plan.levers) {
    const current = currentAimValue(config, lever.termId);
    lines.push(
      [
        `- ${termName(lever.termId)}: ${LEVER_DIRECTION_LABELS[lever.direction]}`,
        status(key),
        ...(current ? [`Yours: ${current}`] : []),
      ].join(' · '),
    );
    lines.push(...statementLines(lever.statement, '  '));
  }
  for (const item of plan.mechanics) {
    lines.push(...guidanceLines(item, status(item.key), currentAimValue(config, item.term.id)));
  }

  lines.push('', 'The reasons and sources for every line are on this sheet in Dialed.');
  return lines.join('\n');
}
