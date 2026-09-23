/**
 * The config sheet's back link goes back to where the sheet was opened from. Links to a sheet
 * pass `sheetLinkState` as history state; without it (or with anything unexpected) the back
 * link goes to Loadouts.
 */
export interface SheetFrom {
  /** An address inside Dialed, such as /build/l1/sheet. */
  to: string;
  label: string;
}

export const SHEET_BACK_DEFAULT: SheetFrom = { to: '/loadouts', label: 'Loadouts' };

export function sheetLinkState(from: SheetFrom): { sheetFrom: SheetFrom } {
  return { sheetFrom: from };
}

/** Where the sheet's back link goes, from the location's history state. */
export function sheetBack(state: unknown): SheetFrom {
  if (!state || typeof state !== 'object') return SHEET_BACK_DEFAULT;
  const from = (state as { sheetFrom?: unknown }).sheetFrom;
  if (!from || typeof from !== 'object') return SHEET_BACK_DEFAULT;
  const { to, label } = from as Record<string, unknown>;
  // Only an address inside the app, never another site.
  if (typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//')) return SHEET_BACK_DEFAULT;
  if (typeof label !== 'string' || label.trim() === '' || label.length > 60) return SHEET_BACK_DEFAULT;
  return { to, label };
}
