import { describe, expect, it } from 'vitest';
import { EASING_CAVEAT as INTEGRITY_EASING_CAVEAT } from '../knowledge/integrity';
import { EASING_CAVEAT, releaseBlockers } from './lib/release.mjs';

describe('release check', () => {
  it('uses the same Easing caveat as the integrity checks', () => {
    expect(EASING_CAVEAT).toBe(INTEGRITY_EASING_CAVEAT);
  });

  it('lists every statement still waiting on the in-game Easing test', () => {
    const json = {
      styles: [
        {
          id: 'snap',
          levers: [
            { termId: 'easing', statement: { text: 'Lower Easing.', caveat: `${EASING_CAVEAT} Assumes Standard.` } },
            { termId: 'response', statement: { text: 'Raise Response.', caveat: 'Assumes Standard.' } },
          ],
        },
      ],
      preferences: [{ input: 'feel', statement: { text: 'Raise Easing.', caveat: EASING_CAVEAT } }],
    };
    expect(releaseBlockers('knowledge/x.json', json)).toEqual([
      {
        file: 'knowledge/x.json',
        entryId: 'snap',
        path: 'styles[0].levers[0].statement',
        reason: 'Easing direction not yet confirmed in-game',
      },
      {
        file: 'knowledge/x.json',
        entryId: 'feel',
        path: 'preferences[0].statement',
        reason: 'Easing direction not yet confirmed in-game',
      },
    ]);
  });

  it('passes once no caveat is left', () => {
    expect(releaseBlockers('knowledge/x.json', { notes: [{ id: 'a', statement: { caveat: 'Other.' } }] })).toEqual([]);
  });
});
