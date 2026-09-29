import { progressSummary, type ProgressCount } from '../state/progress';

interface Props {
  count: ProgressCount;
  /** Put before the counts in the words under the ruler, e.g. "Sheet". */
  prefix?: string;
  /** Hide the words under the ruler when the same counts are said right beside it. */
  showSummary?: boolean;
  className?: string;
}

/**
 * Progress as a calibration ruler: one tick per item, Done ticks first (green), then Needs
 * fixing (red), then the ones still to go. Colour is never the only signal: the ruler has the
 * counts as its accessible name, and the same counts are written under it.
 */
export function TickRuler({ count, prefix, showSummary = true, className }: Props) {
  const { total, done, problem } = count;
  const rest = Math.max(0, total - done - problem);
  const summary = `${prefix ? `${prefix} ` : ''}${progressSummary(count)}`;
  const ticks = [
    ...Array.from({ length: done }, () => 'is-done'),
    ...Array.from({ length: problem }, () => 'is-problem'),
    ...Array.from({ length: rest }, () => ''),
  ];
  return (
    <div className={`ruler-block${className ? ` ${className}` : ''}`}>
      <div className="ruler" role="img" aria-label={summary}>
        {ticks.map((state, i) => (
          <span key={i} className={state || undefined} />
        ))}
      </div>
      {showSummary && (
        <p className={`ruler-summary${problem > 0 ? ' has-problem' : ''}`} aria-hidden="true">
          {summary}
        </p>
      )}
    </div>
  );
}
