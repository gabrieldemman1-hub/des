import type { PlayBasis, PlayNote } from '../../../../knowledge/index';
import { PLAY_BASES } from '../../../../knowledge/index';
import { PLAY_BASIS_INFO } from '../../content/labels';

/** What a Play item rests on, as a tag. Not a confidence badge: those are XIM's labels. */
export function BasisTag({ basis }: { basis: PlayBasis }) {
  return (
    <span className="tag play-basis">
      <span className="visually-hidden">Basis: </span>
      {PLAY_BASIS_INFO[basis].label}
    </span>
  );
}

/** A line of coaching with its basis after it. */
export function NoteLine({ note }: { note: PlayNote }) {
  return (
    <p className="play-note">
      {note.text} <BasisTag basis={note.basis} />
    </p>
  );
}

/** The four bases and what each means, once per page that uses the tags. */
export function BasisLegend() {
  return (
    <ul className="legend play-legend" aria-label="What the basis tags mean">
      {PLAY_BASES.map((basis) => (
        <li key={basis}>
          <BasisTag basis={basis} /> <span className="play-legend-meaning">{PLAY_BASIS_INFO[basis].meaning}</span>
        </li>
      ))}
    </ul>
  );
}
