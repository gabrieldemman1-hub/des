import { useEffect, useId, useRef, type MouseEventHandler, type ReactNode } from 'react';
import { Link } from 'react-router';

let firstScreen = true;

interface Props {
  title: string;
  /** Shown instead of the title in the browser tab, if different. */
  documentTitle?: string;
  back?: { to: string; label: string; onClick?: MouseEventHandler<HTMLAnchorElement> };
  /** Decoration shown before the title (hidden from assistive tech by the caller). */
  icon?: ReactNode;
  /** Extra content inside the header, under the title. */
  intro?: ReactNode;
  children: ReactNode;
}

/**
 * One screen: sets the document title and, after a navigation, moves focus to the heading
 * so screen reader and keyboard users start at the new content.
 */
export function Screen({ title, documentTitle, back, icon, intro, children }: Props) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const tabTitle = documentTitle ?? title;

  useEffect(() => {
    document.title = tabTitle === 'Dialed' ? 'Dialed' : `${tabTitle} · Dialed`;
  }, [tabTitle]);

  useEffect(() => {
    if (firstScreen) {
      firstScreen = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section className="screen" aria-labelledby={headingId}>
      <header className="screen-header">
        {back && (
          <Link className="back-link" to={back.to} onClick={back.onClick}>
            <span aria-hidden="true">‹ </span>
            {back.label}
          </Link>
        )}
        <div className="title-row">
          {icon}
          <h1 id={headingId} ref={heading} tabIndex={-1}>
            {title}
          </h1>
        </div>
        {intro}
      </header>
      {children}
    </section>
  );
}
