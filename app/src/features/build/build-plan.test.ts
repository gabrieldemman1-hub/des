import { describe, expect, it } from 'vitest';
import { knowledge } from '../../../../knowledge/index';
import { EASING_CAVEAT } from '../../../../knowledge/integrity';
import { createKnowledgeApi } from '../../state/knowledge-context';
import { progressKey } from '../../state/progress';
import { defaultProfile, emptyConfig, type Profile } from '../../state/schema';
import { sampleLoadout } from '../../test/fixtures';
import { buildPlan, planProgress, progressText, resumeStep, stepKeys } from './build-plan';
import { checkContext, currentAimValue, currentRequiredValue, nonStandardSmoothing } from './current-values';
import { weaponLines } from './format';
import { sharedCaveat, sheetText } from './sheet-text';

const real = createKnowledgeApi(knowledge);

function profile(patch: Partial<Profile> = {}): Profile {
  return { ...defaultProfile(), ...patch };
}

describe('buildPlan', () => {
  it('lists every required Destiny 2 setting under its shared progress key', () => {
    const plan = buildPlan(real, profile(), sampleLoadout());
    expect(plan.settings.map((s) => [s.name, s.value])).toEqual(
      knowledge.game.requiredSettings.map((s) => [s.name, s.value]),
    );
    expect(plan.settings.map((s) => s.key)).toContain(progressKey.requiredSetting('Look Sensitivity'));
  });

  it('keeps the setup checks for the profile’s platform', () => {
    const ids = (p: Profile) => buildPlan(real, p, sampleLoadout()).checks.map((c) => c.check.id);
    expect(ids(profile({ platform: 'xbox', outputType: 'xbox-controller' }))).toContain('xbox-authentication-controller');
    expect(ids(profile({ platform: 'xbox', outputType: 'xbox-controller' }))).not.toContain('pc-virtual-controller-tools');
    expect(ids(profile({ platform: 'pc', outputType: 'pc-xinput' }))).not.toContain('xbox-authentication-controller');
    expect(ids(profile())).toHaveLength(knowledge.foundation.length);
  });

  it('gives a pulse rifle the tracking levers and a hand cannon the snap levers', () => {
    const pulse = buildPlan(real, profile(), sampleLoadout());
    expect(pulse.style?.id).toBe('tracking');
    expect(pulse.levers.map((l) => [l.lever.termId, l.lever.direction])).toContainEqual(['precision', 'raise']);

    const cannon = buildPlan(
      real,
      profile(),
      sampleLoadout({ weapons: { kinetic: 'hand-cannon', energy: null, power: null } }),
    );
    expect(cannon.style?.id).toBe('snap');
    const easing = cannon.levers.find((l) => l.lever.termId === 'easing');
    expect(easing?.lever.direction).toBe('lower');
    expect(easing?.lever.statement.caveat).toContain(EASING_CAVEAT);
  });

  it('drops gyro-only levers for a mouse player and counts them', () => {
    const scout = sampleLoadout({ weapons: { kinetic: 'scout-rifle', energy: null, power: null } });
    const mouse = buildPlan(real, profile({ aimingSources: ['mouse'] }), scout);
    const gyro = buildPlan(real, profile({ aimingSources: ['mouse', 'gyro'] }), scout);
    expect(mouse.levers.map((l) => l.lever.termId)).not.toContain('stability');
    expect(mouse.hiddenLevers).toBe(1);
    expect(gyro.levers.map((l) => l.lever.termId)).toContain('stability');
    expect(gyro.hiddenLevers).toBe(0);
  });

  it('has no levers when the main weapon has no aim style, but keeps the general aim steps', () => {
    const plan = buildPlan(real, profile(), sampleLoadout({ weapons: { kinetic: 'sword', energy: null, power: null } }));
    expect(plan.main?.aimStyle).toBeNull();
    expect(plan.style).toBeUndefined();
    expect(plan.levers).toEqual([]);
    expect(stepKeys(plan).aim).toEqual([
      progressKey.loadout('l1', 'sensitivity'),
      progressKey.loadout('l1', 'term:smoothing'),
      progressKey.loadout('l1', 'term:aiming-curve'),
      progressKey.loadout('l1', 'term:quantization'),
      progressKey.loadout('l1', 'term:velocity-mapping'),
    ]);
  });

  it('shows the no-cm/360-range gap next to XIM’s sensitivity advice', () => {
    const plan = buildPlan(real, profile(), sampleLoadout());
    expect(plan.sensitivity?.lead.map((s) => s.confidence)).toContain('gap');
    expect(plan.sensitivity?.lead[0]).toBe(knowledge.glossary.terms.find((t) => t.id === 'sensitivity')?.guidance[0]);
  });
});

describe('progress', () => {
  it('resumes at the first step that isn’t fully done, then the sheet', () => {
    const plan = buildPlan(real, profile({ platform: 'xbox', outputType: 'xbox-controller' }), sampleLoadout());
    const keys = stepKeys(plan);
    const done = (list: string[]) => Object.fromEntries(list.map((k) => [k, 'done' as const]));

    expect(resumeStep(plan, {})).toBe('destiny-2');
    expect(resumeStep(plan, done(keys['destiny-2']))).toBe('matrix');
    // "Needs fixing" isn't done.
    expect(resumeStep(plan, { ...done(keys['destiny-2']), [keys['destiny-2'][0]!]: 'problem' })).toBe('destiny-2');
    expect(resumeStep(plan, done([...keys['destiny-2'], ...keys.matrix]))).toBe('aim');
    expect(resumeStep(plan, done([...keys['destiny-2'], ...keys.matrix, ...keys.aim]))).toBe('sheet');
  });

  it('counts done and needs-fixing items over the whole build', () => {
    const plan = buildPlan(real, profile(), sampleLoadout());
    const [a, b] = stepKeys(plan)['destiny-2'];
    const count = planProgress(plan, { [a!]: 'done', [b!]: 'problem', 'check:unrelated': 'done' });
    expect(count.done).toBe(1);
    expect(count.problem).toBe(1);
    expect(progressText(count, 'steps')).toBe(`1 of ${count.total} steps done, 1 needs fixing`);
    expect(progressText({ total: 6, done: 2, problem: 0 })).toBe('2 of 6 done');
  });
});

describe('current values', () => {
  it('compares Destiny 2 settings exactly with the required value', () => {
    const config = emptyConfig();
    expect(currentRequiredValue(config, 'Look Sensitivity', '20')).toBeNull();
    config.inGame.lookSensitivity = 18;
    config.inGame.adsSensitivityModifier = 1.5;
    config.inGame.radialDeadzone = 0.13;
    config.inGame.movementControls = 'other';
    config.inGame.buttonLayout = 'default';
    expect(currentRequiredValue(config, 'Look Sensitivity', '20')).toEqual({ text: '18', comparison: 'differs' });
    expect(currentRequiredValue(config, 'ADS Sensitivity Modifier', ' 1.5 ')).toEqual({ text: '1.5', comparison: 'same' });
    expect(currentRequiredValue(config, 'Radial Deadzone', '0.13')?.comparison).toBe('same');
    expect(currentRequiredValue(config, 'Movement Controls', 'Default')?.comparison).toBe('differs');
    expect(currentRequiredValue(config, 'Button Layout', 'Default')?.comparison).toBe('same');
    expect(currentRequiredValue(config, 'Field of View', 'Default')).toBeNull();
  });

  it('reads aim settings for display', () => {
    const config = emptyConfig();
    expect(currentAimValue(config, 'precision')).toBeNull();
    config.aim.precision = 40;
    config.aim.hipSensitivity = 32;
    config.aim.quantization = true;
    config.aim.quantizationMagnitude = 25;
    config.aim.aimingCurve = 'linear';
    config.aim.smoothing = 'preset';
    config.aim.presetName = 'Balanced';
    expect(currentAimValue(config, 'precision')).toBe('40');
    expect(currentAimValue(config, 'sensitivity')).toBe('Hip 32 cm/360');
    expect(currentAimValue(config, 'quantization')).toBe('On · Magnitude 25');
    expect(currentAimValue(config, 'aiming-curve')).toBe('Linear');
    expect(nonStandardSmoothing(config)).toBe('Preset: Balanced');
    config.aim.smoothing = 'standard';
    expect(nonStandardSmoothing(config)).toBeNull();
  });

  it('flags a Config DPI that differs from the mouse', () => {
    const config = emptyConfig();
    config.matrix.configDpi = 800;
    expect(checkContext('mouse-dpi-matches', { mouseDpi: 1600, pollingRate: null }, config)).toEqual([
      { label: 'Your mouse (profile)', value: '1600 DPI' },
      { label: 'Your Config (current settings)', value: '800 DPI', differs: true },
    ]);
    expect(checkContext('mouse-polling-rate', { mouseDpi: null, pollingRate: 1000 }, undefined)).toEqual([
      { label: 'Your mouse is set to (profile)', value: '1000 Hz' },
    ]);
    expect(checkContext('firmware-current', { mouseDpi: 1600, pollingRate: 1000 }, config)).toEqual([]);
  });
});

describe('sheetText', () => {
  it('keeps every value, confidence label and caveat', () => {
    const loadout = sampleLoadout({ weapons: { kinetic: 'hand-cannon', energy: 'shotgun', power: null } });
    const plan = buildPlan(real, profile(), loadout);
    const config = emptyConfig();
    config.inGame.lookSensitivity = 18;
    const text = sheetText({
      plan,
      weapons: weaponLines(loadout, real),
      progress: { [progressKey.requiredSetting('Look Sensitivity')]: 'problem' },
      config,
      profile: profile(),
      termName: (id) => real.termById(id)?.name ?? id,
    });
    expect(text).toContain('Weapons: Kinetic: Hand Cannon (main) · Energy: Shotgun');
    expect(text).toContain('- Look Sensitivity: 20 [Official] · Needs fixing · Yours: 18 (differs)');
    expect(text).toContain(`Caveat for every value here: ${sharedCaveat(plan.settings.map((s) => s.statement))!}`);
    expect(text).toContain('- Easing: Lower');
    expect(text).toContain(EASING_CAVEAT);
    for (const check of plan.checks) expect(text).toContain(check.check.title);
  });
});
