import { useCallback, type MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useFlash } from '../components/flash-context';

/**
 * History state for links from the loadout list to the editor: the list is the entry behind
 * the editor, so closing the editor goes back to it rather than adding another list entry.
 */
export const FROM_LIST = { fromList: true } as const;

/**
 * Closes the loadout editor and returns to the list, optionally with a confirmation. The
 * editor's history entry is left behind either way, so the phone's Back button doesn't reopen
 * a finished (or deleted) loadout.
 */
export function useCloseEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showFlash } = useFlash();
  const fromList = (location.state as { fromList?: unknown } | null)?.fromList === true;

  const close = useCallback(
    (message?: string) => {
      if (message) showFlash(message);
      if (fromList) void navigate(-1);
      else void navigate('/loadouts', { replace: true });
    },
    [fromList, navigate, showFlash],
  );

  /** For links to the list (Cancel, the back link): a plain click closes the editor instead. */
  const onLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      close();
    },
    [close],
  );

  return { close, onLinkClick };
}
