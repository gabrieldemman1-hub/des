import { describe, expect, it } from 'vitest';
import { knowledge } from '../../../../knowledge/index';
import { EASING_CAVEAT } from '../../../../knowledge/integrity';
import { createKnowledgeApi } from '../../state/knowledge-context';
import { REQUIRED_SETTINGS_CHECK_ID, effectiveProgress, progressKey, progressSummary } from '../../state/progress';
import { defaultProfile, emptyConfig, emptyInGame, type Profile } from '../../state/schema';
import { sampleLoadout } from '../../test/fixtures';
import { MECHANICS_DEFAULTS, MECHANICS_TERM_IDS, buildPlan, planProgress, resumeStep, stepKeys } from './build-plan';
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

  it('keeps the setup checks for the profile’s platform, leaving the Destiny 2 settings check to step 1', () => {
    const ids = (p: Profile) => buildPlan(real, p, sampleLoadout()).checks.map((c) => c.check.id);
    expect(ids(profile({ platform: 'xbox', outputType: 'xbox-controller' }))).toContain('xbox-authentication-controller');
    expect(ids(profile({ platform: 'xbox', outputType: 'xbox-controller' }))).not.toContain('pc-virtual-controller-tools');
    expect(ids(profile({ platform: 'pc', outputType: 'pc-xinput' }))).not.toContain('xbox-authentication-controller');
    expect(knowledge.foundation.map((c) => c.id)).toContain(REQUIRED_SETTINGS_CHECK_ID);
    expect(ids(profile())).not.toContain(REQUIRED_SETTINGS_CHECK_ID);
    expect(ids(profile())).toHaveLength(knowledge.foundation.length - 1);
  });

  it('keys the aim items under the loadout’s shared aim prefix, levers by aim style', () => {
    const plan = buildPlan(real, profile(), sampleLoadout());
    expect(stepKeys(plan).aim).toEqual([
      'loadout:l1:aim:sensitivity',
      'loadout:l1:aim:smoothing',
      'loadout:l1:aim:lever:tracking:precision',
      'loadout:l1:aim:term:aiming-curve',
      'loadout:l1:aim:term:quantization',
      'loadout:l1:aim:term:velocity-mapping',
    ]);
    // A scout rifle's Precision is another item: its aim style is part of the key.
    const scout = buildPlan(real, profile(), sampleLoadout({ weapons: { kinetic: 'scout-rifle', energy: null, power: null } }));
    expect(scout.levers.find((l) => l.lever.termId === 'precision')?.key).toBe(
      progressKey.aim.lever('l1', 'precision-hold', 'precision'),
    );
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
      progressKey.aim.sensitivity('l1'),
      progressKey.aim.smoothing('l1'),
      progressKey.aim.term('l1', 'aiming-curve'),
      progressKey.aim.term('l1', 'quantization'),
      progressKey.aim.term('l1', 'velocity-mapping'),
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
    expect(progressSummary(count, 'items')).toBe(`1 of ${count.total} items done · 1 needs fixing`);
    expect(progressSummary({ total: 6, done: 2, problem: 0 })).toBe('2 of 6 done');
  });
});

describe('sheetText', () => {
  const termName = (id: string) => real.termById(id)?.name ?? id;

  it('keeps every value, confidence label and caveat', () => {
    const loadout = sampleLoadout({ weapons: { kinetic: 'hand-cannon', energy: 'shotgun', power: null } });
    const plan = buildPlan(real, profile(), loadout);
    const inGame = emptyInGame();
    inGame.lookSensitivity = 18;
    const text = sheetText({
      plan,
      weapons: weaponLines(loadout, real),
      progress: { [progressKey.requiredSetting('Look Sensitivity')]: 'problem' },
      inGame,
      config: emptyConfig(),
      profile: profile(),
      termName,
    });
    expect(text).toContain('Weapons: Kinetic: Hand Cannon (main) · Energy: Shotgun');
    expect(text).toContain('- Look Sensitivity: 20 [Official] · Needs fixing · Yours: 18 (differs)');
    expect(text).toContain(`Caveat for every value here: ${sharedCaveat(plan.settings.map((s) => s.statement))!}`);
    expect(text).toContain('- Easing: Lower');
    expect(text).toContain(EASING_CAVEAT);
    expect(text).toContain('- Sensitivity: Your cm/360 (by feel) · Not checked yet\n');
    expect(text).toContain('- Aiming Curve: Linear (default) · Not checked yet\n');
    for (const check of plan.checks) expect(text).toContain(check.check.title);
    expect(text).toContain('Progress: 0 of');
    expect(text).toMatch(/Progress: 0 of \d+ items done · 1 needs fixing/);
  });

  it('labels every reasoned statement as worked out', () => {
    const loadout = sampleLoadout({ weapons: { kinetic: 'hand-cannon', energy: null, power: null } });
    const plan = buildPlan(real, profile(), loadout);
    const text = sheetText({
      plan,
      weapons: weaponLines(loadout, real),
      progress: {},
      inGame: emptyInGame(),
      config: undefined,
      profile: profile(),
      termName,
    });
    const lines = text.split('\n');
    const reasoned = lines.filter((line) => line.includes('[Reasoned]'));
    expect(reasoned.length).toBeGreaterThan(2);
    // Every [Reasoned] statement is followed by its "worked out" label.
    lines.forEach((line, i) => {
      if (line.includes('[Reasoned]') && line.trimStart().startsWith('[Reasoned]')) {
        expect(lines[i + 1], line).toMatch(/Worked out (from XIM’s definitions|by Dialed), not stated by (a|any) source\./);
      }
    });
    // The Easing lever is reasoned from XIM's definitions.
    const easing = lines.findIndex((line) => line.startsWith('- Easing: Lower'));
    expect(lines[easing + 2]).toBe('    Worked out from XIM’s definitions, not stated by a source.');
  });

  it('includes the smoothing note when smoothing isn’t custom Standard', () => {
    const loadout = sampleLoadout();
    const plan = buildPlan(real, profile(), loadout);
    const config = emptyConfig();
    const make = () =>
      sheetText({ plan, weapons: weaponLines(loadout, real), progress: {}, inGame: emptyInGame(), config, profile: profile(), termName });

    config.aim.smoothing = 'standard';
    expect(make()).not.toContain('Note: ');
    config.aim.smoothing = 'classic';
    expect(make()).toContain('Note: Your smoothing is Custom Classic. These directions assume Standard smoothing.');
    config.aim.smoothing = 'preset';
    config.aim.presetName = 'Fast';
    expect(make()).toContain(
      'Note: Your smoothing is a preset (Fast). Dialed can’t tell which mode a preset uses. These directions assume Standard smoothing.',
    );
  });

  it('says to check the per-Config checks in every Config', () => {
    const loadout = sampleLoadout();
    const plan = buildPlan(real, profile(), loadout);
    const text = sheetText({
      plan,
      weapons: weaponLines(loadout, real),
      progress: {},
      inGame: emptyInGame(),
      config: undefined,
      profile: profile(),
      termName,
    });
    const lines = text.split('\n');
    const dpi = lines.findIndex((line) => line.startsWith(`- ${plan.checks.find((c) => c.check.id === 'mouse-dpi-matches')!.check.title}`));
    expect(lines[dpi + 1]).toBe('  Check this in every Config you use — each loadout has its own.');
    const firmware = lines.findIndex((line) => line.startsWith(`- ${plan.checks.find((c) => c.check.id === 'firmware-current')!.check.title}`));
    expect(lines[firmware + 1]).not.toContain('every Config');
  });
});

describe('progress on the sheet', () => {
  it('counts a Destiny 2 setting whose value differs as needing fixing, so the sheet and the Build index agree', () => {
    const plan = buildPlan(real, profile(), sampleLoadout());
    const key = progressKey.requiredSetting('ADS Sensitivity Modifier');
    const progress = effectiveProgress({ [key]: 'done' }, knowledge, {
      inGame: { ...emptyInGame(), adsSensitivityModifier: 1 },
      profile: profile(),
      configs: [],
    });
    expect(progress[key]).toBe('problem');
    const count = planProgress(plan, progress);
    expect(count.done).toBe(0);
    expect(count.problem).toBe(1);
    // "Needs fixing" isn't done, so the build picks up at step 1.
    expect(resumeStep(plan, progress)).toBe('destiny-2');
  });
});

describe('aim row values', () => {
  it('gives every aim row a value to show, from the knowledge base', () => {
    const plan = buildPlan(real, profile(), sampleLoadout());
    expect(plan.sensitivity?.value).toEqual({ text: 'Your cm/360', caption: 'by feel', confidence: 'gap' });
    expect(plan.smoothing?.value).toEqual({ text: 'A preset', caption: 'by feel', confidence: 'official' });
    expect(plan.mechanics.map((m) => [m.term.id, m.value])).toEqual([
      ['aiming-curve', { text: 'Linear', caption: 'default', confidence: 'official' }],
      ['quantization', { text: 'Off', caption: 'default', confidence: 'official' }],
      ['velocity-mapping', { text: 'Standard', caption: 'default', confidence: 'official' }],
    ]);
  });

  it('keeps each mechanic’s default in step with XIM’s guidance on the term', () => {
    for (const id of MECHANICS_TERM_IDS) {
      const first = real.termById(id)?.guidance[0];
      expect(first?.confidence, id).toBe('official');
      expect(first?.text.toLowerCase(), id).toContain(MECHANICS_DEFAULTS[id].toLowerCase());
    }
  });
});
