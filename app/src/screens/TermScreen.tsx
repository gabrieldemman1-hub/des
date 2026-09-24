import { useId, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { Statement } from '../../../knowledge/index';
import { ReasonedLegend } from '../components/ConfidenceBadge';
import { Screen } from '../components/Screen';
import { SharedCaveatNote, StatementView } from '../components/StatementView';
import { hoistedCaveat, needsReasonedLegend, quotesShownAbove } from '../components/statements';
import { useKnowledge } from '../state/knowledge-context';
import { NotFoundScreen } from './NotFoundScreen';

/** What the page says once for all its statements, so each card leaves it out. */
interface PageNotes {
  /** The caveat every statement with one shares, shown under the title. */
  caveat: string | undefined;
  /** Per statement, the quotes an earlier statement already shows in full. */
  above: ReadonlyMap<Statement, ReadonlySet<string>>;
}

function PageStatement({ statement, page }: { statement: Statement; page: PageNotes }) {
  return (
    <StatementView
      statement={statement}
      showCaveat={page.caveat === undefined || statement.caveat !== page.caveat}
      shownAbove={page.above.get(statement)}
    />
  );
}

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

function Statements({ title, statements, page }: { title: string; statements: readonly Statement[]; page: PageNotes }) {
  if (statements.length === 0) return null;
  return (
    <TermSection title={title}>
      <ul className="statement-list">
        {statements.map((statement, i) => (
          <li className="card" key={i}>
            <PageStatement statement={statement} page={page} />
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
  // Every statement the page shows, in reading order.
  const statements: Statement[] = [
    term.definition,
    ...term.explanation,
    ...term.feel,
    ...term.guidance,
    ...term.aimStyles,
    ...expertNotes.map((n) => n.statement),
    ...term.notToBeConfusedWith.flatMap((entry) => (entry.statement ? [entry.statement] : [])),
  ];
  const page: PageNotes = { caveat: hoistedCaveat(statements), above: quotesShownAbove(statements) };

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
          {page.caveat && <SharedCaveatNote>{page.caveat}</SharedCaveatNote>}
          {needsReasonedLegend(statements) && <ReasonedLegend />}
        </>
      }
    >
      <TermSection title="XIM’s definition">
        <div className="card">
          <PageStatement statement={term.definition} page={page} />
        </div>
      </TermSection>
      <Statements title="What it changes" statements={term.explanation} page={page} />
      <Statements title="How it feels" statements={term.feel} page={page} />
      <Statements title="XIM’s guidance" statements={term.guidance} page={page} />
      <Statements title="Which aim styles it matters for" statements={term.aimStyles} page={page} />
      <Statements title="XIM Central notes" statements={expertNotes.map((n) => n.statement)} page={page} />

      {term.notToBeConfusedWith.length > 0 && (
        <TermSection title="Not to be confused with">
          <ul className="statement-list">
            {term.notToBeConfusedWith.map((entry) => (
              <li className="card" key={entry.name}>
                <p className="lever-head">
                  {entry.termId ? <Link to={`/learn/${entry.termId}`}>{entry.name}</Link> : <span>{entry.name}</span>}
                </p>
                {entry.note && <p>{entry.note}</p>}
                {entry.statement && <PageStatement statement={entry.statement} page={page} />}
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
