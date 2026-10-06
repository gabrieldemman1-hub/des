import type { Confidence } from '../../content/schema';

/** What each confidence label is called, and what it promises. Sources explains them in full. */
export const CONFIDENCE: Record<Confidence, { word: string; meaning: string }> = {
  official: { word: 'Official', meaning: 'XIM says it. The footnotes quote XIM’s own words.' },
  expert: { word: 'Expert', meaning: 'An expert source says it, in material made for the XIM MATRIX.' },
  contested: { word: 'Contested', meaning: 'Sources disagree. Both sides are cited.' },
  reasoned: {
    word: 'Reasoned',
    meaning: 'Primer works it out from the cited words, and shows how. Check it in game before you rely on it.',
  },
  gap: { word: 'Gap', meaning: 'No source says it. Primer says so instead of guessing.' },
};

export const DIRECTION: Record<'raise' | 'lower' | 'depends', string> = {
  raise: 'Raise',
  lower: 'Lower',
  depends: 'It depends',
};

/** How a dial says to move a setting toward one of its ends. */
export const MOVE: Record<'raise' | 'lower' | 'on' | 'off', string> = {
  raise: 'Raise',
  lower: 'Lower',
  on: 'Turn on',
  off: 'Turn off',
};

export const AIMING_SOURCE: Record<'mouse' | 'gyro' | 'thumbstick', string> = {
  mouse: 'mouse',
  gyro: 'motion (gyro)',
  thumbstick: 'thumbstick',
};
