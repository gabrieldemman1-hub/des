import { useRegisterSW } from 'virtual:pwa-register/react';

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

  if (!needRefresh && !offlineReady) return null;

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div className="toast" role="status">
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
