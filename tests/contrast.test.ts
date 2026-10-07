/**
 * WCAG AA for the colour tokens in src/styles/global.css, light and dark: 4.5:1 for text,
 * labels and footnote numbers on the paper they sit on, 3:1 for the focus ring and the search
 * box's edge. Reads the tokens from the stylesheet, so a colour change that breaks AA fails here.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

function tokensIn(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1]!, m[2]!]));
}

const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const light = tokensIn(css.slice(css.indexOf(':root {'), darkStart));
const dark = { ...light, ...tokensIn(css.slice(darkStart, css.indexOf('}', css.indexOf(':root {', darkStart)))) };

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

function pairs(t: Record<string, string>): [string, string, string, number][] {
  const v = (name: string) => {
    if (!t[name]) throw new Error(`No ${name} in global.css`);
    return t[name]!;
  };
  const list: [string, string, string, number][] = [];
  const text = ['--ink', '--ink-2', '--ink-3', '--cobalt', '--c-official', '--c-expert', '--c-contested', '--c-reasoned', '--c-gap'];
  // Text sits on the paper, and on the tint that marks a tapped footnote or label.
  for (const fg of text) for (const bg of ['--paper', '--cobalt-tint']) list.push([`${fg} on ${bg}`, v(fg), v(bg), 4.5]);
  list.push(['--paper on --ink (skip link)', v('--paper'), v('--ink'), 4.5]);
  list.push(['--focus on --paper', v('--focus'), v('--paper'), 3]);
  list.push(['--ink (search edge) on --paper', v('--ink'), v('--paper'), 3]);
  return list;
}

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_, tokens) => {
  it.each(pairs(tokens))('%s', (_label, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
