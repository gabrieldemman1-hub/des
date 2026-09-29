import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONFIDENCE_LEVELS, knowledge } from '../../../knowledge/index';
import { CONFIDENCE_INFO } from '../content/labels';
import { createKnowledgeApi } from '../state/knowledge-context';
import { renderApp } from '../test/render';

const real = createKnowledgeApi(knowledge);

describe('Sources', () => {
  it('lists Bungie as a game publisher, for Destiny 2 account policy only', () => {
    renderApp({ path: '/sources', knowledge: real });
    const link = screen.getByRole('link', { name: /Destiny Account Restrictions and Banning Policies/ });
    expect(link).toHaveAttribute(
      'href',
      'https://help.bungie.net/hc/en-us/articles/360049517431-Destiny-Account-Restrictions-and-Banning-Policies',
    );
    const card = link.closest('li')!;
    expect(within(card).getByText('Game publisher (not XIM)')).toHaveClass('tag');
    expect(card).toHaveTextContent('Bungie');
    expect(card).toHaveTextContent('Destiny 2 account policy only, never XIM MATRIX settings.');

    // The intro says what each kind of source is used for, Bungie included.
    expect(screen.getByText(/Dialed only uses the sources below\./)).toHaveTextContent(
      'Bungie’s policy page is used only for Destiny 2 account policy, never for XIM MATRIX settings.',
    );
  });

  it('shows every confidence label in the legend, with Bungie last and apart from Official', () => {
    renderApp({ path: '/sources', knowledge: real });
    expect(CONFIDENCE_LEVELS).toEqual(['official', 'expert', 'contested', 'reasoned', 'gap', 'publisher']);
    expect(screen.getByRole('heading', { level: 2, name: 'Confidence labels' })).toBeInTheDocument();
    const hint = screen.getByText(/^Each badge in Dialed shows one of these labels\./);
    expect(hint).toHaveTextContent(
      'Each badge in Dialed shows one of these labels. Official, expert, contested and Bungie statements cite their sources. Reasoned ones either cite the XIM sources they are worked out from, or say they were worked out by Dialed, with no source. Gaps cite no source and say so.',
    );
    const legend = hint.nextElementSibling as HTMLElement;
    const badges = within(legend).getAllByText((_, el) => !!el?.classList.contains('badge'));
    expect(badges.map((b) => b.textContent)).toEqual(CONFIDENCE_LEVELS.map((l) => `Confidence: ${CONFIDENCE_INFO[l].label}`));

    const bungie = within(legend).getByText('Bungie', { selector: '.badge' });
    expect(bungie).toHaveClass('badge-publisher');
    expect(bungie).not.toHaveClass('badge-official');
    expect(bungie.closest('li')).toHaveTextContent('Bungie, Destiny 2’s publisher, states it. Not an XIM statement.');
    // Its own shape: not the Official dot.
    expect(bungie.querySelector('svg circle')).toBeNull();
    expect(bungie.querySelector('svg path')).not.toBeNull();
  });
});
