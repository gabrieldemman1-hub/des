import { useId, type ReactNode } from 'react';

/** A titled section of a Play screen, named for assistive tech by its title. */
export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="learn-section" aria-labelledby={id}>
      <h2 className="section-title" id={id}>
        {title}
      </h2>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}
