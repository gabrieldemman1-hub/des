import { describe, expect, it } from 'vitest';
import { knowledge, type KnowledgeBase, type Statement } from '../../../../knowledge/index';
import { EASING_CAVEAT } from '../../../../knowledge/integrity';
import type { ConfigPatch } from '../../state/data-context';
import { defaultProfile, emptyConfig, type CurrentConfig, type Loadout, type Profile } from '../../state/schema';
import { sampleLoadout } from '../../test/fixtures';
import {
  analyzeConfig,
  checkRequiredSettings,
  FINDING_GROUPS,
  firstChange,
  groupFindings,
  hasEnteredSettings,
  mainWeapon,
  requiredSettingField,
  type Finding,
  type InGameField,
} from './analysis';
import { parseNumberInput } from './number-input';

const kb = knowledge;

function config(patch: ConfigPatch = {}): CurrentConfig {
  const base = emptyConfig();
  return {
    ...base,
    inGame: { ...base.inGame, ...patch.inGame },
    matrix: { ...base.matrix, ...patch.matrix },
    aim: { ...base.aim, ...patch.aim },
  };
}

function profile(patch: Partial<Profile> = {}): Profile {
  return { ...defaultProfile(), ...patch };
}

/** A loadout whose only (and main) weapon is this archetype. */
function loadoutWith(archetype: string): Loadout {
  return sampleLoadout({ weapons: { kinetic: archetype, energy: null, power: null }, mainSlot: 'kinetic' });
}

const PULSE = sampleLoadout(); // pulse rifle (main) + shotgun
const HAND_CANNON = loadoutWith('hand-cannon');
const SCOUT = loadoutWith('scout-rifle');

/** The in-game settings exactly as the knowledge base requires them. */
function requiredInGame(): CurrentConfig['inGame'] {
  const inGame = emptyConfig().inGame;
  for (const setting of kb.game.requiredSettings) {
    const field = requiredSettingField(setting.name);
    if (field === 'movementControls' || field === 'buttonLayout') inGame[field] = 'default';
    else if (field !== null) inGame[field] = Number(setting.value);
  }
  return inGame;
}

function required(field: InGameField) {
  const setting = kb.game.requiredSettings.find((s) => requiredSettingField(s.name) === field);
  if (!setting) throw new Error(`The knowledge base has no required setting for ${field}`);
  return setting;
}

function ids(findings: readonly Finding[]) {
  return findings.map((f) => f.id);
}

function byId(findings: readonly Finding[], id: string): Finding {
  const finding = findings.find((f) => f.id === id);
  if (!finding) throw new Error(`No finding ${id} in ${ids(findings).join(', ')}`);
  return finding;
}

function term(id: string) {
  const found = kb.glossary.terms.find((t) => t.id === id);
  if (!found) throw new Error(`No term ${id}`);
  return found;
}

function check(id: string) {
  const found = kb.foundation.find((c) => c.id === id);
  if (!found) throw new Error(`No setup check ${id}`);
  return found;
}

function style(id: string) {
  const found = kb.aimStyles.find((s) => s.id === id);
  if (!found) throw new Error(`No aim style ${id}`);
  return found;
}

/** Every Statement object in the knowledge base, to check findings never make one up. */
function allStatements(base: KnowledgeBase): Set<Statement> {
  const found = new Set<Statement>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value !== null && typeof value === 'object') {
      if ('confidence' in value && 'citations' in value && 'text' in value) found.add(value as Statement);
      Object.values(value).forEach(walk);
    }
  };
  walk(base);
  return found;
}

describe('Destiny 2 required settings', () => {
  it('knows a field for every required setting in the knowledge base', () => {
    expect(kb.game.requiredSettings.length).toBeGreaterThan(0);
    for (const setting of kb.game.requiredSettings) expect(requiredSettingField(setting.name)).not.toBeNull();
    expect(requiredSettingField('  look   SENSITIVITY ')).toBe('lookSensitivity');
    expect(requiredSettingField('Field of View')).toBeNull();
  });

  it('finds nothing to fix when every setting matches, and says so', () => {
    const current = config({ inGame: requiredInGame() });
    expect(groupFindings(analyzeConfig(kb, profile(), PULSE, current)).fix).toEqual([]);
    expect(checkRequiredSettings(kb, current).map((s) => s.state)).toEqual(kb.game.requiredSettings.map(() => 'ok'));
  });

  it('matches the exact values, including decimals', () => {
    expect(required('adsSensitivityModifier').value).toBe('1.5');
    expect(required('radialDeadzone').value).toBe('0.13');
    const exact = config({ inGame: { adsSensitivityModifier: 1.5, radialDeadzone: 0.13 } });
    expect(groupFindings(analyzeConfig(kb, profile(), PULSE, exact)).fix).toEqual([]);

    const close = config({ inGame: { adsSensitivityModifier: 1.4, radialDeadzone: 0.1 } });
    expect(ids(groupFindings(analyzeConfig(kb, profile(), PULSE, close)).fix)).toEqual([
      'fix:adsSensitivityModifier',
      'fix:radialDeadzone',
    ]);
  });

  it.each([
    ['lookSensitivity', 15],
    ['adsSensitivityModifier', 1],
    ['axialDeadzone', 5],
    ['radialDeadzone', 0],
  ] as const)('flags %s when it differs', (field, wrong) => {
    const setting = required(field);
    expect(Number(setting.value)).not.toBe(wrong);
    const findings = analyzeConfig(kb, profile(), PULSE, config({ inGame: { ...requiredInGame(), [field]: wrong } }));
    const fix = groupFindings(findings).fix;
    expect(fix).toHaveLength(1);
    expect(fix[0]).toMatchObject({
      id: `fix:${field}`,
      group: 'fix',
      title: setting.name,
      current: String(wrong),
      required: setting.value,
      status: 'mismatch',
      actionable: true,
    });
    // The knowledge base's own statement, caveat and all.
    expect(fix[0]!.statement).toBe(setting.statement);
    expect(fix[0]!.termIds).toContain('required-game-settings');
  });

  it.each(['movementControls', 'buttonLayout'] as const)('compares %s with "Default"', (field) => {
    expect(required(field).value).toBe('Default');
    const other = analyzeConfig(kb, profile(), PULSE, config({ inGame: { [field]: 'other' } }));
    expect(byId(other, `fix:${field}`)).toMatchObject({ current: 'Not default', required: 'Default', status: 'mismatch' });

    const same = analyzeConfig(kb, profile(), PULSE, config({ inGame: { [field]: 'default' } }));
    expect(groupFindings(same).fix).toEqual([]);
  });

  it('links the deadzone settings to the Deadzone explanation', () => {
    const findings = analyzeConfig(kb, profile(), PULSE, config({ inGame: { axialDeadzone: 3 } }));
    expect(byId(findings, 'fix:axialDeadzone').termIds).toEqual(['required-game-settings', 'deadzone']);
  });

  it('reports settings not entered yet without turning them into findings', () => {
    const current = config({ inGame: { lookSensitivity: 20 } });
    const states = checkRequiredSettings(kb, current);
    expect(states.find((s) => s.field === 'lookSensitivity')?.state).toBe('ok');
    expect(states.filter((s) => s.state === 'missing').map((s) => s.field)).toEqual([
      'movementControls',
      'buttonLayout',
      'adsSensitivityModifier',
      'axialDeadzone',
      'radialDeadzone',
    ]);
    expect(groupFindings(analyzeConfig(kb, profile(), PULSE, current)).fix).toEqual([]);
    // With nothing saved at all, every setting is missing.
    expect(checkRequiredSettings(kb, undefined).every((s) => s.state === 'missing')).toBe(true);
  });

  it('skips required settings it has no field for, or can’t read', () => {
    const extra: KnowledgeBase = {
      ...kb,
      game: {
        ...kb.game,
        requiredSettings: [
          ...kb.game.requiredSettings,
          { name: 'Field of View', value: '90', statement: required('lookSensitivity').statement },
          { name: 'Look Sensitivity', value: 'Maximum', statement: required('lookSensitivity').statement },
        ],
      },
    };
    const current = config({ inGame: { lookSensitivity: 7 } });
    const states = checkRequiredSettings(extra, current);
    expect(states.slice(-2).map((s) => s.state)).toEqual(['unknown', 'unknown']);
    // Only the real Look Sensitivity requirement produces a finding.
    expect(ids(groupFindings(analyzeConfig(extra, profile(), PULSE, current)).fix)).toEqual(['fix:lookSensitivity']);
  });
});

describe('Setup', () => {
  it('flags a Config DPI that differs from the mouse DPI in the profile', () => {
    const findings = analyzeConfig(kb, profile({ mouseDpi: 1600 }), PULSE, config({ matrix: { configDpi: 800 } }));
    const dpi = byId(findings, 'setup:dpi');
    expect(dpi).toMatchObject({ group: 'setup', status: 'mismatch', actionable: true });
    expect(dpi.current).toContain('800');
    expect(dpi.current).toContain('1600');
    expect(dpi.statement).toBe(check('mouse-dpi-matches').why);
    expect(dpi.more).toEqual([check('mouse-dpi-matches').fix]);
    expect(dpi.termIds).toContain('mouse-dpi');
  });

  it('says nothing about DPI when they match or one is missing', () => {
    const run = (mouseDpi: number | null, configDpi: number | null) =>
      ids(analyzeConfig(kb, profile({ mouseDpi }), PULSE, config({ matrix: { configDpi } })));
    expect(run(1600, 1600)).not.toContain('setup:dpi');
    expect(run(null, 800)).not.toContain('setup:dpi');
    expect(run(1600, null)).not.toContain('setup:dpi');
  });

  it('flags an out-of-date Smart Translator with the setup check and its fix', () => {
    const findings = analyzeConfig(kb, profile(), PULSE, config({ matrix: { translatorWarning: true } }));
    const translator = byId(findings, 'setup:smart-translator');
    expect(translator.statement).toBe(check('smart-translator-current').why);
    expect(translator.more).toEqual([check('smart-translator-current').fix]);
    expect(translator.actionable).toBe(true);
    expect(ids(analyzeConfig(kb, profile(), PULSE, config({ matrix: { translatorWarning: false } })))).not.toContain(
      'setup:smart-translator',
    );
  });

  it('discourages Manual sync with the glossary’s guidance', () => {
    const findings = analyzeConfig(kb, profile(), PULSE, config({ matrix: { syncMethod: 'manual' } }));
    const manual = byId(findings, 'setup:sync-manual');
    expect(manual.statement).toBe(term('sync-manual').guidance[0]);
    expect(manual.statement.confidence).toBe('official');
    expect(manual.actionable).toBe(true);
    expect(manual.current).toBe('Manual');
    // The plan it points to: Destiny 2's sync-method note.
    expect(manual.more).toContain(kb.game.notes.find((n) => n.id === 'sync-method')!.statement);
  });

  it('explains Custom sync with the Destiny 2 note, without calling it a fault', () => {
    const findings = analyzeConfig(kb, profile(), PULSE, config({ matrix: { syncMethod: 'custom' } }));
    const custom = byId(findings, 'setup:sync-custom');
    expect(custom.statement).toBe(kb.game.notes.find((n) => n.id === 'sync-method')!.statement);
    expect(custom.statement.caveat).toBeTruthy();
    expect(custom.actionable).toBe(false);
    expect(custom.status).toBeUndefined();
  });

  it('says nothing about Standard sync', () => {
    const findings = analyzeConfig(kb, profile(), PULSE, config({ matrix: { syncMethod: 'standard' } }));
    expect(groupFindings(findings).setup).toEqual([]);
  });
});

describe('Aim settings', () => {
  it('starts with Sensitivity, then the tracking levers for a pulse rifle', () => {
    const findings = groupFindings(analyzeConfig(kb, profile(), PULSE, config())).aim;
    expect(ids(findings)).toEqual(['aim:sensitivity', ...style('tracking').levers.map((l) => `aim:${l.termId}`)]);
    expect(findings[0]!.statement).toBe(term('sensitivity').guidance[0]);
    const precision = byId(findings, 'aim:precision');
    expect(precision).toMatchObject({ direction: 'raise', status: 'missing', actionable: true });
    expect(precision.statement).toBe(style('tracking').levers[0]!.statement);
  });

  it('shows the player’s value for each lever and never judges it', () => {
    const current = config({ aim: { smoothing: 'standard', precision: 40, hipSensitivity: 30, adsSensitivity: 28 } });
    const findings = analyzeConfig(kb, profile(), PULSE, current);
    expect(byId(findings, 'aim:precision')).toMatchObject({ current: '40', status: undefined, direction: 'raise' });
    expect(byId(findings, 'aim:sensitivity')).toMatchObject({ current: 'Hip 30 cm/360 · ADS 28 cm/360', status: undefined });
    for (const finding of findings) expect(finding.status).not.toBe('mismatch');
  });

  it('gives a snap loadout Easing → lower, with the Easing caveat', () => {
    const findings = analyzeConfig(kb, profile(), HAND_CANNON, config({ aim: { smoothing: 'standard', easing: 55 } }));
    const easing = byId(findings, 'aim:easing');
    expect(easing).toMatchObject({ direction: 'lower', current: '55', actionable: true });
    expect(easing.statement.caveat).toContain(EASING_CAVEAT);
    expect(easing.statement.confidence).toBe('reasoned');
    expect(byId(findings, 'aim:response').direction).toBe('depends');
  });

  it('hides the gyro-only lever from a mouse-only profile', () => {
    const mouse = ids(analyzeConfig(kb, profile(), SCOUT, config()));
    expect(mouse).not.toContain('aim:stability');
    expect(mouse).toContain('aim:aiming-curve');

    const gyro = analyzeConfig(kb, profile({ aimingSources: ['mouse', 'gyro'] }), SCOUT, config());
    expect(byId(gyro, 'aim:stability').direction).toBe('raise');
    // Dialed has no field for Stability, so there is no value to show.
    expect(byId(gyro, 'aim:stability').current).toBeUndefined();
    expect(byId(gyro, 'aim:stability').status).toBeUndefined();
  });

  it.each(['classic', 'preset', 'off'] as const)(
    'explains that the directions assume Standard smoothing when smoothing is %s',
    (smoothing) => {
      const findings = analyzeConfig(kb, profile(), SCOUT, config({ aim: { smoothing, precision: 50 } }));
      const aim = groupFindings(findings).aim;
      const note = byId(aim, 'aim:smoothing-mode');
      expect(note.statement).toBe(style('precision-hold').favours);
      expect(note.statement.text).toMatch(/Standard/);
      expect(note.actionable).toBe(false);
      // It comes before the levers it is about.
      expect(ids(aim).indexOf('aim:smoothing-mode')).toBeLessThan(ids(aim).indexOf('aim:precision'));

      for (const id of ['aim:precision', 'aim:response', 'aim:easing']) {
        expect(byId(aim, id)).toMatchObject({ actionable: false, assumesStandard: true, current: undefined });
      }
      // The aiming curve isn't a smoothing setting, so its direction still applies.
      expect(byId(aim, 'aim:aiming-curve')).toMatchObject({ actionable: true, assumesStandard: undefined });
    },
  );

  it('adds no smoothing note for custom Standard or when smoothing isn’t entered', () => {
    for (const smoothing of ['standard', null] as const) {
      const findings = analyzeConfig(kb, profile(), PULSE, config({ aim: { smoothing } }));
      expect(ids(findings)).not.toContain('aim:smoothing-mode');
      expect(byId(findings, 'aim:precision').actionable).toBe(true);
    }
  });

  it('names the preset in the smoothing note', () => {
    const findings = analyzeConfig(kb, profile(), PULSE, config({ aim: { smoothing: 'preset', presetName: 'Fast' } }));
    expect(byId(findings, 'aim:smoothing-mode').current).toBe('Preset: Fast');
  });

  it('uses the archetype’s mapping when the main weapon has no aim style', () => {
    const sword = sampleLoadout({ weapons: { kinetic: 'pulse-rifle', energy: null, power: 'sword' }, mainSlot: 'power' });
    const archetype = kb.weapons.archetypes.find((a) => a.id === 'sword')!;
    expect(archetype.aimStyle).toBeNull();
    const aim = groupFindings(analyzeConfig(kb, profile(), sword, config())).aim;
    expect(ids(aim)).toEqual(['aim:sensitivity', 'aim:no-style']);
    expect(byId(aim, 'aim:no-style').statement).toBe(archetype.mapping);
    expect(byId(aim, 'aim:no-style').actionable).toBe(false);
  });

  it('degrades when the aim style or the archetype is missing from the knowledge base', () => {
    const noStyles: KnowledgeBase = { ...kb, aimStyles: [] };
    const aim = groupFindings(analyzeConfig(noStyles, profile(), PULSE, config())).aim;
    expect(ids(aim)).toEqual(['aim:sensitivity', 'aim:no-style']);

    const unknown = loadoutWith('laser-sword');
    expect(mainWeapon(kb, unknown)).toEqual({ archetype: undefined, style: undefined });
    expect(ids(groupFindings(analyzeConfig(kb, profile(), unknown, config())).aim)).toEqual(['aim:sensitivity']);
  });
});

describe('Good to know', () => {
  it('explains that a custom curve and quantization change real-world cm/360', () => {
    const clean = check('clean-sensitivity-test');
    const curve = byId(analyzeConfig(kb, profile(), PULSE, config({ aim: { aimingCurve: 'custom' } })), 'info:cm360');
    expect(curve).toMatchObject({ group: 'info', actionable: false, current: 'Aiming Curve: Custom' });
    expect(curve.statement).toBe(clean.why);
    expect(curve.more).toEqual([clean.fix]);

    const both = analyzeConfig(
      kb,
      profile(),
      PULSE,
      config({ aim: { aimingCurve: 'custom', quantization: true, quantizationMagnitude: 25, quantizationAngle: 20 } }),
    );
    expect(ids(groupFindings(both).info)).toEqual(['info:cm360']);
    expect(byId(both, 'info:cm360').current).toBe('Aiming Curve: Custom · Quantization: On (Magnitude 25, Angle 20)');
    expect(byId(both, 'info:cm360').termIds).toEqual(['aiming-curve', 'quantization']);

    const off = analyzeConfig(kb, profile(), PULSE, config({ aim: { aimingCurve: 'linear', quantization: false } }));
    expect(groupFindings(off).info).toEqual([]);
  });

  it('falls back to the glossary guidance without the setup check', () => {
    const noChecks: KnowledgeBase = { ...kb, foundation: [] };
    const findings = analyzeConfig(noChecks, profile(), PULSE, config({ aim: { quantization: true } }));
    expect(byId(findings, 'info:quantization').statement).toBe(term('quantization').guidance[0]);
  });

  it('points out a Velocity Mapping that isn’t Standard, with its default', () => {
    const findings = analyzeConfig(kb, profile(), PULSE, config({ aim: { velocityMapping: 'other' } }));
    const mapping = byId(findings, 'info:velocity-mapping');
    expect(mapping.statement).toBe(term('velocity-mapping').guidance[0]);
    expect(mapping.more).toEqual(term('velocity-mapping').guidance.slice(1));
    expect(ids(analyzeConfig(kb, profile(), PULSE, config({ aim: { velocityMapping: 'standard' } })))).not.toContain(
      'info:velocity-mapping',
    );
  });
});

describe('Ordering and invariants', () => {
  const everything = config({
    inGame: { ...requiredInGame(), lookSensitivity: 15, radialDeadzone: 0.2 },
    matrix: { configDpi: 800, syncMethod: 'manual', translatorWarning: true },
    aim: { smoothing: 'standard', aimingCurve: 'custom', velocityMapping: 'other' },
  });
  const findings = analyzeConfig(kb, profile({ mouseDpi: 1600, aimingSources: ['mouse', 'gyro'] }), SCOUT, everything);

  it('orders findings fix → setup → aim → info, by impact within each group', () => {
    const order = findings.map((f) => FINDING_GROUPS.indexOf(f.group));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(findings.map((f) => f.group))).toEqual(new Set(FINDING_GROUPS));
    expect(ids(groupFindings(findings).fix)).toEqual(['fix:lookSensitivity', 'fix:radialDeadzone']);
    // Recreating the Config (translator) comes before anything set inside it.
    expect(ids(groupFindings(findings).setup)).toEqual(['setup:smart-translator', 'setup:sync-manual', 'setup:dpi']);
    expect(ids(groupFindings(findings).info)).toEqual(['info:cm360', 'info:velocity-mapping']);
  });

  it('picks the first actionable change, skipping ones marked done', () => {
    expect(firstChange(findings)?.id).toBe('fix:lookSensitivity');
    const aimOnly = analyzeConfig(kb, profile(), PULSE, config({ inGame: requiredInGame() }));
    expect(firstChange(aimOnly)?.id).toBe('aim:sensitivity');
    expect(firstChange(aimOnly, (f) => f.id === 'aim:sensitivity')?.id).toBe('aim:precision');
    expect(firstChange(aimOnly, () => true)).toBeUndefined();
  });

  it('gives unique ids and only knowledge-base statements and terms', () => {
    const statements = allStatements(kb);
    const termIds = new Set(kb.glossary.terms.map((t) => t.id));
    expect(new Set(ids(findings)).size).toBe(findings.length);
    for (const finding of findings) {
      expect(statements.has(finding.statement), finding.id).toBe(true);
      for (const more of finding.more) expect(statements.has(more), finding.id).toBe(true);
      for (const id of finding.termIds) expect(termIds.has(id), `${finding.id}: ${id}`).toBe(true);
    }
  });

  it('works with nothing entered', () => {
    const none = analyzeConfig(kb, profile(), PULSE, undefined);
    expect(none.every((f) => f.group === 'aim')).toBe(true);
    expect(hasEnteredSettings(undefined)).toBe(false);
    expect(hasEnteredSettings(config())).toBe(false);
    expect(hasEnteredSettings(config({ aim: { presetName: 'Fast' } }))).toBe(true);
    expect(hasEnteredSettings(config({ matrix: { translatorWarning: false } }))).toBe(true);
  });
});

describe('parseNumberInput', () => {
  const percent = { min: 0, max: 100 };
  it('reads numbers, including a decimal comma, and treats an empty field as cleared', () => {
    expect(parseNumberInput('15', percent)).toEqual({ ok: true, value: 15 });
    expect(parseNumberInput(' 0.13 ', percent)).toEqual({ ok: true, value: 0.13 });
    expect(parseNumberInput('0,13', percent)).toEqual({ ok: true, value: 0.13 });
    expect(parseNumberInput('.5', percent)).toEqual({ ok: true, value: 0.5 });
    expect(parseNumberInput('', percent)).toEqual({ ok: true, value: null });
    expect(parseNumberInput('   ', percent)).toEqual({ ok: true, value: null });
  });

  it('rejects text, and numbers out of range', () => {
    for (const text of ['abc', '1e2', '12a', '-', '.', '101', '-1', '1.2.3']) {
      expect(parseNumberInput(text, percent)).toEqual({ ok: false, error: 'Enter a number from 0 to 100.' });
    }
  });

  it('asks for whole numbers where only those make sense', () => {
    const dpi = { min: 1, max: 1_000_000, integer: true };
    expect(parseNumberInput('1600', dpi)).toEqual({ ok: true, value: 1600 });
    expect(parseNumberInput('800.5', dpi)).toEqual({ ok: false, error: 'Enter a whole number from 1 to 1,000,000.' });
    expect(parseNumberInput('0', dpi).ok).toBe(false);
  });
});
