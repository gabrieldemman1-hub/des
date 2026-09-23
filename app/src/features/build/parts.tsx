import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Screen } from '../../components/Screen';
import { StatementView } from '../../components/StatementView';
import { TermLink } from '../../components/TermLink';
import type { GuidanceItem } from './build-plan';
import type { CheckContextLine } from '../../state/current-values';
import './build.css';

/** Shown for an address whose loadout isn't saved on this phone. */
export function LoadoutNotFound({ back, link }: { back: { to: string; label: string }; link: { to: string; label: string } }) {
  return (
    <Screen title="Loadout not found" back={back}>
      <p>This loadout doesn’t exist on this phone. It may have been deleted.</p>
      <p>
        <Link className="button secondary" to={link.to}>
          {link.label}
        </Link>
      </p>
    </Screen>
  );
}

/** XIM's guidance on a setting: the first statements straight away, the rest one tap away. */
export function GuidanceStatements({ item }: { item: GuidanceItem }) {
  return (
    <div className="build-statements">
      {item.lead.map((statement, i) => (
        <StatementView key={i} statement={statement} />
      ))}
      {item.more.length > 0 && (
        <details className="why">
          <summary>
            More guidance on {item.term.name} ({item.more.length})
          </summary>
          <div className="build-statements">
            {item.more.map((statement, i) => (
              <StatementView key={i} statement={statement} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** The player's current value for a setting, flagged when it differs from what's required. */
export function CurrentValue({ value, differs, expected }: { value: string; differs?: boolean; expected?: string }) {
  return (
    <p className={`build-current${differs ? ' is-differs' : ''}`}>
      <span className="build-current-label">Your current value:</span> <strong>{value}</strong>
      {differs && <span className="tag tag-differs">{expected ? `Differs from ${expected}` : 'Differs'}</span>}
    </p>
  );
}

/** What the profile and current settings say about a setup check (e.g. the mouse DPI). */
export function CheckContext({ lines }: { lines: readonly CheckContextLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="build-context">
      {lines.map((line) => (
        <li key={line.label} className={line.differs ? 'is-differs' : undefined}>
          <span className="build-current-label">{line.label}:</span> <strong>{line.value}</strong>
          {line.differs && <span className="tag tag-differs">Differs</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * The player's smoothing isn't custom Standard: the shared wording (see `smoothingNote`), and
 * where to read more.
 */
export function SmoothingNote({ text }: { text: string }) {
  return (
    <p className="build-note" role="note">
      <strong>{text}</strong> Read about <TermLink id="smoothing-standard">Standard</TermLink> and{' '}
      <TermLink id="smoothing-classic">Classic</TermLink> smoothing.
    </p>
  );
}

/** A small label above a statement, e.g. "Why it matters". */
export function Label({ children }: { children: ReactNode }) {
  return <p className="build-label">{children}</p>;
}
