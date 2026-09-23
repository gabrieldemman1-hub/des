import { describe, expect, it } from 'vitest';
import {
  aimValue,
  checkContext,
  currentAimValue,
  currentRequiredValue,
  describeQuantization,
  describeSmoothing,
  smoothingNote,
} from './current-values';
import { emptyConfig, emptyInGame } from './schema';

describe('current values', () => {
  it('compares Destiny 2 settings exactly with the required value', () => {
    const inGame = emptyInGame();
    expect(currentRequiredValue(inGame, 'Look Sensitivity', '20')).toBeNull();
    inGame.lookSensitivity = 18;
    inGame.adsSensitivityModifier = 1.5;
    inGame.radialDeadzone = 0.13;
    inGame.movementControls = 'other';
    inGame.buttonLayout = 'default';
    expect(currentRequiredValue(inGame, 'Look Sensitivity', '20')).toEqual({ text: '18', comparison: 'differs' });
    expect(currentRequiredValue(inGame, 'ADS Sensitivity Modifier', ' 1.5 ')).toEqual({ text: '1.5', comparison: 'same' });
    expect(currentRequiredValue(inGame, 'Radial Deadzone', '0.13')?.comparison).toBe('same');
    expect(currentRequiredValue(inGame, 'Movement Controls', 'Default')?.comparison).toBe('differs');
    expect(currentRequiredValue(inGame, 'Button Layout', 'Default')?.comparison).toBe('same');
    expect(currentRequiredValue(inGame, 'Field of View', 'Default')).toBeNull();
    expect(currentRequiredValue(undefined, 'Look Sensitivity', '20')).toBeNull();
  });

  it('reads aim settings for display', () => {
    const config = emptyConfig();
    expect(currentAimValue(config, 'precision')).toBeNull();
    config.aim.precision = 40;
    config.aim.hipSensitivity = 32;
    config.aim.quantization = true;
    config.aim.quantizationMagnitude = 25;
    config.aim.aimingCurve = 'linear';
    expect(currentAimValue(config, 'precision')).toBe('40');
    expect(currentAimValue(config, 'sensitivity')).toBe('Hip 32 cm/360');
    expect(currentAimValue(config, 'quantization')).toBe('On (Magnitude 25)');
    expect(currentAimValue(config, 'quantization-magnitude')).toBe('25');
    expect(currentAimValue(config, 'aiming-curve')).toBe('Linear');
    expect(currentAimValue(undefined, 'precision')).toBeNull();
    // Dialed has no field for Stability.
    expect(aimValue(config.aim, 'stability')).toBeUndefined();
  });

  it('shows Standard values only with custom Standard smoothing (or none entered), Classic values only with Classic', () => {
    const config = emptyConfig();
    Object.assign(config.aim, { precision: 40, response: 30, easing: 20, smooth: 10, decay: 5, synch: 3 });

    expect(currentAimValue(config, 'precision')).toBe('40');
    expect(currentAimValue(config, 'smooth')).toBeNull();

    config.aim.smoothing = 'standard';
    expect(currentAimValue(config, 'smoothing')).toBe('Custom Standard (Precision 40, Response 30, Easing 20)');
    expect(currentAimValue(config, 'easing')).toBe('20');
    expect(currentAimValue(config, 'decay')).toBeNull();

    config.aim.smoothing = 'classic';
    expect(currentAimValue(config, 'smoothing')).toBe('Custom Classic (Smooth 10, Decay 5, Synch 3)');
    expect(currentAimValue(config, 'decay')).toBe('5');
    for (const id of ['precision', 'response', 'easing']) expect(currentAimValue(config, id)).toBeNull();

    for (const smoothing of ['preset', 'off'] as const) {
      config.aim.smoothing = smoothing;
      for (const id of ['precision', 'smooth']) expect(currentAimValue(config, id), `${smoothing} ${id}`).toBeNull();
    }
    config.aim.smoothing = 'preset';
    config.aim.presetName = ' Balanced ';
    expect(describeSmoothing(config.aim)).toBe('Preset: Balanced');
    config.aim.smoothing = 'off';
    expect(describeSmoothing(config.aim)).toBe('Off');
  });

  it('shows Magnitude and Angle only while quantization is on', () => {
    const config = emptyConfig();
    Object.assign(config.aim, { quantizationMagnitude: 25, quantizationAngle: 20 });
    expect(currentAimValue(config, 'quantization')).toBeNull();
    config.aim.quantization = false;
    expect(describeQuantization(config.aim)).toBe('Off');
    expect(currentAimValue(config, 'quantization-magnitude')).toBeNull();
    expect(currentAimValue(config, 'quantization-angle')).toBeNull();
    config.aim.quantization = true;
    expect(describeQuantization(config.aim)).toBe('On (Magnitude 25, Angle 20)');
    expect(currentAimValue(config, 'quantization-angle')).toBe('20');
  });

  it('words the smoothing note the same way everywhere', () => {
    const aim = emptyConfig().aim;
    expect(smoothingNote(undefined)).toBeNull();
    expect(smoothingNote(aim)).toBeNull();
    expect(smoothingNote({ ...aim, smoothing: 'standard' })).toBeNull();
    expect(smoothingNote({ ...aim, smoothing: 'classic' })?.text).toBe(
      'Your smoothing is Custom Classic. These directions assume Standard smoothing.',
    );
    expect(smoothingNote({ ...aim, smoothing: 'off' })?.text).toBe(
      'Your smoothing is Off. These directions assume Standard smoothing.',
    );
    expect(smoothingNote({ ...aim, smoothing: 'preset' })?.text).toBe(
      'Your smoothing is a preset. Dialed can’t tell which mode a preset uses. These directions assume Standard smoothing.',
    );
    expect(smoothingNote({ ...aim, smoothing: 'preset', presetName: 'Fast' }, 'one')).toEqual({
      mode: 'preset',
      current: 'Preset: Fast',
      text: 'Your smoothing is a preset (Fast). Dialed can’t tell which mode a preset uses. This direction assumes Standard smoothing.',
    });
  });

  it('flags a Config DPI that differs from the mouse', () => {
    const config = emptyConfig();
    config.matrix.configDpi = 800;
    expect(checkContext('mouse-dpi-matches', { mouseDpi: 1600, pollingRate: null }, config)).toEqual([
      { label: 'Your mouse (profile)', value: '1600 DPI' },
      { label: 'This loadout’s Config (current settings)', value: '800 DPI', differs: true },
    ]);
    expect(checkContext('mouse-polling-rate', { mouseDpi: null, pollingRate: 1000 }, undefined)).toEqual([
      { label: 'Your mouse is set to (profile)', value: '1000 Hz' },
    ]);
    expect(checkContext('firmware-current', { mouseDpi: 1600, pollingRate: 1000 }, config)).toEqual([]);
  });
});
