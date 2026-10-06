import { Link, useParams } from 'react-router';
import { Screen } from '../../components/Screen';
import { NotFoundScreen } from '../../screens/NotFoundScreen';
import { useKnowledge } from '../../state/knowledge-context';
import { BasisTag } from './BasisTag';
import { playPath } from './paths';
import { Section } from './Section';

/** One principle: the idea, what it looks like in a round, and the frameworks that use it. */
export function PrincipleScreen() {
  const { principleId } = useParams();
  const { playPrincipleById, playFrameworkById } = useKnowledge();
  const principle = principleId ? playPrincipleById(principleId) : undefined;
  if (!principle) return <NotFoundScreen />;

  const frameworks = principle.frameworkIds.flatMap((id) => {
    const f = playFrameworkById(id);
    return f ? [f] : [];
  });

  return (
    <Screen
      title={principle.title}
      back={{ to: playPath.index, label: 'Play' }}
      intro={
        <>
          <p className="eyebrow">Mindset</p>
          <p className="lede">{principle.oneLiner}</p>
          <p className="hint">
            <BasisTag basis={principle.basis} />
          </p>
        </>
      }
    >
      <section className="card prose" aria-label="The idea">
        {principle.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>

      {principle.inPlay.length > 0 && (
        <Section title="What it looks like in a round">
          <ul className="card prose play-list">
            {principle.inPlay.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Section>
      )}

      {frameworks.length > 0 && (
        <Section title="Frameworks that use it">
          <ul className="related-links">
            {frameworks.map((f) => (
              <li key={f.id}>
                <Link to={playPath.framework(f.id)}>{f.title}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Screen>
  );
}
