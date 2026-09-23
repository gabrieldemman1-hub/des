import { describe, expect, it } from 'vitest';
import { collectCitations, htmlToText, normalizeText, pageText, quoteFound, stripAnchor } from './lib/citations.mjs';

describe('verify-citations helpers', () => {
  it('collects citations with their entry id and JSON path', () => {
    const json = {
      terms: [
        {
          id: 'precision',
          definition: { citations: [{ source: 'xim-guide', url: 'https://guide.xim.tech/a#x', quote: 'Q1' }] },
          feel: [{ citations: [{ source: 'xim-guide', url: 'https://guide.xim.tech/b', quote: 'Q2' }] }],
        },
      ],
      requiredSettings: [{ name: 'Look Sensitivity', statement: { citations: [{ url: 'https://x.test/', quote: 'Q3' }] } }],
    };
    expect(collectCitations('knowledge/x.json', json)).toEqual([
      {
        file: 'knowledge/x.json',
        entryId: 'precision',
        path: 'terms[0].definition.citations[0]',
        source: 'xim-guide',
        url: 'https://guide.xim.tech/a#x',
        quote: 'Q1',
      },
      {
        file: 'knowledge/x.json',
        entryId: 'precision',
        path: 'terms[0].feel[0].citations[0]',
        source: 'xim-guide',
        url: 'https://guide.xim.tech/b',
        quote: 'Q2',
      },
      {
        file: 'knowledge/x.json',
        entryId: 'Look Sensitivity',
        path: 'requiredSettings[0].statement.citations[0]',
        source: '',
        url: 'https://x.test/',
        quote: 'Q3',
      },
    ]);
  });

  it('strips the anchor from urls', () => {
    expect(stripAnchor('https://guide.xim.tech/Aim-Settings/#precision')).toBe('https://guide.xim.tech/Aim-Settings/');
    expect(stripAnchor('https://guide.xim.tech/')).toBe('https://guide.xim.tech/');
  });

  it('turns HTML into text: drops script/style/comments, keeps inline words together', () => {
    const html = `<!doctype html><html><head><title>Aim</title><style>p{color:red}</style>
      <script>var s = "Precision controls";</script></head>
      <body><h2 id="p">Precision</h2><p>Precision controls <em>fine</em> aim<br>behavior. Smooth<strong>ing</strong></p>
      <!-- Precision controls hidden --></body></html>`;
    const text = normalizeText(htmlToText(html));
    expect(text).toBe('Aim Precision Precision controls fine aim behavior. Smoothing');
  });

  it('removes comments and scripts in page order, so "<!--" in a script hides no page text', () => {
    const html = '<script>var s="<!--";</script><p>Precision controls fine aim.</p><!-- footer -->';
    expect(normalizeText(htmlToText(html))).toBe('Precision controls fine aim.');
    const commented = '<!-- <script> --><p>Kept text.</p><script>x()</script><style>a{}</style>';
    expect(normalizeText(htmlToText(commented))).toBe('Kept text.');
  });

  it('decodes named and numeric entities, and handles > inside attributes', () => {
    const html = '<p title="a > b">Tom &amp; Jerry &#8220;hi&#8221; &#x2019;s &nbsp;caf&eacute; &lt;tag&gt;</p>';
    expect(normalizeText(htmlToText(html))).toBe('Tom & Jerry "hi" \'s café <tag>');
  });

  it('includes description meta tags (where YouTube keeps a video description)', () => {
    const html = '<head><meta name="description" content="Smoothing &amp; more"><meta property="og:title" content="MATRIX"></head>';
    expect(normalizeText(htmlToText(html))).toBe('Smoothing & more MATRIX');
  });

  it('normalises curly quotes, non-breaking spaces and whitespace', () => {
    expect(normalizeText('  \u201CLighter\u201D\u00A0reticle\u2019s\n\tfeel\u200B ')).toBe('"Lighter" reticle\'s feel');
  });

  it('matches quotes after normalising both sides', () => {
    const page = pageText('<p>higher values give a \u201Csmoother transition from rest\u201D</p>', 'text/html; charset=utf-8');
    expect(quoteFound(page, 'give a "smoother transition from rest"')).toBe(true);
    expect(quoteFound(page, 'give a  \u201Csmoother\ntransition from rest\u201D')).toBe(true);
    expect(quoteFound(page, 'lower values give')).toBe(false);
    expect(quoteFound(page, '   ')).toBe(false);
  });

  it('leaves plain text pages alone apart from normalising', () => {
    expect(pageText('a <b> & c', 'text/plain')).toBe('a <b> & c');
  });
});
