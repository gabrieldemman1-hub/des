import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Statement } from '../../../knowledge/index';
import { KnowledgeContext } from '../state/knowledge-context';
import { emptyKnowledge } from '../test/fixtures';
import { StatementView } from './StatementView';
import { guideLocation, hoistedCaveat, quotesShownAbove } from './statements';

type ViewProps = Omit<Parameters<typeof StatementView>[0], 'statement'>;

function show(statement: Statement, props: ViewProps = {}) {
  return render(
    <KnowledgeContext value={emptyKnowledge}>
      <StatementView statement={statement} {...props} />
    </KnowledgeContext>,
  );
}

const GUIDE = 'https://guide.xim.tech/Aim-Settings/#standard';
const WORKED_OUT = 'Worked out from XIM’s definitions, not stated by a source.';

function official(text: string, quote = text, url = GUIDE): Statement {
  return { text, confidence: 'official', citations: [{ source: 'xim-guide', url, quote }] };
}

describe('StatementView', () => {
  it('groups citations by source, with each note under its quote and a tag only where the tier differs', () => {
    show({
      text: 'Plan for Standard sync.',
      confidence: 'reasoned',
      reasoning: 'Destiny 2’s entry has no Custom line.',
      citations: [
        {
          source: 'xim-guide',
          url: 'https://guide.xim.tech/Game-Settings/#standard',
          quote: 'Every game that XIM MATRIX supports has the standard game settings synchronization option.',
        },
        {
          source: 'xim-central',
          url: 'https://www.youtube.com/watch?v=abc',
          quote: 'This game supports Custom In-Game Settings.',
          matrixEra: true,
          note: 'From the Apex Legends entry. The Destiny 2 entry has no such line.',
        },
      ],
    });

    const sources = screen.getByRole('list', { name: 'Sources' });
    const [guide, central] = within(sources).getAllByRole('listitem').filter((li) => li.parentElement === sources);
    expect(guide).toBeDefined();
    expect(central).toBeDefined();

    // One page: the source's line is the link.
    expect(within(guide!).getByRole('link', { name: /XIM MATRIX User Guide/ })).toHaveAttribute(
      'href',
      'https://guide.xim.tech/Game-Settings/#standard',
    );
    expect(guide).toHaveTextContent('“Every game that XIM MATRIX supports');
    expect(guide!.querySelector('.citation-note')).toBeNull();
    // A reasoned statement quoting XIM's own guide: the tag says so, in provenance words.
    expect(guide).toHaveTextContent('XIM’s own guide');
    expect(guide).not.toHaveTextContent('Official');

    // With a note: the note follows the quote, so a quote from another game's entry isn't
    // read as support for Destiny 2.
    const note = within(central!).getByText('From the Apex Legends entry. The Destiny 2 entry has no such line.');
    expect(note).toHaveClass('citation-note');
    expect(central!.querySelector('blockquote')?.compareDocumentPosition(note)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(central).toHaveTextContent('Independent creator');
    expect(central).toHaveTextContent('XIM MATRIX era');
  });

  it('leaves the tier tag out when it says no more than the badge', () => {
    show(official('Smoothing filters noise.'));
    const sources = screen.getByRole('list', { name: 'Sources' });
    expect(sources).not.toHaveTextContent('Official');
    expect(sources).not.toHaveTextContent('XIM’s own guide');
    expect(within(sources).getByRole('link', { name: /XIM MATRIX User Guide/ })).toBeInTheDocument();
  });

  it('says where in the guide several passages from one page are, once', () => {
    show({
      text: 'Easing acts from rest.',
      confidence: 'official',
      citations: [
        { source: 'xim-guide', url: GUIDE, quote: 'Specifies aim behavior from rest' },
        { source: 'xim-guide', url: GUIDE, quote: 'Higher values result in smoother transition from rest.' },
      ],
    });
    const sources = screen.getByRole('list', { name: 'Sources' });
    expect(within(sources).getAllByRole('link')).toHaveLength(1);
    expect(within(sources).getByText('Aim Settings › Standard')).toHaveClass('citation-where');
    expect(sources).toHaveTextContent('2 passages');
    expect(sources.querySelector('.citation-passages')).toHaveClass('is-many');
  });

  it('numbers several passages from one source, each linking to its own place in the guide', () => {
    show({
      text: 'Standard smoothing adapts to aim speed; Classic is static.',
      confidence: 'official',
      citations: [
        { source: 'xim-guide', url: 'https://guide.xim.tech/Aim-Settings/#standard', quote: 'Dynamic smoothing.' },
        { source: 'xim-guide', url: 'https://guide.xim.tech/Aim-Settings/#classic', quote: 'Static smoothing.' },
      ],
    });
    const sources = screen.getByRole('list', { name: 'Sources' });
    expect(within(sources).getAllByText('XIM MATRIX User Guide')).toHaveLength(1);
    expect(sources).toHaveTextContent('2 passages');
    const passages = sources.querySelector('.citation-passages')!;
    expect(passages).toHaveClass('is-many');
    const links = within(sources).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'XIM MATRIX User Guide: Aim Settings › Standard (opens in a new tab)',
      'XIM MATRIX User Guide: Aim Settings › Classic (opens in a new tab)',
    ]);
    expect(links[0]).toHaveAttribute('href', 'https://guide.xim.tech/Aim-Settings/#standard');
  });

  it('shows a passage quoted from two pages once, with both links', () => {
    const quote = 'Your XIM MATRIX is frequently being updated with new features.';
    show({
      text: 'Keep the firmware current.',
      confidence: 'official',
      citations: [
        { source: 'xim-guide', url: 'https://guide.xim.tech/Troubleshooting-Xbox/', quote },
        { source: 'xim-guide', url: 'https://guide.xim.tech/Troubleshooting-PC/', quote: `${quote} ` },
      ],
    });
    const sources = screen.getByRole('list', { name: 'Sources' });
    expect(within(sources).getAllByText(`“${quote}”`)).toHaveLength(1);
    expect(sources).not.toHaveTextContent('passages');
    expect(within(sources).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'XIM MATRIX User Guide: Troubleshooting Xbox (opens in a new tab)',
      'XIM MATRIX User Guide: Troubleshooting PC (opens in a new tab)',
    ]);
  });

  it('refers to the line above instead of quoting it again when the text is the quote', () => {
    show(official('Smoothing solves this by providing additional stability.'));
    expect(screen.getByText('Smoothing solves this by providing additional stability.')).toBeInTheDocument();
    expect(document.querySelector('blockquote')).toBeNull();
    expect(screen.getByText('The line above, quoted in full.')).toHaveClass('citation-repeat');
  });

  it('refers up to a passage another statement on the page already shows', () => {
    const definition = official('Specifies aim behavior from rest.', 'Specifies aim behavior from rest');
    const later: Statement = {
      text: 'It only acts as your aim starts moving from rest.',
      confidence: 'official',
      citations: [{ source: 'xim-guide', url: GUIDE, quote: 'Specifies aim behavior from rest' }],
    };
    const above = quotesShownAbove([definition, later]);
    expect(above.has(definition)).toBe(false);
    expect(above.get(later)?.has('specifies aim behavior from rest')).toBe(true);

    show(later, { shownAbove: above.get(later) });
    expect(document.querySelector('blockquote')).toBeNull();
    expect(screen.getByText('Quoted above: “Specifies aim behavior from rest”')).toHaveClass('citation-repeat');
  });

  it('says a reasoned statement was worked out inside a disclosure, and under a badge only when nothing is cited', () => {
    const cited: Statement = {
      text: 'Raise Precision.',
      confidence: 'reasoned',
      reasoning: 'Fine aim.',
      citations: [{ source: 'xim-guide', url: 'https://guide.xim.tech/Aim-Settings/', quote: 'Controls fine aim behavior' }],
    };
    // Under its badge, the page's legend says what Reasoned means; the reasoning stands alone.
    let view = show(cited);
    expect(screen.queryByText(/Worked out/)).not.toBeInTheDocument();
    expect(screen.getByText('Fine aim.')).toHaveClass('statement-reasoning');
    view.unmount();

    // In a disclosure (the badge is elsewhere), the reasoning opens with it.
    view = show(cited, { showBadge: false });
    expect(screen.getByText(`${WORKED_OUT} Fine aim.`)).toHaveClass('statement-reasoning');
    view.unmount();

    // Nothing cited: Dialed's own reading always says so.
    show({ text: 'Pulse rifles are tracking weapons.', confidence: 'reasoned', reasoning: 'Bursts.', citations: [], caveat: 'No source.' });
    expect(screen.getByText('Worked out by Dialed, not stated by any source. Bursts.')).toBeInTheDocument();
    expect(screen.queryByText(/from XIM’s definitions/)).not.toBeInTheDocument();
    expect(screen.getByText(/No source\./)).toBeInTheDocument();
  });

  it('can leave out the text and the caveat a card already shows', () => {
    show(
      { ...official('Start with Sensitivity.', 'Start with Sensitivity'), caveat: 'By feel.' },
      { showBadge: false, showText: false, showCaveat: false },
    );
    expect(screen.queryByText('Start with Sensitivity.')).not.toBeInTheDocument();
    expect(screen.queryByText(/By feel/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Sources' })).toBeInTheDocument();
  });
});

describe('guideLocation', () => {
  it('names the guide page and section from the link, and nothing for other sites', () => {
    expect(guideLocation('https://guide.xim.tech/Aim-Settings/#standard')).toBe('Aim Settings › Standard');
    expect(guideLocation('https://guide.xim.tech/Aim-Settings/#validating-cm360-accuracy')).toBe(
      'Aim Settings › Validating cm360 accuracy',
    );
    expect(guideLocation('https://guide.xim.tech/Game-Settings/#game-settings')).toBe('Game Settings');
    expect(guideLocation('https://guide.xim.tech/Troubleshooting-PC/')).toBe('Troubleshooting PC');
    expect(guideLocation('https://community.xim.tech/pub/xim-game-settings#X1101')).toBeUndefined();
    expect(guideLocation('not a url')).toBeUndefined();
  });
});

describe('hoistedCaveat', () => {
  const caveat = 'The official wording is ambiguous.';
  const withCaveat = (text: string): Statement => ({ ...official(text), caveat });

  it('is the caveat every statement with one shares, when at least two have it', () => {
    expect(hoistedCaveat([withCaveat('a'), official('b'), withCaveat('c')])).toBe(caveat);
    expect(hoistedCaveat([withCaveat('a'), official('b')])).toBeUndefined();
    expect(hoistedCaveat([withCaveat('a'), { ...official('b'), caveat: 'Another.' }])).toBeUndefined();
    expect(hoistedCaveat([])).toBeUndefined();
  });
});
