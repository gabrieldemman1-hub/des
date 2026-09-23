import { createContext, use } from 'react';

export interface Flash {
  id: number;
  text: string;
}

export interface FlashApi {
  /** The confirmation shown on the current screen, if any. */
  flash: Flash | null;
  /**
   * Shows `text` on the screen the app navigates to next (for example "Saved …" on the list
   * after the editor closes). It is not kept in history, so it doesn't come back on reload or
   * Back, and it goes away at the navigation after that.
   */
  showFlash: (text: string) => void;
}

export const FlashContext = createContext<FlashApi>({ flash: null, showFlash: () => {} });

export function useFlash(): FlashApi {
  return use(FlashContext);
}
