import { describe, expect, it } from 'vitest';
import { aimStyles, dials, dialsFor, guideMap, names, placementOf, screens, settingById, settings, sources } from './index';
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
    expect(checkContent({ sources, settings, aimStyles, names, guideMap, dials })).toEqual([]);
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

describe('the dials', () => {
  it('start with Sensitivity, as XIM says, and each end is XIM’s words, not a mode name', () => {
    expect(dials.map((d) => d.id)).toEqual(['sensitivity', 'standard-smoothing', 'classic-smoothing', 'quantization']);
    for (const dial of dials) {
      expect(dial.start.confidence, `${dial.id} start`).toBe('official');
      expect(`${dial.ends.a} ${dial.ends.b}`).not.toMatch(/\b(balanced|max|maximum|mode|less aim assist|more aim assist)\b/i);
    }
  });

  it('move real settings, each toward at least one end, and each setting knows its dials', () => {
    for (const dial of dials) {
      for (const lever of dial.levers) {
        expect(settingById(lever.settingId), `${dial.id}: ${lever.settingId}`).toBeDefined();
        expect(lever.a ?? lever.b, `${dial.id}: ${lever.settingId}`).not.toBeNull();
      }
    }
    expect(dialsFor('easing').map((d) => d.id)).toEqual(['standard-smoothing']);
    expect(dialsFor('polling-rate')).toEqual([]);
  });

  it('say so when no source gives a direction', () => {
    const stability = dials.find((d) => d.id === 'standard-smoothing')!.levers.find((l) => l.settingId === 'stability')!;
    expect(stability.a?.direction).toBe('raise');
    expect(stability.b).toBeNull();
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
      dials: [],
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
