import { Link, useParams } from 'react-router';
import { Screen } from '../../components/Screen';
import { NotFoundScreen } from '../../screens/NotFoundScreen';
import { PLAY_MOMENT_LABELS } from '../../content/labels';
import { useKnowledge } from '../../state/knowledge-context';
import { BasisTag, NoteLine } from './BasisTag';
import { DeathTally } from './DeathTally';
import { playPath } from './paths';
import { Section } from './Section';

/** One framework: the rule, the steps with their cues, what goes wrong, and the ideas behind it. */
export function FrameworkScreen() {
  const { frameworkId } = useParams();
  const { kb, playFrameworkById, playPrincipleById } = useKnowledge();
  const framework = frameworkId ? playFrameworkById(frameworkId) : undefined;
  if (!framework) return <NotFoundScreen />;

  const moment = PLAY_MOMENT_LABELS[framework.moment];
  const principles = framework.principleIds.flatMap((id) => {
    const p = playPrincipleById(id);
    return p ? [p] : [];
  });
  const related = framework.frameworkIds.flatMap((id) => {
    const f = playFrameworkById(id);
    return f ? [f] : [];
  });
  const plans = kb.play.loadoutPlans.filter((plan) => plan.frameworkIds.includes(framework.id));

  return (
    <Screen
      title={framework.title}
      back={{ to: playPath.index, label: 'Play' }}
      intro={
        <>
          <p className="eyebrow">
            {moment.title}
            {framework.timeBudget ? ` · ${framework.timeBudget}` : ''}
          </p>
          <p className="lede">{framework.goal}</p>
          <p className="hint">
            <BasisTag basis={framework.basis} />
          </p>
        </>
      }
    >
      <p className="card play-rule">
        <span className="play-rule-label">The rule</span>
        {framework.rule}
      </p>

      <Section title="The steps" hint="The cue is what you say to yourself. The rest is what it means.">
        <ol className="play-steps">
          {framework.steps.map((step, i) => (
            <li className="card play-step" key={step.cue}>
              <p className="play-step-head">
                <span className="play-step-number" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="play-cue">{step.cue}</span>
              </p>
              <p>{step.action}</p>
              {step.why && <p className="play-why">{step.why}</p>}
            </li>
          ))}
        </ol>
      </Section>

      {framework.moment === 'after-death' && (
        <Section title="Tally this death" hint="One tap. The session review counts them.">
          <DeathTally />
        </Section>
      )}

      {framework.checks.length > 0 && (
        <Section title="Ask yourself">
          <ul className="card prose play-list">
            {framework.checks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </Section>
      )}

      {framework.mistakes.length > 0 && (
        <Section title="What usually goes wrong">
          <ul className="card prose play-list">
            {framework.mistakes.map((mistake) => (
              <li key={mistake}>{mistake}</li>
            ))}
          </ul>
        </Section>
      )}

      {framework.notes.length > 0 && (
        <Section title="Notes">
          <ul className="statement-list">
            {framework.notes.map((note) => (
              <li className="card" key={note.text}>
                <NoteLine note={note} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {principles.length > 0 && (
        <Section title="The ideas behind it">
          <ul className="related-links">
            {principles.map((p) => (
              <li key={p.id}>
                <Link to={playPath.principle(p.id)}>{p.title}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(related.length > 0 || plans.length > 0) && (
        <Section title="Goes with">
          <ul className="related-links">
            {related.map((f) => (
              <li key={f.id}>
                <Link to={playPath.framework(f.id)}>{f.title}</Link>
              </li>
            ))}
            {plans.map((plan) => (
              <li key={plan.id}>
                <Link to={playPath.loadoutPlan(plan.id)}>{plan.name}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Screen>
  );
}
