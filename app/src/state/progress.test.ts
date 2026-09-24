import { describe, expect, it } from 'vitest';
import { knowledge } from '../../../knowledge/index';
import {
  PER_CONFIG_CHECK_IDS,
  REQUIRED_SETTINGS_CHECK_ID,
  aimProgressPrefix,
  countProgress,
  derivedProblemKeys,
  derivedProblemNote,
  effectiveProgress,
  loadoutPrefix,
  progressKey,
  progressSummary,
  type ProgressContext,
} from './progress';
import { emptyConfig, emptyInGame } from './schema';

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
    expect(effectiveProgress(progress, { ...knowledge, game: { ...knowledge.game, requiredSettings: [] } })).toBe(progress);
  });
});

describe('derived problems', () => {
  const context = (patch: Partial<ProgressContext> = {}): ProgressContext => ({
    inGame: undefined,
    profile: { mouseDpi: null, pollingRate: null },
    configs: [],
    ...patch,
  });
  const adsKey = progressKey.requiredSetting('ADS Sensitivity Modifier');
  const dpiKey = progressKey.check('mouse-dpi-matches');
  const allDone = Object.fromEntries(requiredKeys.map((k) => [k, 'done' as const]));

  it('shows a Destiny 2 setting whose value differs from XIM’s as Needs fixing, even when ticked Done', () => {
    expect(knowledge.game.requiredSettings.find((s) => s.name === 'ADS Sensitivity Modifier')?.value).toBe('1.5');
    const inGame = { ...emptyInGame(), adsSensitivityModifier: 1 };
    expect(derivedProblemKeys(knowledge, context({ inGame }))).toEqual(new Set([adsKey]));
    expect(effectiveProgress({ [adsKey]: 'done' }, knowledge, context({ inGame }))[adsKey]).toBe('problem');
    expect(effectiveProgress({}, knowledge, context({ inGame }))[adsKey]).toBe('problem');
    // The same value as XIM's list, or none entered, leaves the tick alone.
    const same = { ...inGame, adsSensitivityModifier: 1.5 };
    expect(effectiveProgress({ [adsKey]: 'done' }, knowledge, context({ inGame: same }))[adsKey]).toBe('done');
    expect(effectiveProgress({ [adsKey]: 'done' }, knowledge, context({ inGame: emptyInGame() }))[adsKey]).toBe('done');
    expect(effectiveProgress({ [adsKey]: 'done' }, knowledge)[adsKey]).toBe('done');
  });

  it('makes the Destiny 2 settings check Needs fixing too, whatever it was marked', () => {
    const inGame = { ...emptyInGame(), adsSensitivityModifier: 1 };
    expect(effectiveProgress(allDone, knowledge, context({ inGame }))[checkKey]).toBe('problem');
    expect(effectiveProgress({ ...allDone, [checkKey]: 'done' }, knowledge, context({ inGame }))[checkKey]).toBe('problem');
    expect(effectiveProgress(allDone, knowledge, context({ inGame: emptyInGame() }))[checkKey]).toBe('done');
  });

  it('shows a check whose values differ in any saved Config as Needs fixing, even when ticked Done', () => {
    const matching = emptyConfig();
    matching.matrix.configDpi = 1600;
    const differing = emptyConfig();
    differing.matrix.configDpi = 800;
    const profile = { mouseDpi: 1600, pollingRate: null };
    const ticked = { [dpiKey]: 'done' as const };
    expect(effectiveProgress(ticked, knowledge, context({ profile, configs: [matching, differing] }))[dpiKey]).toBe('problem');
    expect(effectiveProgress(ticked, knowledge, context({ profile, configs: [matching] }))[dpiKey]).toBe('done');
    expect(effectiveProgress({}, knowledge, context({ configs: [differing] }))[dpiKey]).toBeUndefined();
  });

  it('words why an item shows Needs fixing', () => {
    expect(derivedProblemNote('done', 'your value differs from 1.5')).toBe('You marked this Done, but your value differs from 1.5.');
    expect(derivedProblemNote(null, 'the values above differ')).toBe('Shown as Needs fixing because the values above differ.');
    expect(derivedProblemNote(undefined, 'the values above differ')).toBe('Shown as Needs fixing because the values above differ.');
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
