import type { ReactNode } from 'react';

interface Props {
  /** What the value is, as a small-caps label: "Yours", "XIM’s list". */
  label: string;
  value: ReactNode;
  /** The value being replaced: stepped back so the target leads. */
  muted?: boolean;
}

/** A value as an instrument reads it: a small-caps label over the number in the numeric face. */
export function Readout({ label, value, muted = false }: Props) {
  return (
    <div className="readout">
      <span className="micro">{label}</span>
      <span className={`num readout-value${muted ? ' is-muted' : ''}`}>{value}</span>
    </div>
  );
}
