import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { knowledge } from '../../../../knowledge/index';
import { createKnowledgeApi } from '../../state/knowledge-context';
import { STORAGE_KEY } from '../../state/storage';
import { sampleData, sampleLoadout } from '../../test/fixtures';
import { MemoryStorage } from '../../test/memory-storage';
import { renderApp } from '../../test/render';

const real = createKnowledgeApi(knowledge);
const ARCHIVE = 'https://web.archive.org/web/20260609015510/https://help.bungie.net/hc/en-us/articles/360049517431-Destiny-Account-Restrictions-and-Banning-Policies';

function render(path: string) {
  const data = sampleData({ loadouts: [sampleLoadout()] });
  return renderApp({ path, knowledge: real, storage: new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) }) });
}

describe('Build step 1: Bungie’s account policy', () => {
  it('shows the Bungie note with a Bungie badge, never an Official one', async () => {
    const { user } = render('/build/l1/destiny-2');
    const note = knowledge.game.notes.find((n) => n.id === 'bungie-adapter-policy')!;
    expect(note.statement.confidence).toBe('publisher');

    const before = screen.getByRole('region', { name: 'Before you start' });
    const title = within(before).getByText(note.title);
    const card = title.closest('details')!;
    const badge = within(card).getByText('Bungie', { selector: '.badge' });
    expect(badge).toHaveTextContent('Confidence: Bungie');
    expect(badge).toHaveClass('badge-publisher');
    expect(card.querySelector('.badge-official')).toBeNull();
    expect(within(card).queryByText('Official', { selector: '.badge' })).not.toBeInTheDocument();

    // A tap opens Bungie's words, the caveat, and the archived page they are quoted from.
    expect(within(card).getByText(note.statement.text)).not.toBeVisible();
    await user.click(title);
    expect(within(card).getByText(note.statement.text)).toBeVisible();
    expect(card).toHaveTextContent(`Caveat: ${note.statement.caveat!}`);
    const sources = within(card).getByRole('list', { name: 'Sources' });
    const bungie = within(sources).getByRole('link', { name: /Destiny Account Restrictions and Banning Policies/ });
    expect(bungie).toHaveAttribute('href', ARCHIVE);
    expect(bungie.closest('li')).toHaveTextContent('Game publisher · not XIM');
    // XIM's own words are there for context, marked as XIM's.
    expect(within(sources).getByRole('link', { name: /XIM MATRIX User Guide/ }).closest('li')).toHaveTextContent(
      'XIM’s own guide',
    );
  });
});
