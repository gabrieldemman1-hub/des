import { flowById, type FlowId } from '../content/flows';

/** A flow's fuller account (its CONCEPT.md §5 wording), a tap away under the one-line lede. */
export function HowThisWorks({ flow: id }: { flow: FlowId }) {
  const flow = flowById(id);
  if (!flow) return null;

  return (
    <details className="why how-this-works">
      <summary>How this works</summary>
      {flow.sections.map((section, i) => (
        <section className="prose" key={section.heading ?? i}>
          {section.heading && <h3>{section.heading}</h3>}
          {section.paragraphs?.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {section.bullets && (
            <ul>
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </details>
  );
}
