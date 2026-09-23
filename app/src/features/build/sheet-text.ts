/**
 * The config sheet as plain text, for "Copy as text". Every recommendation keeps its
 * confidence label and caveat; the reasons and sources stay in the app.
 */
import type { Statement } from '../../../../knowledge/index';
import { CONFIDENCE_INFO, LEVER_DIRECTION_LABELS } from '../../content/labels';
import type { CurrentConfig, Profile, ProgressState } from '../../state/schema';
import { planProgress, progressText, type BuildPlan, type GuidanceItem } from './build-plan';
import { checkContext, currentAimValue, currentRequiredValue } from './current-values';
import { STATUS_TEXT, aimStyleName, statusOf, type WeaponLine } from './format';

export interface SheetTextInput {
  plan: BuildPlan;
  weapons: readonly WeaponLine[];
  progress: Readonly<Record<string, ProgressState>>;
  config: CurrentConfig | undefined;
  profile: Pick<Profile, 'mouseDpi' | 'pollingRate'>;
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

function statementLines(statement: Statement, indent: string): string[] {
  const lines = [`${indent}${label(statement)} ${statement.text}`];
  if (statement.caveat) lines.push(`${indent}  Caveat: ${statement.caveat}`);
  return lines;
}

function guidanceLines(item: GuidanceItem, status: string, current: string | null): string[] {
  const head = [`- ${item.term.name}`, status, ...(current ? [`Yours: ${current}`] : [])].join(' · ');
  return [head, ...[...item.lead, ...item.more].flatMap((s) => statementLines(s, '  '))];
}

export function sheetText({ plan, weapons, progress, config, profile, termName }: SheetTextInput): string {
  const { loadout, main, style } = plan;
  const lines: string[] = [];
  const status = (key: string) => STATUS_TEXT[statusOf(progress, key)];

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
  lines.push(`Progress: ${progressText(planProgress(plan, progress), 'steps')}`);

  // Destiny 2 settings
  lines.push('', 'DESTINY 2 SETTINGS');
  const shared = sharedCaveat(plan.settings.map((s) => s.statement));
  if (shared) lines.push(`Caveat for every value here: ${shared}`);
  for (const setting of plan.settings) {
    const parts = [`- ${setting.name}: ${setting.value} ${label(setting.statement)}`, status(setting.key)];
    const current = currentRequiredValue(config, setting.name, setting.value);
    if (current) parts.push(`Yours: ${current.text}${current.comparison === 'differs' ? ' (differs)' : ''}`);
    lines.push(parts.join(' · '));
    if (!shared && setting.statement.caveat) lines.push(`  Caveat: ${setting.statement.caveat}`);
  }
  if (plan.settings.length === 0) lines.push('- None in this build of the knowledge base.');

  // MATRIX setup
  lines.push('', 'MATRIX SETUP');
  for (const { key, check } of plan.checks) {
    const parts = [`- ${check.title}`, status(key)];
    for (const line of checkContext(check.id, profile, config)) {
      parts.push(`${line.label}: ${line.value}${line.differs ? ' (differs)' : ''}`);
    }
    lines.push(parts.join(' · '));
  }
  if (plan.checks.length === 0) lines.push('- None in this build of the knowledge base.');

  // Aim settings
  lines.push('', 'AIM SETTINGS');
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
