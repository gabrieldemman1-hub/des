import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Statement } from '../../../knowledge/index';
import { KnowledgeContext } from '../state/knowledge-context';
import { emptyKnowledge } from '../test/fixtures';
import { StatementView } from './StatementView';

function show(statement: Statement) {
  return render(
    <KnowledgeContext value={emptyKnowledge}>
      <StatementView statement={statement} />
    </KnowledgeContext>,
  );
}

describe('StatementView', () => {
  it('shows each citation’s note under its quote, with the source and its tier', () => {
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

    const items = within(screen.getByRole('list', { name: 'Sources' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    // No note: just the quote and the source.
    expect(items[0]).toHaveTextContent('“Every game that XIM MATRIX supports');
    expect(items[0]!.querySelector('.citation-note')).toBeNull();
    expect(within(items[0]!).getByRole('link', { name: /XIM MATRIX User Guide/ })).toHaveAttribute(
      'href',
      'https://guide.xim.tech/Game-Settings/#standard',
    );
    expect(items[0]).toHaveTextContent('Official');

    // With a note: the note follows the quote, so a quote from another game's entry isn't
    // read as support for Destiny 2.
    const note = within(items[1]!).getByText('From the Apex Legends entry. The Destiny 2 entry has no such line.');
    expect(note).toHaveClass('citation-note');
    expect(items[1]!.querySelector('blockquote')?.compareDocumentPosition(note)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(items[1]).toHaveTextContent('Community expert');
    expect(items[1]).toHaveTextContent('XIM MATRIX era');
  });

  it('says a reasoned statement applies XIM’s definitions only when it cites them', () => {
    const { unmount } = show({
      text: 'Raise Precision.',
      confidence: 'reasoned',
      reasoning: 'Fine aim.',
      citations: [{ source: 'xim-guide', url: 'https://guide.xim.tech/Aim-Settings/', quote: 'Controls fine aim behavior' }],
    });
    expect(screen.getByText('Worked out from XIM’s definitions, not stated by a source.')).toBeInTheDocument();
    unmount();

    show({ text: 'Pulse rifles are tracking weapons.', confidence: 'reasoned', reasoning: 'Bursts.', citations: [], caveat: 'No source.' });
    expect(screen.getByText('Worked out by Dialed, not stated by any source.')).toBeInTheDocument();
    expect(screen.queryByText(/from XIM’s definitions/)).not.toBeInTheDocument();
    expect(screen.getByText(/No source\./)).toBeInTheDocument();
  });
});
