import { Link, useParams } from 'react-router';
import { Screen } from '../../components/Screen';
import { NotFoundScreen } from '../../screens/NotFoundScreen';
import { PLAY_WEAPON_JOB_LABELS } from '../../content/labels';
import { useKnowledge } from '../../state/knowledge-context';
import { BasisTag, NoteLine } from './BasisTag';
import { playPath } from './paths';
import { Section } from './Section';

/** One loadout plan: what each weapon does, the three range bands, and the rules that follow. */
export function LoadoutPlanScreen() {
  const { planId } = useParams();
  const { kb, playLoadoutPlanById, playFrameworkById, archetypeById } = useKnowledge();
  const plan = planId ? playLoadoutPlanById(planId) : undefined;
  if (!plan) return <NotFoundScreen />;

  const frameworks = plan.frameworkIds.flatMap((id) => {
    const f = playFrameworkById(id);
    return f ? [f] : [];
  });
  const maps = kb.play.maps.filter((map) => map.loadoutPlanIds.includes(plan.id));

  return (
    <Screen
      title={plan.name}
      documentTitle={`${plan.name} plan`}
      back={{ to: playPath.index, label: 'Play' }}
      intro={
        <>
          <p className="eyebrow">Loadout plan</p>
          <p className="lede">{plan.role}</p>
        </>
      }
    >
      <Section title="The weapons">
        <ul className="statement-list">
          {plan.weapons.map((weapon) => (
            <li className="card" key={`${weapon.archetypeId}-${weapon.job}`}>
              <p className="lever-head">
                <span>{archetypeById(weapon.archetypeId)?.name ?? weapon.archetypeId}</span>
                <span className="tag">{PLAY_WEAPON_JOB_LABELS[weapon.job]}</span>
              </p>
              {weapon.facts.map((fact) => (
                <NoteLine note={fact} key={fact.text} />
              ))}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Range bands" hint="Where each weapon wins, and the rule for fighting there. Measure the edges in a private match.">
        <ol className="play-steps">
          {plan.bands.map((band, i) => (
            <li className="card play-step" key={band.id}>
              <p className="play-step-head">
                <span className="play-step-number" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="play-cue">{band.name}</span>
              </p>
              <p>
                <strong>Where:</strong> {band.range}
              </p>
              <p>
                <strong>Rule:</strong> {band.rule} <BasisTag basis={band.basis} />
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {plan.rules.length > 0 && (
        <Section title="Rules">
          <ul className="statement-list">
            {plan.rules.map((rule) => (
              <li className="card" key={rule.text}>
                <NoteLine note={rule} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(frameworks.length > 0 || maps.length > 0) && (
        <Section title="Goes with">
          <ul className="related-links">
            {frameworks.map((f) => (
              <li key={f.id}>
                <Link to={playPath.framework(f.id)}>{f.title}</Link>
              </li>
            ))}
            {maps.map((map) => (
              <li key={map.id}>
                <Link to={playPath.map(map.id)}>{map.name}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Screen>
  );
}
