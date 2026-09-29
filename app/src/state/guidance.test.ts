import { describe, expect, it } from 'vitest';
import { knowledge, type FoundationCheck, type Lever } from '../../../knowledge/index';
import { aimsWithMouse, checksForProfile, leversForProfile } from './guidance';
import { PER_CONFIG_CHECK_IDS } from './progress';
import { defaultProfile } from './schema';

const reasoned = { text: 't', confidence: 'reasoned' as const, citations: [], reasoning: 'r', caveat: 'c' };

function check(id: string, platforms: FoundationCheck['platforms'], outputTypes: FoundationCheck['outputTypes'] = []): FoundationCheck {
  return { id, title: id, platforms, outputTypes, check: 'Do it.', why: reasoned, termIds: [] };
}

const CHECKS = [
  check('everywhere', ['xbox', 'pc']),
  check('xbox-only', ['xbox']),
  check('pc-auth', ['pc'], ['pc-xbox-controller', 'pc-dualsense']),
];

describe('checksForProfile', () => {
  it('keeps every check until the platform is known', () => {
    expect(checksForProfile(CHECKS, defaultProfile()).map((c) => c.id)).toEqual(['everywhere', 'xbox-only', 'pc-auth']);
  });

  it('filters by platform, and by output type once it is known', () => {
    const ids = (platform: 'xbox' | 'pc', outputType: Parameters<typeof checksForProfile>[1]['outputType']) =>
      checksForProfile(CHECKS, { platform, outputType }).map((c) => c.id);
    expect(ids('xbox', 'xbox-controller')).toEqual(['everywhere', 'xbox-only']);
    expect(ids('pc', null)).toEqual(['everywhere', 'pc-auth']);
    expect(ids('pc', 'pc-dualsense')).toEqual(['everywhere', 'pc-auth']);
    expect(ids('pc', 'pc-xinput')).toEqual(['everywhere']);
  });

  it('shows the Stick Upscaling check only for DualSense output on PC', () => {
    const ids = (profile: Parameters<typeof checksForProfile>[1]) => checksForProfile(knowledge.foundation, profile).map((c) => c.id);
    expect(ids({ platform: 'pc', outputType: 'pc-dualsense' })).toContain('pc-dualsense-stick-upscaling');
    for (const outputType of ['pc-xinput', 'pc-xbox-controller'] as const) {
      expect(ids({ platform: 'pc', outputType }), outputType).not.toContain('pc-dualsense-stick-upscaling');
    }
    expect(ids({ platform: 'xbox', outputType: 'xbox-controller' })).not.toContain('pc-dualsense-stick-upscaling');
    // It is set in each Config, so it is marked Per Config.
    expect(PER_CONFIG_CHECK_IDS.has('pc-dualsense-stick-upscaling')).toBe(true);
  });

  it('shows the PC authentication controller check only for Xbox and DualSense output', () => {
    const ids = (outputType: 'pc-xinput' | 'pc-xbox-controller') =>
      checksForProfile(knowledge.foundation, { platform: 'pc', outputType }).map((c) => c.id);
    expect(ids('pc-xbox-controller')).toContain('pc-authentication-controller');
    expect(ids('pc-xinput')).not.toContain('pc-authentication-controller');
    expect(ids('pc-xinput')).not.toContain('xbox-authentication-controller');
  });
});

describe('leversForProfile', () => {
  const lever = (termId: string, aimingSources?: Lever['aimingSources']): Lever => ({
    termId,
    direction: 'raise',
    ...(aimingSources ? { aimingSources } : {}),
    statement: reasoned,
  });
  const LEVERS = [lever('precision'), lever('stability', ['gyro'])];

  it('drops gyro-only levers for mouse players', () => {
    expect(leversForProfile(LEVERS, { aimingSources: ['mouse'] }).map((l) => l.termId)).toEqual(['precision']);
  });

  it('keeps them when the player aims with gyro too', () => {
    expect(leversForProfile(LEVERS, { aimingSources: ['mouse', 'gyro'] }).map((l) => l.termId)).toEqual(['precision', 'stability']);
  });

  it('marks Stability in the real data as gyro-only', () => {
    const hold = knowledge.aimStyles.find((s) => s.id === 'precision-hold');
    expect(hold?.levers.find((l) => l.termId === 'stability')?.aimingSources).toEqual(['gyro']);
  });

  it('marks the smoothing levers in the real data as mouse or gyro, since the guide gives smoothing only there', () => {
    const smoothing = knowledge.aimStyles.flatMap((s) => s.levers).filter((l) => ['precision', 'response', 'easing'].includes(l.termId));
    expect(smoothing.length).toBeGreaterThan(0);
    for (const lever of smoothing) expect(lever.aimingSources, lever.termId).toEqual(['mouse', 'gyro']);
  });

  it('leaves a thumbstick-only player only the aiming curve for precision holds', () => {
    const hold = knowledge.aimStyles.find((s) => s.id === 'precision-hold')!;
    expect(leversForProfile(hold.levers, { aimingSources: ['thumbstick'] }).map((l) => l.termId)).toEqual(['aiming-curve']);
    // Every style's smoothing directions are hidden from them.
    for (const style of knowledge.aimStyles) {
      const kept = leversForProfile(style.levers, { aimingSources: ['thumbstick'] }).map((l) => l.termId);
      expect(kept.filter((id) => ['precision', 'response', 'easing', 'stability'].includes(id)), style.id).toEqual([]);
    }
  });
});

describe('aimsWithMouse', () => {
  it('is true only when the profile aims with a mouse', () => {
    expect(aimsWithMouse({ aimingSources: ['mouse'] })).toBe(true);
    expect(aimsWithMouse({ aimingSources: ['gyro', 'thumbstick'] })).toBe(false);
    expect(aimsWithMouse(defaultProfile())).toBe(true);
  });
});
