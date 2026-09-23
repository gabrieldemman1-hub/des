import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** How long "Dialed now works offline." stays up. It needs no answer, so it goes by itself. */
const OFFLINE_READY_MS = 6000;

/**
 * Registers the service worker (offline support) and offers a reload when a new version is
 * ready, instead of reloading while someone is mid-edit. Service workers need HTTPS or
 * localhost, so over plain http on the local network this does nothing.
 */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();
  const toast = useRef<HTMLDivElement>(null);
  const visible = needRefresh || offlineReady;

  const close = useCallback(() => {
    setNeedRefresh(false);
    setOfflineReady(false);
  }, [setNeedRefresh, setOfflineReady]);

  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const timer = window.setTimeout(close, OFFLINE_READY_MS);
    return () => window.clearTimeout(timer);
  }, [offlineReady, needRefresh, close]);

  // While the toast shows, the page reserves room for it (--toast-space in styles.css), so the
  // end of a page can still be scrolled clear of it.
  useLayoutEffect(() => {
    const element = toast.current;
    if (!visible || !element) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--toast-space', `${element.offsetHeight + 12}px`);
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--toast-space');
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="toast" role="status" ref={toast}>
      <p>{needRefresh ? 'A new version of Dialed is ready.' : 'Dialed now works offline.'}</p>
      <div className="toast-actions">
        {needRefresh && (
          <button type="button" className="button primary small" onClick={() => void updateServiceWorker(true)}>
            Reload
          </button>
        )}
        <button type="button" className="button secondary small" onClick={close}>
          {needRefresh ? 'Later' : 'OK'}
        </button>
      </div>
    </div>
  );
}
