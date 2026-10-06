import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import { aimStyleById, settingById, settings } from '../content/index';
import AimStylePage from '../src/pages/aim-styles/[id].astro';
import HomePage from '../src/pages/index.astro';
import SettingPage from '../src/pages/settings/[id].astro';
import SourcesPage from '../src/pages/sources.astro';
import { aimStylePath, settingPath, sourcesPath } from '../src/lib/paths';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

/** Renders a page to a DOM document. */
async function render(page: Parameters<AstroContainer['renderToString']>[0], props = {}, path = '/des/') {
  const html = await container.renderToString(page, { props, request: new Request(`https://example.test${path}`) });
  return new JSDOM(html).window.document;
}

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('a setting page', () => {
  it('shows where the setting is on the map, then the evidence, with footnotes that match the notes', async () => {
    const doc = await render(SettingPage, { setting: settingById('easing') }, '/des/settings/easing/');
    expect(text(doc.querySelector('h1'))).toBe('Easing');
    expect(text(doc.querySelector('.path'))).toBe('4 Aim Settings › Smoothing');
    expect(doc.title).toBe('Easing · Primer');

    const headings = [...doc.querySelectorAll('article section > h2')].map(text);
    expect(headings.slice(0, 3)).toEqual(['Where it is in Manager', 'XIM’s definition', 'In plain words']);
    expect(headings).toContain('By aim style');
    expect(headings.at(-1)).toBe('Notes');

    // Every footnote number points at a note that exists, and the notes run 1, 2, 3 …
    const notes = [...doc.querySelectorAll('.notes li')].map((li) => li.id);
    expect(notes).toEqual(notes.map((_, i) => `note-${i + 1}`));
    for (const a of doc.querySelectorAll('a.fn')) {
      expect(notes).toContain(a.getAttribute('href')!.slice(1));
    }
    // Every statement carries a confidence label that links to its meaning.
    expect(doc.querySelectorAll('.st').length).toBe(doc.querySelectorAll('.st .conf').length);
    expect(doc.querySelector('.conf')?.getAttribute('href')).toMatch(
      new RegExp(`^${sourcesPath()}#(official|expert|contested|reasoned|gap)$`),
    );
  });

  it('prints a caveat in full once, and points back to it after that', async () => {
    const doc = await render(SettingPage, { setting: settingById('easing') }, '/des/settings/easing/');
    const caveats = [...doc.querySelectorAll('.st-caveat')];
    expect(caveats.filter((c) => c.id === 'caveat-1')).toHaveLength(1);
    const repeats = caveats.filter((c) => !c.id);
    expect(repeats.length).toBeGreaterThan(0);
    for (const r of repeats) expect(r.querySelector('a')?.getAttribute('href')).toMatch(/^#caveat-\d+$/);
  });

  it('puts the aim style first on each aim-style sentence', async () => {
    const doc = await render(SettingPage, { setting: settingById('easing') }, '/des/settings/easing/');
    const leads = [...doc.querySelectorAll('.st-lead')].map(text);
    expect(leads).toEqual(['Snap', 'Precision hold', 'Tracking']);
  });

  it('links to the next setting on the same Manager screen', async () => {
    const doc = await render(SettingPage, { setting: settingById('easing') }, '/des/settings/easing/');
    expect(doc.querySelector('a[rel="next"]')?.getAttribute('href')).toBe(settingPath('stability'));
    expect(doc.querySelector('a[rel="prev"]')?.getAttribute('href')).toBe(settingPath('response'));
  });

  it('renders every setting', async () => {
    for (const setting of settings) {
      const doc = await render(SettingPage, { setting }, `/des/settings/${setting.id}/`);
      expect(text(doc.querySelector('h1')), setting.id).toBe(setting.name);
    }
  });
});

describe('the map', () => {
  it('lists every setting once, in the guide’s screen order, with search ready to switch on', async () => {
    const doc = await render(HomePage);
    const screens = [...doc.querySelectorAll('.screen h3')].map(text);
    expect(screens.slice(0, 4)).toEqual(['1 Dashboard', '2 Identity', '3 Game Settings', '4 Aim Settings']);
    const links = [...doc.querySelectorAll('#map li a')].map((a) => a.getAttribute('href'));
    for (const s of settings) expect(links.filter((l) => l === settingPath(s.id))).toHaveLength(1);
    expect(links).toContain(aimStylePath('snap'));
    // Without JavaScript the whole map shows and the search box stays hidden.
    expect(doc.querySelector('search')?.hasAttribute('hidden')).toBe(true);
  });
});

describe('an aim style page', () => {
  it('lists the settings to move, which way, and the weapons that aim this way', async () => {
    const doc = await render(AimStylePage, { style: aimStyleById('snap') }, '/des/aim-styles/snap/');
    expect(text(doc.querySelector('h1'))).toBe('Snap');
    const levers = [...doc.querySelectorAll('.lever-head')].map(text);
    expect(levers[0]).toBe('Easing: Lower');
    expect(text(doc.querySelector('#weapons'))).toBe('Destiny 2 weapons that aim this way');
    expect([...doc.querySelectorAll('.weapons .st-lead')].map(text)).toContain('Hand Cannon');
  });
});

describe('how to read it', () => {
  it('explains the five labels, each with an anchor the badges link to', async () => {
    const doc = await render(SourcesPage, {}, '/des/sources/');
    expect([...doc.querySelectorAll('.levels > div')].map((d) => d.id)).toEqual([
      'official',
      'expert',
      'contested',
      'reasoned',
      'gap',
    ]);
    expect(doc.querySelectorAll('.sources li').length).toBeGreaterThan(0);
  });
});
