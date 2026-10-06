import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { knowledge } from '../../../../knowledge/index';
import { createKnowledgeApi } from '../../state/knowledge-context';
import { renderApp } from '../../test/render';
import { SESSION_KEY, clearSessionStores } from './session-log';

const real = createKnowledgeApi(knowledge);
const { play } = knowledge;

describe('Play (Flow E)', () => {
  beforeEach(() => clearSessionStores());

  it('lists the loop first, then the frameworks by moment, the loadout plans, the maps and the mindset', () => {
    renderApp({ path: '/play', knowledge: real });
    expect(screen.getByRole('heading', { level: 1, name: 'Play' })).toBeInTheDocument();
    expect(document.title).toBe('Play · Dialed');
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Play' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    const start = play.frameworks.find((f) => f.id === play.about.startWith)!;
    const startHere = screen.getByRole('region', { name: 'Start here' });
    expect(within(startHere).getByRole('link')).toHaveAttribute('href', `/play/frameworks/${start.id}`);
    expect(startHere).toHaveTextContent(start.rule);

    // Every framework has a card, each under its moment, and the loop appears only once.
    for (const framework of play.frameworks) {
      expect(screen.getAllByRole('link', { name: new RegExp(`^${framework.title}`) })).toHaveLength(1);
    }
    const fight = screen.getByRole('region', { name: 'In the fight' });
    expect(within(fight).getByRole('link', { name: /^The advantage check/ })).toHaveAttribute(
      'href',
      '/play/frameworks/advantage-check',
    );
    expect(within(fight).queryByRole('link', { name: /^Control, peek, challenge/ })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'After a death' })).toHaveTextContent('10 seconds');

    expect(within(screen.getByRole('region', { name: 'Loadout plans' })).getByRole('link', { name: /120 hand cannon/ })).toHaveAttribute(
      'href',
      '/play/loadouts/120-slug',
    );
    expect(within(screen.getByRole('region', { name: 'Maps' })).getByRole('link', { name: /Javelin-4/ })).toHaveAttribute(
      'href',
      '/play/maps/javelin-4',
    );
    const mindset = screen.getByRole('region', { name: /Mindset/ });
    expect(within(mindset).getAllByRole('link')).toHaveLength(play.principles.length);
    expect(screen.getByRole('region', { name: 'This session' })).toHaveTextContent('No deaths tagged yet');
  });

  it('explains where Play comes from, with the four basis tags', async () => {
    const { user } = renderApp({ path: '/play', knowledge: real });
    await user.click(screen.getByText('How this works'));
    const legend = screen.getByRole('list', { name: 'What the basis tags mean' });
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Fundamental'),
      expect.stringContaining('Destiny 2'),
      expect.stringContaining('Map'),
      expect.stringContaining('Dialed'),
    ]);
    expect(screen.getByText(/Official, Expert and Reasoned labels don’t apply/)).toBeInTheDocument();
  });

  it('shows a framework with its rule, numbered cues, checks, mistakes and the ideas behind it', async () => {
    const { user } = renderApp({ path: '/play/frameworks/control-loop', knowledge: real });
    const loop = play.frameworks.find((f) => f.id === 'control-loop')!;
    expect(screen.getByRole('heading', { level: 1, name: loop.title })).toBeInTheDocument();
    expect(document.querySelector('.back-link')).toHaveTextContent('Play');
    expect(screen.getByText(loop.rule)).toHaveClass('play-rule');

    const steps = within(screen.getByRole('region', { name: 'The steps' })).getAllByRole('listitem');
    expect(steps.map((s) => s.querySelector('.play-cue')?.textContent)).toEqual(loop.steps.map((s) => s.cue));
    expect(steps[0]).toHaveTextContent(loop.steps[0]!.action);

    expect(screen.getByRole('region', { name: 'Ask yourself' })).toHaveTextContent(loop.checks[0]!);
    expect(screen.getByRole('region', { name: 'What usually goes wrong' })).toHaveTextContent(loop.mistakes[0]!);
    expect(screen.getByRole('region', { name: 'Notes' })).toHaveTextContent(/left-hand or right-hand peek/);
    expect(screen.queryByRole('region', { name: 'Tally this death' })).not.toBeInTheDocument();

    const ideas = screen.getByRole('region', { name: 'The ideas behind it' });
    await user.click(within(ideas).getByRole('link', { name: 'Advantage before aim' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Advantage before aim' })).toBeInTheDocument();
    expect(screen.getByText('Take fights you have already won.')).toHaveClass('lede');
    expect(screen.getByRole('region', { name: 'What it looks like in a round' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Frameworks that use it' })).getByRole('link', { name: loop.title })).toHaveAttribute(
      'href',
      '/play/frameworks/control-loop',
    );
  });

  it('tallies a death from "Tag the death", counts it on the index and picks the next focus in the review', async () => {
    const { user } = renderApp({ path: '/play/frameworks/after-death', knowledge: real });
    const tally = screen.getByRole('region', { name: 'Tally this death' });
    await user.click(within(tally).getByRole('button', { name: 'Tag a death as Overexposed' }));
    await user.click(within(tally).getByRole('button', { name: 'Tag a death as Overexposed' }));
    await user.click(within(tally).getByRole('button', { name: 'Tag a death as Alone' }));
    expect(within(tally).getByLabelText('2 tagged')).toHaveTextContent('2');
    // Not part of the app's main data (and so not in a backup): it lives under its own key.
    expect(localStorage.getItem(SESSION_KEY)).toContain('"overexposed":2');

    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Play' }));
    const session = screen.getByRole('region', { name: 'This session' });
    expect(session).toHaveTextContent('3 deaths tagged');
    await user.click(within(session).getByRole('link'));

    expect(screen.getByRole('heading', { level: 1, name: 'Death tally' })).toBeInTheDocument();
    const focus = screen.getByRole('region', { name: 'Next focus' });
    expect(focus).toHaveTextContent('Overexposed');
    expect(within(focus).getByRole('link', { name: 'Set, peek, shoot, reset' })).toHaveAttribute('href', '/play/frameworks/peek-loop');

    // A tap can be taken back here, and the focus follows the count.
    await user.click(screen.getByRole('button', { name: 'Remove one Overexposed' }));
    expect(screen.getByRole('region', { name: 'Next focus (tied)' })).toHaveTextContent('Alone');

    await user.click(screen.getByRole('button', { name: 'Start a new session' }));
    await user.click(screen.getByRole('button', { name: 'Start new session' }));
    expect(screen.queryByRole('region', { name: /Next focus/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing tagged yet this session/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a new session' })).toBeDisabled();
  });

  it('shows the loadout plan with the weapon names, the three bands and the rules', () => {
    renderApp({ path: '/play/loadouts/120-slug', knowledge: real });
    expect(screen.getByRole('heading', { level: 1, name: '120 hand cannon + slug shotgun' })).toBeInTheDocument();
    const weapons = screen.getByRole('region', { name: 'The weapons' });
    expect(weapons).toHaveTextContent('Hand Cannon');
    expect(weapons).toHaveTextContent('Shotgun');
    expect(within(weapons).getAllByText('Destiny 2', { selector: '.tag' }).length).toBeGreaterThan(0);
    const bands = within(screen.getByRole('region', { name: 'Range bands' })).getAllByRole('listitem');
    expect(bands.map((b) => b.querySelector('.play-cue')?.textContent)).toEqual([
      'Band one: slug',
      'Band two: hand cannon',
      'Band three: theirs',
    ]);
    expect(screen.getByRole('region', { name: 'Rules' })).toHaveTextContent(/Never start a hand cannon duel inside slug range/);
    expect(within(screen.getByRole('region', { name: 'Goes with' })).getByRole('link', { name: 'Javelin-4' })).toHaveAttribute(
      'href',
      '/play/maps/javelin-4',
    );
  });

  it('shows the map card with callouts by kind, the spots, the plan and what to confirm', () => {
    renderApp({ path: '/play/maps/javelin-4', knowledge: real });
    expect(screen.getByRole('heading', { level: 1, name: 'Javelin-4' })).toBeInTheDocument();
    expect(document.title).toBe('Javelin-4 map card · Dialed');
    const callouts = screen.getByRole('region', { name: 'Callouts' });
    expect(within(callouts).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Spawns',
      'The middle',
      'Interior',
      'Exterior',
    ]);
    expect(within(callouts).getAllByRole('term').map((t) => t.textContent)).toContain('Rocket Basis: Map');

    const spots = within(screen.getByRole('region', { name: 'Spots to hold' })).getAllByRole('listitem');
    expect(spots[0]).toHaveTextContent('Generators doorway, looking at Rocket');
    expect(spots[0]).toHaveTextContent('Either spawn');
    expect(spots[1]).toHaveTextContent('Fuel spawn');
    expect(spots[0]).toHaveTextContent(/Watched by/);

    expect(screen.getByRole('region', { name: 'The plan' })).toHaveTextContent('Round start');
    expect(screen.getByRole('region', { name: 'Confirm in a private match' })).toHaveTextContent(/Pace off your slug/);
  });

  it('treats unknown frameworks, principles, plans and maps as not found', () => {
    for (const path of ['/play/frameworks/nope', '/play/mindset/nope', '/play/loadouts/nope', '/play/maps/nope', '/play/nope']) {
      const { unmount } = renderApp({ path, knowledge: real });
      expect(screen.getByRole('heading', { level: 1, name: 'Not found' })).toBeInTheDocument();
      unmount();
    }
  });

  it('says so when the coaching material has not loaded', () => {
    renderApp({ path: '/play' });
    expect(screen.getByRole('heading', { name: 'The coaching material isn’t ready yet' })).toBeInTheDocument();
  });
});
