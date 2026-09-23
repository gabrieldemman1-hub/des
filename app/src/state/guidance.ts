/**
 * Which knowledge-base guidance applies to a profile, kept free of React so the flows can
 * share it and it can be tested directly.
 */
import type { FoundationCheck, Lever } from '../../../knowledge/index';
import type { Profile } from './schema';

/**
 * The setup checks for this profile's platform and output type. While the platform or the
 * output type is unset, the checks that depend on it are kept rather than guessed away.
 */
export function checksForProfile(
  checks: readonly FoundationCheck[],
  profile: Pick<Profile, 'platform' | 'outputType'>,
): FoundationCheck[] {
  return checks.filter(
    (check) =>
      (profile.platform === null || check.platforms.includes(profile.platform)) &&
      (check.outputTypes.length === 0 || profile.outputType === null || check.outputTypes.includes(profile.outputType)),
  );
}

/** The aim-style levers that fit what the player aims with (e.g. Stability only with gyro). */
export function leversForProfile(levers: readonly Lever[], profile: Pick<Profile, 'aimingSources'>): Lever[] {
  return levers.filter(
    (lever) => lever.aimingSources === undefined || lever.aimingSources.some((s) => profile.aimingSources.includes(s)),
  );
}
