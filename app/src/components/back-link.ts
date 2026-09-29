/**
 * A back link that returns to where a screen was opened from. Links pass `backLinkState` as
 * history state; without it (or with anything unexpected) the screen's own fallback is used.
 */
export interface BackLink {
  /** An address inside Dialed, such as /profile. */
  to: string;
  label: string;
}

export function backLinkState(from: BackLink): { backFrom: BackLink } {
  return { backFrom: from };
}

/** Where the back link goes, from the location's history state. */
export function backLinkFrom(state: unknown, fallback: BackLink): BackLink {
  if (!state || typeof state !== 'object') return fallback;
  const from = (state as { backFrom?: unknown }).backFrom;
  if (!from || typeof from !== 'object') return fallback;
  const { to, label } = from as Record<string, unknown>;
  // Only an address inside the app, never another site.
  if (typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//')) return fallback;
  if (typeof label !== 'string' || label.trim() === '' || label.length > 60) return fallback;
  return { to, label };
}
