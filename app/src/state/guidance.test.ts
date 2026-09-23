import { describe, expect, it } from 'vitest';
import { knowledge, type FoundationCheck, type Lever } from '../../../knowledge/index';
import { checksForProfile, leversForProfile } from './guidance';
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
});
