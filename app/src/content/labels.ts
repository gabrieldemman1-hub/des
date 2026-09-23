import type { AimStyleId, Confidence } from '../../../knowledge/index';

/** Confidence labels and their one-line meanings (CONCEPT.md §5 and §8). */
export const CONFIDENCE_INFO: Record<Confidence, { label: string; meaning: string }> = {
  official: { label: 'Official', meaning: 'XIM states it.' },
  expert: { label: 'Expert', meaning: 'XIM Central states it, in MATRIX-era content.' },
  contested: { label: 'Contested', meaning: 'Sources disagree, and both positions are shown.' },
  reasoned: {
    label: 'Reasoned',
    meaning: 'Worked out from XIM’s definitions, not stated by a source. It gives a direction, never an invented number.',
  },
  gap: { label: 'Gap', meaning: 'No sourced MATRIX-era answer yet, and the app says so.' },
};

export const SOURCE_TIER_LABELS = {
  official: 'Official',
  'official-by-reference': 'Official (by reference)',
  'official-inferred': 'Official (inferred)',
  expert: 'Community expert',
} as const;

/** Fallback names when aim-styles.json doesn't have the style yet (CONCEPT.md §6). */
export const AIM_STYLE_NAMES: Record<AimStyleId, string> = {
  tracking: 'Tracking',
  snap: 'Snap / peek',
  'precision-hold': 'Precision hold',
};

export const PLATFORM_LABELS = { xbox: 'Xbox', pc: 'PC' } as const;

export const FOCUS_LABELS = { crucible: 'Crucible', pve: 'PvE', both: 'Both' } as const;

export const STYLE_LABELS = { aggressive: 'Aggressive', balanced: 'Balanced', precise: 'Precise' } as const;

export const SENSITIVITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' } as const;

/** Feel preference, 1 (snappy) to 5 (smooth). */
export const FEEL_LABELS = { 1: 'Snappy', 2: 'Lean snappy', 3: 'Middle', 4: 'Lean smooth', 5: 'Smooth' } as const;
