import { useId, useState } from 'react';
import { Link } from 'react-router';
import type { GlossaryTerm } from '../../../knowledge/index';
import { AimStyleGlyph } from '../components/AimStyleGlyph';
import { EmptyState } from '../components/EmptyState';
import { ChevronIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { SourcesLink } from '../components/SourcesLink';
import { StatementView } from '../components/StatementView';
import { TERM_CATEGORY_LABELS } from '../content/labels';
import { useKnowledge } from '../state/knowledge-context';

const CATEGORY_ORDER = Object.keys(TERM_CATEGORY_LABELS) as GlossaryTerm['category'][];

function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function matches(term: GlossaryTerm, query: string): boolean {
  return [term.name, ...term.aliases, term.summary].some((text) => normalize(text).includes(query));
}

/**
 * Flow D, "Explain a concept": the MATRIX settings and terms Dialed covers (not every MATRIX
 * setting), in plain words, plus the aim styles behind weapon-aware advice.
 */
export function LearnScreen() {
  const { kb } = useKnowledge();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const q = normalize(query);

  const found = q ? kb.glossary.terms.filter((t) => matches(t, q)) : kb.glossary.terms;
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    terms: found.filter((t) => t.category === category),
  })).filter((g) => g.terms.length > 0);

  return (
    <Screen
      title="Learn"
      intro={
        <p className="lede">What these XIM MATRIX settings do, in plain words. Not every MATRIX setting is listed.</p>
      }
    >
      {/* Search first: most visits come looking for one setting. */}
      <div className="field">
        <label htmlFor={searchId}>Search settings</label>
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="e.g. Easing, deadzone, cm/360"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="hint" role="status">
        {q ? `${found.length} ${found.length === 1 ? 'setting' : 'settings'} found` : ''}
      </p>

      {!q && kb.aimStyles.length > 0 && (
        <section className="learn-section" aria-labelledby={`${searchId}-styles`}>
          <h2 className="section-title" id={`${searchId}-styles`}>
            Aim styles: tuning for your weapons
          </h2>
          <p className="hint">
            Which settings matter for how a weapon is aimed, like a pulse rifle you track with or a hand cannon you peek
            with.
          </p>
          <ul className="flow-cards">
            {kb.aimStyles.map((style) => {
              const weapons = kb.weapons.archetypes.filter((a) => a.aimStyle === style.id).map((a) => a.name);
              return (
                <li key={style.id}>
                  <Link className="flow-card style-card" to={`/learn/styles/${style.id}`}>
                    <AimStyleGlyph style={style.id} />
                    <span className="flow-card-text">
                      <span className="flow-card-title">{style.name}</span>
                      <span className="flow-card-summary">{style.description}</span>
                      {weapons.length > 0 && <span className="flow-card-status">{weapons.join(', ')}</span>}
                    </span>
                    <ChevronIcon />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {groups.length === 0 ? (
        <EmptyState title="Nothing matches">
          <p>Try another word, or clear the search to see every setting.</p>
        </EmptyState>
      ) : (
        groups.map(({ category, terms }) => (
          <section className="learn-section" key={category} aria-labelledby={`${searchId}-${category}`}>
            <h2 className="section-title" id={`${searchId}-${category}`}>
              {TERM_CATEGORY_LABELS[category]}
            </h2>
            <ul className="flow-cards">
              {terms.map((term) => (
                <li key={term.id}>
                  <Link className="flow-card" to={`/learn/${term.id}`}>
                    <span className="flow-card-text">
                      <span className="flow-card-title">{term.name}</span>
                      <span className="flow-card-summary">{term.summary}</span>
                    </span>
                    <ChevronIcon />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {!q && kb.glossary.nameNotes.length > 0 && (
        <section className="learn-section" aria-labelledby={`${searchId}-names`}>
          <h2 className="section-title" id={`${searchId}-names`}>
            Names the official guide doesn’t list as settings
          </h2>
          <p className="hint">You may come across these in videos, on older XIM devices, or in the guide itself.</p>
          {kb.glossary.nameNotes.map((note) => (
            <details className="why card" key={note.name}>
              <summary>{note.name}</summary>
              <StatementView statement={note.statement} />
            </details>
          ))}
        </section>
      )}

      {!q && <SourcesLink from={{ to: '/learn', label: 'Learn' }} />}
    </Screen>
  );
}
