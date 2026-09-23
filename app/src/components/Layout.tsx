import { Outlet, ScrollRestoration } from 'react-router';
import { NOTICE_TEXT, useData } from '../state/data-context';
import { NoticeBanner } from './NoticeBanner';
import { TabBar } from './TabBar';

export function Layout() {
  const { notice, dismissNotice } = useData();
  return (
    <div className="app">
      <main className="content">
        {notice && <NoticeBanner onDismiss={dismissNotice}>{NOTICE_TEXT[notice]}</NoticeBanner>}
        <Outlet />
      </main>
      <TabBar />
      <ScrollRestoration />
    </div>
  );
}
