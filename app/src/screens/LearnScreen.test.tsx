import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { knowledge } from '../../../knowledge/index';
import { createKnowledgeApi } from '../state/knowledge-context';
import { sampleData } from '../test/fixtures';
import { MemoryStorage } from '../test/memory-storage';
import { renderApp } from '../test/render';
import { STORAGE_KEY } from '../state/storage';

const real = createKnowledgeApi(knowledge);

describe('Explain a concept', () => {
  it('lists the aim styles and every setting, grouped by category', () => {
    renderApp({ path: '/learn', knowledge: real });
    expect(screen.getByRole('heading', { level: 1, name: 'Explain a concept' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tracking.*Pulse Rifle/ })).toHaveAttribute('href', '/learn/styles/tracking');
    const smoothing = screen.getByRole('region', { name: 'Smoothing' });
    expect(within(smoothing).getByRole('link', { name: /^Easing/ })).toHaveAttribute('href', '/learn/easing');
    const cards = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.match(/^\/learn\/(?!styles\/)/));
    expect(cards).toHaveLength(knowledge.glossary.terms.length);
  });

  it('filters the settings as you search, and says when nothing matches', async () => {
    const { user } = renderApp({ path: '/learn', knowledge: real });
    const search = screen.getByRole('searchbox', { name: 'Search settings' });

    await user.type(search, 'easing');
    expect(screen.getByRole('status')).toHaveTextContent(/settings? found/);
    expect(screen.getByRole('link', { name: /^Easing/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Deadzone/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Aim styles/ })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzzz');
    expect(screen.getByRole('heading', { name: 'Nothing matches' })).toBeInTheDocument();
  });

  it('shows a setting with XIM’s definition, its sources and related settings', async () => {
    const { user } = renderApp({ path: '/learn/easing', knowledge: real });
    const easing = knowledge.glossary.terms.find((t) => t.id === 'easing')!;
    expect(screen.getByRole('heading', { level: 1, name: easing.name })).toBeInTheDocument();
    const definition = screen.getByRole('region', { name: 'XIM’s definition' });
    expect(definition).toHaveTextContent(easing.definition.text);
    expect(within(definition).getByRole('list', { name: 'Sources' })).toBeInTheDocument();

    const related = screen.getByRole('region', { name: 'Related settings' });
    const [first] = within(related).getAllByRole('link');
    if (!first) throw new Error('Easing has no related settings');
    const name = first.textContent ?? '';
    await user.click(first);
    expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument();
  });

  it('gives the hand-cannon (snap) advice with its direction and the Easing caveat', () => {
    renderApp({ path: '/learn/styles/snap', knowledge: real });
    expect(screen.getByRole('heading', { level: 1, name: 'Snap' })).toBeInTheDocument();
    expect(screen.getByText(/Hand Cannon/)).toBeInTheDocument();
    const easing = screen.getAllByRole('listitem').find((li) => within(li).queryByRole('link', { name: 'Easing' }));
    expect(easing).toBeDefined();
    expect(easing).toHaveTextContent('Lower');
    expect(easing).toHaveTextContent(/official wording is ambiguous/);
  });

  it('hides gyro-only settings for a mouse player, and says so', () => {
    renderApp({ path: '/learn/styles/precision-hold', knowledge: real });
    expect(screen.queryByRole('link', { name: 'Stability' })).not.toBeInTheDocument();
    expect(screen.getByText(/hidden, because your profile says you aim with mouse/)).toBeInTheDocument();
  });

  it('shows gyro-only settings when the profile aims with gyro', () => {
    const data = sampleData();
    data.profile.aimingSources = ['mouse', 'gyro'];
    renderApp({
      path: '/learn/styles/precision-hold',
      knowledge: real,
      storage: new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) }),
    });
    expect(screen.getByRole('link', { name: 'Stability' })).toBeInTheDocument();
  });

  it('treats unknown settings and aim styles as not found', () => {
    renderApp({ path: '/learn/not-a-setting', knowledge: real });
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Explain a concept');
  });

  it('sends the old placeholder address to the real screen', () => {
    renderApp({ path: '/flows/learn', knowledge: real });
    expect(screen.getByRole('heading', { level: 1, name: 'Explain a concept' })).toBeInTheDocument();
  });
});
