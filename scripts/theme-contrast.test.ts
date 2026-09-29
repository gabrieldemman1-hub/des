/**
 * WCAG AA for the colour tokens in app/src/styles.css, in both themes: 4.5:1 for text (badges, pressed
 * toggles and notes on their tinted fills included), 3:1 for control edges, the focus ring, the
 * target lock and icons. Reads the tokens from the stylesheet, so a colour change that drops a
 * pair below AA fails here.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Read from disk: the app's test project stubs CSS imports out.
const css = readFileSync(new URL('../app/src/styles.css', import.meta.url), 'utf8');

function tokensIn(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
}

const lightStart = css.indexOf('@media (prefers-color-scheme: light)');
const lightRoot = css.indexOf(':root {', lightStart);
const dark = tokensIn(css.slice(css.indexOf(':root {'), lightStart));
const light = { ...dark, ...tokensIn(css.slice(lightRoot, css.indexOf('}', lightRoot))) };

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
/** CSS color-mix(in srgb, a p%, b). */
const mix = (a: string, b: string, p: number) => toHex(rgb(a).map((v, i) => v * p + rgb(b)[i] * (1 - p)));
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

type Pair = [label: string, fg: string, bg: string, min: number];

function pairs(t: Record<string, string>): Pair[] {
  const v = (name: string) => {
    const value = t[name];
    if (!value) throw new Error(`No ${name} in styles.css`);
    return value;
  };
  const list: Pair[] = [];
  const on = (fg: string, bgs: string[], min: number) => {
    for (const bg of bgs) list.push([`${fg} on ${bg}`, v(fg), v(bg), min]);
  };
  on('--text', ['--bg', '--surface', '--surface-2', '--surface-3'], 4.5);
  on('--text-muted', ['--bg', '--surface', '--surface-2', '--surface-3'], 4.5);
  on('--text-faint', ['--bg', '--surface', '--surface-2'], 4.5);
  on('--accent-text', ['--bg', '--surface', '--surface-2'], 4.5);
  on('--danger', ['--bg', '--surface', '--surface-2'], 4.5);
  on('--success', ['--bg', '--surface', '--surface-2'], 4.5);
  on('--on-accent', ['--accent'], 4.5);
  on('--bg', ['--text'], 4.5); // a selected segment or filter chip is inverted
  on('--input-border', ['--bg', '--surface'], 3);
  on('--focus', ['--bg', '--surface', '--surface-2'], 3);
  on('--lock', ['--bg', '--surface'], 3);
  on('--data', ['--bg', '--surface'], 3);
  for (const tone of ['--c-official', '--c-expert', '--c-contested', '--c-reasoned', '--c-gap', '--c-publisher']) {
    for (const bg of ['--bg', '--surface', '--surface-2']) {
      list.push([`${tone} badge on ${bg}`, v(tone), mix(v(tone), v(bg), 0.14), 4.5]);
    }
  }
  for (const tone of ['--success', '--danger']) {
    list.push([`pressed ${tone} toggle`, v(tone), mix(v(tone), v('--surface'), 0.2), 4.5]);
  }
  const derived = mix(v('--danger'), v('--surface-2'), 0.1);
  list.push(['--text on a derived-state note', v('--text'), derived, 4.5]);
  list.push(['--text-muted on a derived-state note', v('--text-muted'), derived, 4.5]);
  return list;
}

describe.each([
  ['dark', dark],
  ['light', light],
])('%s theme', (_, tokens) => {
  it.each(pairs(tokens))('%s', (_label, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
