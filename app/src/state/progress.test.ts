import { describe, expect, it } from 'vitest';
import { knowledge } from '../../../knowledge/index';
import {
  PER_CONFIG_CHECK_IDS,
  REQUIRED_SETTINGS_CHECK_ID,
  aimProgressPrefix,
  countProgress,
  effectiveProgress,
  loadoutPrefix,
  progressKey,
  progressSummary,
} from './progress';

const requiredKeys = knowledge.game.requiredSettings.map((s) => progressKey.requiredSetting(s.name));
const checkKey = progressKey.check(REQUIRED_SETTINGS_CHECK_ID);

describe('progress keys', () => {
  it('keeps every aim item of a loadout under one prefix, inside the loadout’s', () => {
    expect(aimProgressPrefix('l1')).toBe('loadout:l1:aim:');
    expect(aimProgressPrefix('l1').startsWith(loadoutPrefix('l1'))).toBe(true);
    expect(progressKey.aim.sensitivity('l1')).toBe('loadout:l1:aim:sensitivity');
    expect(progressKey.aim.smoothing('l1')).toBe('loadout:l1:aim:smoothing');
    expect(progressKey.aim.term('l1', 'aiming-curve')).toBe('loadout:l1:aim:term:aiming-curve');
    expect(progressKey.aim.lever('l1', 'snap', 'easing')).toBe('loadout:l1:aim:lever:snap:easing');
  });

  it('names real setup checks', () => {
    const ids = new Set(knowledge.foundation.map((c) => c.id));
    expect(ids.has(REQUIRED_SETTINGS_CHECK_ID)).toBe(true);
    for (const id of PER_CONFIG_CHECK_IDS) expect(ids.has(id), id).toBe(true);
  });
});

describe('effectiveProgress', () => {
  it('works out the Destiny 2 settings check from the six required settings', () => {
    expect(requiredKeys).toHaveLength(6);
    const allDone = Object.fromEntries(requiredKeys.map((k) => [k, 'done' as const]));
    expect(effectiveProgress(allDone, knowledge)[checkKey]).toBe('done');

    // Not all six: unset.
    const five = { ...allDone };
    delete five[requiredKeys[0]!];
    expect(effectiveProgress(five, knowledge)[checkKey]).toBeUndefined();
    expect(effectiveProgress({}, knowledge)[checkKey]).toBeUndefined();

    // Any one needs fixing: needs fixing, even with others unmarked.
    expect(effectiveProgress({ [requiredKeys[2]!]: 'problem' }, knowledge)[checkKey]).toBe('problem');
    expect(effectiveProgress({ ...allDone, [requiredKeys[5]!]: 'problem' }, knowledge)[checkKey]).toBe('problem');
  });

  it('keeps a mark the player set themselves', () => {
    const allDone = Object.fromEntries(requiredKeys.map((k) => [k, 'done' as const]));
    expect(effectiveProgress({ ...allDone, [checkKey]: 'problem' }, knowledge)[checkKey]).toBe('problem');
    expect(effectiveProgress({ [requiredKeys[0]!]: 'problem', [checkKey]: 'done' }, knowledge)[checkKey]).toBe('done');
  });

  it('leaves the saved marks alone', () => {
    const progress = Object.fromEntries(requiredKeys.map((k) => [k, 'done' as const]));
    effectiveProgress(progress, knowledge);
    expect(progress).not.toHaveProperty(checkKey);
    expect(effectiveProgress(progress, { game: { ...knowledge.game, requiredSettings: [] } })).toBe(progress);
  });
});

describe('progress summaries', () => {
  it('counts done and needs-fixing items among the keys given', () => {
    expect(countProgress(['a', 'b', 'c'], { a: 'done', b: 'problem', other: 'done' })).toEqual({
      total: 3,
      done: 1,
      problem: 1,
    });
  });

  it('reads “X of Y done · N need(s) fixing”', () => {
    expect(progressSummary({ total: 10, done: 5, problem: 0 })).toBe('5 of 10 done');
    expect(progressSummary({ total: 10, done: 5, problem: 1 })).toBe('5 of 10 done · 1 needs fixing');
    expect(progressSummary({ total: 10, done: 5, problem: 2 })).toBe('5 of 10 done · 2 need fixing');
    expect(progressSummary({ total: 20, done: 3, problem: 0 }, 'items')).toBe('3 of 20 items done');
  });
});
