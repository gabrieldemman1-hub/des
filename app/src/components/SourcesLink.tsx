import { useId } from 'react';
import { Link } from 'react-router';
import { backLinkState, type BackLink } from './back-link';
import { ChevronIcon } from './icons';

/**
 * Sources and the confidence labels, as a card at the end of Learn and Profile (Sources has no
 * tab of its own). Its back link returns to the screen it was opened from.
 */
export function SourcesLink({ from }: { from: BackLink }) {
  const id = useId();
  return (
    <section className="learn-section" aria-labelledby={id}>
      <h2 className="section-title" id={id}>
        About the evidence
      </h2>
      <Link className="flow-card" to="/sources" state={backLinkState(from)}>
        <span className="flow-card-text">
          <span className="flow-card-title">Sources and confidence labels</span>
          <span className="flow-card-summary">The sources Dialed uses, and what each badge means.</span>
        </span>
        <ChevronIcon />
      </Link>
    </section>
  );
}
