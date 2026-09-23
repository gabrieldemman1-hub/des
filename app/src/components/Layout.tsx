import { useCallback, useMemo, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { NOTICE_TEXT, useData } from '../state/data-context';
import { FlashContext, type Flash, type FlashApi } from './flash-context';
import { NoticeBanner } from './NoticeBanner';
import { TabBar } from './TabBar';

export function Layout() {
  const { notice, dismissNotice } = useData();
  const { key } = useLocation();

  // A confirmation waits for the next navigation, shows until the one after, then goes.
  const nextId = useRef(0);
  const [pending, setPending] = useState<Flash | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [flashKey, setFlashKey] = useState(key);
  if (key !== flashKey) {
    setFlashKey(key);
    setFlash(pending);
    setPending(null);
  }
  const showFlash = useCallback((text: string) => {
    nextId.current += 1;
    setPending({ id: nextId.current, text });
  }, []);
  const flashApi = useMemo<FlashApi>(() => ({ flash, showFlash }), [flash, showFlash]);

  return (
    <FlashContext value={flashApi}>
      <div className="app">
        <main className="content">
          {notice && <NoticeBanner onDismiss={dismissNotice}>{NOTICE_TEXT[notice]}</NoticeBanner>}
          {/* Always mounted, so a message that arrives together with a new screen is still read
              out (a live region created together with its text often isn't). A new element per
              message, so the same text twice is announced twice. */}
          <div className="flash-region" aria-live="polite">
            {flash && (
              <p className="flash" key={flash.id}>
                {flash.text}
              </p>
            )}
          </div>
          <Outlet />
        </main>
        <TabBar />
        <ScrollRestoration />
      </div>
    </FlashContext>
  );
}
