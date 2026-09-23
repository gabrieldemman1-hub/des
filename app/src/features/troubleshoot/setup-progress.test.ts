import { describe, expect, it } from 'vitest';
import type { FoundationCheck } from '../../../../knowledge/index';
import { CHECK_PREFIX, describeSummary, hasCheckMarks, summarizeChecks } from './setup-progress';

const check = (id: string): FoundationCheck => ({
  id,
  title: id,
  platforms: ['xbox', 'pc'],
  outputTypes: [],
  check: 'Check it.',
  why: { text: 'Because.', confidence: 'gap', citations: [] },
  termIds: [],
});

describe('setup check progress', () => {
  it('uses the shared check: prefix', () => {
    expect(CHECK_PREFIX).toBe('check:');
  });

  it('counts only the marks on the checks given', () => {
    const checks = [check('a'), check('b'), check('c')];
    const progress = { 'check:a': 'done', 'check:b': 'problem', 'check:other': 'done', 'required:x': 'done' } as const;
    expect(summarizeChecks(checks, progress)).toEqual({ total: 3, checked: 2, problems: 1 });
    expect(summarizeChecks([], progress)).toEqual({ total: 0, checked: 0, problems: 0 });
  });

  it('describes the progress, mentioning problems only when there are some', () => {
    expect(describeSummary({ total: 10, checked: 5, problems: 1 })).toBe('5 of 10 checked · 1 needs fixing');
    expect(describeSummary({ total: 10, checked: 5, problems: 2 })).toBe('5 of 10 checked · 2 need fixing');
    expect(describeSummary({ total: 8, checked: 0, problems: 0 })).toBe('0 of 8 checked');
  });

  it('knows whether any setup check is marked', () => {
    expect(hasCheckMarks({})).toBe(false);
    expect(hasCheckMarks({ 'required:look-sensitivity': 'done' })).toBe(false);
    expect(hasCheckMarks({ 'check:anything': 'problem' })).toBe(true);
  });
});
