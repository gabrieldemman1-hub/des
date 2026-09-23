import { Link, Navigate, useParams } from 'react-router';
import { Screen } from '../components/Screen';
import { flowById } from '../content/flows';
import { NotFoundScreen } from './NotFoundScreen';

/** Placeholder for a flow that isn't built yet: explains what it will do. */
export function FlowScreen() {
  const flow = flowById(useParams().flowId);
  if (!flow) return <NotFoundScreen />;
  if (flow.available) return <Navigate to={flow.to} replace />;

  return (
    <Screen
      title={flow.title}
      back={{ to: '/', label: 'Home' }}
      intro={<p className="eyebrow">{flow.question}</p>}
    >
      <div className="coming-soon" role="note">
        <strong>Coming in the next step.</strong> This is a preview of what the flow will do. It arrives in the next
        build step, on top of the knowledge base.
      </div>

      {flow.sections.map((section, i) => (
        <section className="prose" key={section.heading ?? i}>
          {section.heading && <h2>{section.heading}</h2>}
          {section.paragraphs?.map((p) => <p key={p}>{p}</p>)}
          {section.bullets && (
            <ul>
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="footnote">
        It will use your <Link to="/profile">profile</Link> and <Link to="/loadouts">loadouts</Link>, so setting them
        up now saves time later.
      </p>
    </Screen>
  );
}
