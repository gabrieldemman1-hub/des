import type { AimStyleId } from '../../../knowledge/index';

/**
 * How each aim style moves, drawn small: tracking follows a target in a smooth curve, snap
 * flicks straight onto it, precision-hold sits on one point. Decoration beside the style's name.
 */
export function AimStyleGlyph({ style }: { style: AimStyleId }) {
  return (
    <svg
      className="aim-glyph"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {style === 'tracking' && (
        <>
          <path d="M2.5 17c3-7 6.5-8.5 9-4.5s5.5 3 8-5" />
          <circle cx="19.5" cy="7.5" r="1.8" fill="currentColor" stroke="none" />
        </>
      )}
      {style === 'snap' && (
        <>
          <path d="M3.5 19.5 15 8" strokeDasharray="2.2 2.6" />
          <circle cx="17.5" cy="6.5" r="3.5" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </>
      )}
      {style === 'precision-hold' && (
        <>
          <circle cx="12" cy="12" r="6.5" />
          <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
