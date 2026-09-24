import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Statement } from '../../../../knowledge/index';
import { ConfidenceBadge } from '../../components/ConfidenceBadge';
import { Screen } from '../../components/Screen';
import { StatementView } from '../../components/StatementView';
import { TermLink } from '../../components/TermLink';
import { reasonedLabel } from '../../content/labels';
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

/**
 * A statement's text, badge, "worked out" label (when reasoned) and caveat, for scanning; the
 * reasoning and sources go behind `Why`.
 */
export function StatementLine({ statement }: { statement: Statement }) {
  return (
    <div className="statement">
      <p>
        <ConfidenceBadge level={statement.confidence} /> {statement.text}
      </p>
      {statement.confidence === 'reasoned' && (
        <p className="statement-reasoning">
          <strong>{reasonedLabel(statement)}</strong>
        </p>
      )}
      {statement.caveat && (
        <p className="statement-caveat">
          <strong>Caveat:</strong> {statement.caveat}
        </p>
      )}
    </div>
  );
}

/** The full statements (reasoning and sources), one tap away. `showBadge` false when the lines above show it. */
export function Why({
  summary = 'Reasons and sources',
  statements,
  showBadge = true,
}: {
  summary?: ReactNode;
  statements: readonly Statement[];
  showBadge?: boolean;
}) {
  return (
    <details className="why">
      <summary>{summary}</summary>
      <div className="build-statements">
        {statements.map((statement, i) => (
          <StatementView key={i} statement={statement} showBadge={showBadge} />
        ))}
      </div>
    </details>
  );
}

/**
 * XIM's guidance on a setting: the first statements straight away (their reasons and sources a
 * tap away), the rest one tap away.
 */
export function GuidanceStatements({ item }: { item: GuidanceItem }) {
  return (
    <div className="build-statements">
      {item.lead.map((statement, i) => (
        <StatementLine key={i} statement={statement} />
      ))}
      <Why statements={item.lead} showBadge={false} />
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
