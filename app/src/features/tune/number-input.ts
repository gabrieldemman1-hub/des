/**
 * Reading the numbers the player types into Your settings. The bounds come from the
 * CurrentConfig schema: they only reject nonsense, and say nothing about good values.
 */

export interface NumberRule {
  min: number;
  max: number;
  /** Whole numbers only (e.g. DPI). */
  integer?: boolean;
}

/** ok with null: the field was cleared. Not ok: the text isn't a number in range. */
export type ParsedNumber = { ok: true; value: number | null } | { ok: false; error: string };

function format(n: number): string {
  return n.toLocaleString('en-US');
}

export function rangeMessage({ min, max, integer }: NumberRule): string {
  return integer
    ? `Enter a whole number from ${format(min)} to ${format(max)}.`
    : `Enter a number from ${format(min)} to ${format(max)}.`;
}

/** Accepts a decimal point or a decimal comma ("0.13" or "0,13"). */
export function parseNumberInput(text: string, rule: NumberRule): ParsedNumber {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  const normalized = trimmed.replace(',', '.');
  const pattern = rule.integer ? /^\d+$/ : /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
  const value = Number(normalized);
  const valid =
    pattern.test(normalized) &&
    Number.isFinite(value) &&
    (!rule.integer || Number.isSafeInteger(value)) &&
    value >= rule.min &&
    value <= rule.max;
  return valid ? { ok: true, value } : { ok: false, error: rangeMessage(rule) };
}
