import { Link, useParams } from 'react-router';
import type { Statement } from '../../../knowledge/index';
import { ReasonedLegend } from '../components/ConfidenceBadge';
import { Screen } from '../components/Screen';
import { SharedCaveatNote, StatementView } from '../components/StatementView';
import { hoistedCaveat, needsReasonedLegend, quotesShownAbove } from '../components/statements';
import { AIMING_SOURCE_LABELS, LEVER_DIRECTION_LABELS } from '../content/labels';
import { useData } from '../state/data-context';
import { leversForProfile } from '../state/guidance';
import { useKnowledge } from '../state/knowledge-context';
import { NotFoundScreen } from './NotFoundScreen';

/** One aim style: what it favours, and which settings to move which way (all reasoned). */
export function AimStyleScreen() {
  const { styleId } = useParams();
  const { kb, termById } = useKnowledge();
  const { data } = useData();
  const style = kb.aimStyles.find((s) => s.id === styleId);
  if (!style) return <NotFoundScreen />;

  const levers = leversForProfile(style.levers, data.profile);
  const hidden = style.levers.length - levers.length;
  const weapons = kb.weapons.archetypes.filter((a) => a.aimStyle === style.id).map((a) => a.name);
  const aimsWith = data.profile.aimingSources.map((s) => AIMING_SOURCE_LABELS[s].title.toLowerCase()).join(' and ');

  // The page's statements in reading order: a caveat they share is said once under the title,
  // and a passage one of them quotes is shown in full once.
  const statements: Statement[] = [style.favours, ...levers.map((lever) => lever.statement)];
  const caveat = hoistedCaveat(statements);
  const above = quotesShownAbove(statements);
  const view = (statement: Statement) => (
    <StatementView
      statement={statement}
      showCaveat={caveat === undefined || statement.caveat !== caveat}
      shownAbove={above.get(statement)}
    />
  );

  return (
    <Screen
      title={style.name}
      documentTitle={`${style.name} aim style`}
      back={{ to: '/learn', label: 'Explain a concept' }}
      intro={
        <>
          <p className="lede">{style.description}</p>
          {weapons.length > 0 && (
            <p className="hint">
              <strong>Weapons:</strong> {weapons.join(', ')}
            </p>
          )}
          {caveat && <SharedCaveatNote>{caveat}</SharedCaveatNote>}
          {needsReasonedLegend(statements) && <ReasonedLegend />}
        </>
      }
    >
      <section className="learn-section">
        <h2 className="section-title">What the settings should favour</h2>
        <div className="card">{view(style.favours)}</div>
      </section>

      <section className="learn-section">
        <h2 className="section-title">Settings to adjust</h2>
        <ul className="statement-list">
          {levers.map((lever) => (
            <li className="card" key={lever.termId}>
              <p className="lever-head">
                <Link to={`/learn/${lever.termId}`}>{termById(lever.termId)?.name ?? lever.termId}</Link>
                <span className="tag">{LEVER_DIRECTION_LABELS[lever.direction]}</span>
              </p>
              {view(lever.statement)}
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <p className="footnote">
            {hidden === 1 ? 'One setting' : `${hidden} settings`} for other ways of aiming{' '}
            {hidden === 1 ? 'is' : 'are'} hidden, because your profile says you aim with {aimsWith}.{' '}
            <Link to="/profile">Change this in your profile</Link>
          </p>
        )}
      </section>
    </Screen>
  );
}
