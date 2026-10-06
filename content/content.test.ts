import { describe, expect, it } from 'vitest';
import { aimStyles, guideMap, names, placementOf, screens, settings, sources } from './index';
import { checkContent } from './integrity';
import type { Statement } from './schema';
import { Statement as StatementSchema } from './schema';

describe('content', () => {
  it('loads every file against the schema', () => {
    expect(settings.length).toBeGreaterThanOrEqual(50);
    expect(aimStyles.map((s) => s.id)).toEqual(['precision-hold', 'snap', 'tracking']);
    expect(sources.length).toBeGreaterThan(0);
    expect(names.length).toBeGreaterThan(0);
  });

  it('passes the cross-file checks', () => {
    expect(checkContent({ sources, settings, aimStyles, names, guideMap })).toEqual([]);
  });

  it('numbers the screens in the guide’s order', () => {
    expect(screens.map(({ screen }) => screen.name).slice(0, 4)).toEqual([
      'Dashboard',
      'Identity',
      'Game Settings',
      'Aim Settings',
    ]);
    expect(placementOf('easing')).toMatchObject({ number: 4, group: 'Smoothing', screen: { id: 'aim-settings' } });
  });
});

describe('statement rules', () => {
  const base: Statement = { text: 'x', confidence: 'official', citations: [] };
  const cite = { source: 'xim-guide', url: 'https://guide.xim.tech/Aim-Settings/', quote: 'q' };

  it('needs a citation for official and expert, two for contested', () => {
    expect(StatementSchema.safeParse(base).success).toBe(false);
    expect(StatementSchema.safeParse({ ...base, citations: [cite] }).success).toBe(true);
    expect(StatementSchema.safeParse({ ...base, confidence: 'contested', citations: [cite] }).success).toBe(false);
  });

  it('needs reasoning for reasoned, and no citations for gap', () => {
    expect(StatementSchema.safeParse({ ...base, confidence: 'reasoned' }).success).toBe(false);
    expect(StatementSchema.safeParse({ ...base, confidence: 'reasoned', reasoning: 'because' }).success).toBe(true);
    expect(StatementSchema.safeParse({ ...base, confidence: 'gap', citations: [cite] }).success).toBe(false);
  });

  it('flags the old app’s words, unknown sources and stray settings', () => {
    const setting = settings[0]!;
    const problems = checkContent({
      sources,
      aimStyles: [],
      names: [],
      guideMap: { chapters: [{ id: 'c', name: 'C', screens: [{ id: 's', name: 'S', guideUrl: 'https://guide.xim.tech/', groups: [{ settings: [setting.id, 'nope'] }] }] }] },
      settings: [
        {
          ...setting,
          summary: 'Set it on your config sheet.',
          plainWords: [{ text: 'x', confidence: 'official', citations: [{ ...cite, source: 'nowhere' }] }],
        },
      ],
    });
    expect(problems.join('\n')).toMatch(/summary: mentions the old app/);
    expect(problems.join('\n')).toMatch(/unknown source "nowhere"/);
    expect(problems.join('\n')).toMatch(/map.json: unknown setting "nope"/);
  });
});
