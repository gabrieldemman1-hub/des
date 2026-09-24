/**
 * The four flows: the line each Home card shows, and the fuller account (CONCEPT.md §5 wording)
 * that a flow's index screen keeps a tap away under "How this works".
 */
export type FlowId = 'build' | 'tune' | 'troubleshoot' | 'learn';

export interface FlowSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Flow {
  id: FlowId;
  /** "Flow A" etc. */
  code: string;
  /** Card and screen title. */
  title: string;
  /** The question the flow answers, in the user's words. */
  question: string;
  /** One line for the Home card. */
  summary: string;
  /** Where the Home card leads (an old /flows/<id> address redirects here too). */
  to: string;
  sections: FlowSection[];
}

export const FLOWS: readonly Flow[] = [
  {
    id: 'build',
    to: '/build',
    code: 'Flow A',
    title: 'Build my config',
    question: '"Build my config"',
    summary: 'A guided, step-by-step setup in dependency order, with the reasoning and the source at every step.',
    sections: [
      {
        paragraphs: [
          'A step-by-step walkthrough that builds a complete Destiny 2 configuration from the ground up, in dependency order. At each step you see the recommendation for you (based on your profile), the reasoning, and the source.',
          'The end state is a summary sheet you work through in XIM MATRIX Manager and in Destiny 2’s own settings.',
        ],
      },
      {
        heading: 'The order it follows',
        paragraphs: ['Upper layers are meaningless if the lower ones are wrong, so the configuration is always built in this order:'],
        bullets: [
          'In-game Destiny 2 settings: the values XIM’s Smart Translation expects.',
          'MATRIX global settings and hardware foundation: controller output, mouse DPI, polling rate, current firmware and Smart Translator, light notifications.',
          'Aim config (Hip and ADS): sensitivity in cm/360, smoothing, aiming curve, Y Scale, quantization, velocity mapping, deadzone, Hip vs ADS inheritance.',
        ],
      },
      {
        heading: 'One config sheet per loadout',
        paragraphs: [
          'Each loadout you save gets its own config sheet, tuned toward that loadout’s main aim style. Weapon-aware guidance is labelled reasoned: a direction worked out from XIM’s definitions, never an invented number.',
        ],
      },
    ],
  },
  {
    id: 'tune',
    to: '/tune',
    code: 'Flow B',
    title: 'Tune my config',
    question: '"What should I change?"',
    summary: 'Enter your current settings and get targeted changes, ordered by impact, one at a time.',
    sections: [
      {
        paragraphs: [
          'You enter the settings you have now. Dialed compares them with the evidence and your profile, flags what’s off (and what’s fine), and proposes targeted changes.',
          'Changes come in impact order, one at a time, so you can tell what each one did. Your current settings are the starting point: Dialed says what to change, not to start over.',
        ],
      },
    ],
  },
  {
    id: 'troubleshoot',
    to: '/troubleshoot',
    code: 'Flow C',
    title: 'Troubleshoot by feel',
    question: '"My aim feels…"',
    summary: 'Rule out setup mistakes first, then go from what you feel to the setting responsible.',
    sections: [
      {
        paragraphs: [
          'For when something feels wrong but you don’t know which setting is responsible. Setup mistakes are the best-documented causes of bad-feeling aim, so they get ruled out before anything is tuned.',
        ],
      },
      {
        heading: 'Stage 1: Setup check',
        paragraphs: ['A checklist built from XIM’s own troubleshooting, cm/360-validation and warning-light pages. Every item is sourced:'],
        bullets: [
          'Firmware and the Smart Translator are current.',
          'Destiny 2’s required in-game settings are exact.',
          'The DPI in your MATRIX Config matches your mouse.',
          'Your mouse actually reaches its polling rate.',
          'Nothing is changing real-world cm/360 before you judge sensitivity (a non-linear curve, quantization, or an Elite 2 stick curve on Xbox).',
          'Light notifications are switched on, and what they say.',
          'On PC with controller output: tools like Steam Input or DS4Windows may conflict.',
        ],
      },
      {
        heading: 'Stage 2: Symptom → setting',
        paragraphs: [
          'You pick what you feel, and Dialed points to the setting whose official definition describes that feel. It explains the mechanism and suggests one change.',
          'Where there’s no sourced MATRIX-era answer yet, Dialed says so. The flow ends with a guardrail: change one thing at a time.',
        ],
      },
    ],
  },
  {
    id: 'learn',
    to: '/learn',
    code: 'Flow D',
    title: 'Explain a concept',
    question: '"What does this actually do?"',
    summary: 'Plain-language, sourced explanations of every MATRIX setting and why it matters for your aim.',
    sections: [
      {
        paragraphs: ['A learn and glossary mode for the MATRIX’s own vocabulary. Each term shows:'],
        bullets: [
          'the official definition',
          'what it changes mechanically',
          'the official feel description, where the guide gives one',
          'which aim styles it likely matters for (labelled reasoned)',
        ],
      },
      {
        heading: 'Confusing names, untangled',
        paragraphs: [
          'For example, “Standard” is a smoothing mode, a sync method and a velocity-mapping mode: three unrelated things. And “Response” (a smoothing setting) is not the mouse “response rate”.',
          'The same explanations appear inline everywhere: every setting name in the other flows opens its explanation.',
        ],
      },
    ],
  },
];

export function flowById(id: string | undefined): Flow | undefined {
  return FLOWS.find((f) => f.id === id);
}
