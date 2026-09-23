import { useId, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { Symptom } from '../../../../knowledge/index';
import { Screen } from '../../components/Screen';
import { StatementView } from '../../components/StatementView';
import { TermLink } from '../../components/TermLink';
import { useData } from '../../state/data-context';
import { checksForProfile } from '../../state/guidance';
import { useKnowledge } from '../../state/knowledge-context';
import { SetupChecklist, SetupSummary } from './SetupChecklist';
import './troubleshoot.css';

const BACK = { to: '/troubleshoot', label: 'Troubleshoot by feel' };

function Section({ title, children }: { title: string; children: ReactNode }) {
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

/** The settings a symptom involves, each linking to its explanation, with its one-line summary. */
function SettingsInvolved({ termIds }: { termIds: readonly string[] }) {
  const { termById } = useKnowledge();
  const terms = termIds.flatMap((id) => {
    const term = termById(id);
    return term ? [term] : [];
  });
  if (terms.length === 0) return null;
  return (
    <>
      <h3 className="ts-subtitle">Settings involved</h3>
      <p className="hint">Tap a setting to read what it does.</p>
      <ul className="statement-list">
        {terms.map((term) => (
          <li className="card ts-term" key={term.id}>
            <p className="lever-head">
              <TermLink id={term.id} />
            </p>
            <p className="hint">{term.summary}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

export function SymptomNotFound() {
  return (
    <Screen title="Symptom not found" back={BACK}>
      <p>There’s no symptom at this address. It may have been renamed or removed.</p>
      <p>
        <Link className="button secondary" to="/troubleshoot">
          See all symptoms
        </Link>
      </p>
    </Screen>
  );
}

/** Flow C stage 2: one symptom, the setting it points to (or an honest gap), and one change. */
export function SymptomScreen() {
  const { symptomId } = useParams();
  const { symptomById } = useKnowledge();
  const symptom = symptomId ? symptomById(symptomId) : undefined;
  if (!symptom) return <SymptomNotFound />;
  // Keyed, so moving between symptoms starts each screen afresh.
  return <SymptomDetail key={symptom.id} symptom={symptom} />;
}

function SymptomDetail({ symptom }: { symptom: Symptom }) {
  const { kb } = useKnowledge();
  const { data } = useData();
  const isGap = symptom.mapping.confidence === 'gap';

  const checkIds = new Set(symptom.checkIds);
  const checks = checksForProfile(
    kb.foundation.filter((c) => checkIds.has(c.id)),
    data.profile,
  );
  const notes = kb.expertNotes.filter((n) => n.symptomIds.includes(symptom.id));

  return (
    <Screen
      title={symptom.label}
      back={BACK}
      intro={
        symptom.aliases.length > 0 && (
          <p className="hint">
            <strong>Also described as:</strong> {symptom.aliases.join(', ')}
          </p>
        )
      }
    >
      {isGap ? (
        <Section title="No sourced answer yet">
          <div className="card">
            <StatementView statement={symptom.mapping} />
          </div>
          <p>
            Dialed doesn’t suggest a change without a source, so there’s no change to try here. Start with the{' '}
            {checks.length > 0 ? 'setup check below' : <Link to="/troubleshoot">setup check</Link>}, or pick a more
            specific feel from <Link to="/troubleshoot">all symptoms</Link>.
          </p>
          {symptom.termIds.length > 0 ? (
            <SettingsInvolved termIds={symptom.termIds} />
          ) : (
            <p className="hint">
              To read what each setting does, see <Link to="/learn">Explain a concept</Link>.
            </p>
          )}
        </Section>
      ) : (
        <Section title="What it points to">
          <div className="card">
            <StatementView statement={symptom.mapping} />
          </div>
          <SettingsInvolved termIds={symptom.termIds} />
        </Section>
      )}

      {checks.length > 0 ? (
        <Section title="Check these first">
          <p className="hint">
            Run these setup checks before changing a setting. Your marks are shared with stage 1 and with Build my
            config.
          </p>
          <SetupSummary checks={checks} />
          <SetupChecklist checks={checks} />
        </Section>
      ) : (
        <p className="footnote">
          Before changing a setting, rule out setup mistakes with the <Link to="/troubleshoot">setup check</Link>.
        </p>
      )}

      {!isGap && symptom.suggestedChange && (
        <Section title="Try this one change">
          <div className="card">
            <StatementView statement={symptom.suggestedChange} />
          </div>
        </Section>
      )}

      {notes.length > 0 && (
        <Section title="XIM Central notes">
          <ul className="statement-list">
            {notes.map((note) => (
              <li className="card" key={note.id}>
                <StatementView statement={note.statement} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="One change at a time">
        <div className="card">
          <StatementView statement={kb.guardrail} />
        </div>
      </Section>

      <nav className="ts-next" aria-label="Next steps">
        <ul className="related-links">
          <li>
            <Link to="/tune">Tune my config</Link>
          </li>
          <li>
            <Link to="/troubleshoot">All symptoms</Link>
          </li>
        </ul>
      </nav>
    </Screen>
  );
}
