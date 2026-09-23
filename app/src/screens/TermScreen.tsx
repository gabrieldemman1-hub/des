import { useId, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { Statement } from '../../../knowledge/index';
import { Screen } from '../components/Screen';
import { StatementView } from '../components/StatementView';
import { useKnowledge } from '../state/knowledge-context';
import { NotFoundScreen } from './NotFoundScreen';

function TermSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="learn-section" aria-labelledby={id}>
      <h2 className="section-title" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Statements({ title, statements }: { title: string; statements: readonly Statement[] }) {
  if (statements.length === 0) return null;
  return (
    <TermSection title={title}>
      <ul className="statement-list">
        {statements.map((statement, i) => (
          <li className="card" key={i}>
            <StatementView statement={statement} />
          </li>
        ))}
      </ul>
    </TermSection>
  );
}

/** One glossary term: XIM's definition first, then everything Dialed knows about it. */
export function TermScreen() {
  const { termId } = useParams();
  const { kb, termById } = useKnowledge();
  const term = termId ? termById(termId) : undefined;
  if (!term) return <NotFoundScreen />;

  const expertNotes = kb.expertNotes.filter((n) => n.termIds.includes(term.id));
  const related = term.related.flatMap((id) => {
    const t = termById(id);
    return t ? [t] : [];
  });

  return (
    <Screen
      title={term.name}
      back={{ to: '/learn', label: 'Explain a concept' }}
      intro={
        <>
          <p className="lede">{term.summary}</p>
          {term.location && (
            <p className="hint">
              <strong>In Manager:</strong> {term.location}
            </p>
          )}
          {term.aliases.length > 0 && (
            <p className="hint">
              <strong>Also called:</strong> {term.aliases.join(', ')}
            </p>
          )}
        </>
      }
    >
      <TermSection title="XIM’s definition">
        <div className="card">
          <StatementView statement={term.definition} />
        </div>
      </TermSection>
      <Statements title="What it changes" statements={term.explanation} />
      <Statements title="How it feels" statements={term.feel} />
      <Statements title="XIM’s guidance" statements={term.guidance} />
      <Statements title="Which aim styles it matters for" statements={term.aimStyles} />
      <Statements title="XIM Central notes" statements={expertNotes.map((n) => n.statement)} />

      {term.notToBeConfusedWith.length > 0 && (
        <TermSection title="Not to be confused with">
          <ul className="statement-list">
            {term.notToBeConfusedWith.map((entry) => (
              <li className="card" key={entry.name}>
                <p className="lever-head">
                  {entry.termId ? <Link to={`/learn/${entry.termId}`}>{entry.name}</Link> : <span>{entry.name}</span>}
                </p>
                {entry.note && <p>{entry.note}</p>}
                {entry.statement && <StatementView statement={entry.statement} />}
              </li>
            ))}
          </ul>
        </TermSection>
      )}

      {related.length > 0 && (
        <TermSection title="Related settings">
          <ul className="related-links">
            {related.map((t) => (
              <li key={t.id}>
                <Link to={`/learn/${t.id}`}>{t.name}</Link>
              </li>
            ))}
          </ul>
        </TermSection>
      )}
    </Screen>
  );
}
