import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { HomeIcon, LoadoutsIcon, ProfileIcon, SourcesIcon } from './icons';

interface Tab {
  to: string;
  label: string;
  icon: ReactNode;
  isActive(pathname: string): boolean;
}

const TABS: Tab[] = [
  {
    to: '/',
    label: 'Home',
    icon: <HomeIcon />,
    // The flow screens open from Home.
    isActive: (p) => p === '/' || p.startsWith('/flows/'),
  },
  { to: '/loadouts', label: 'Loadouts', icon: <LoadoutsIcon />, isActive: (p) => p.startsWith('/loadouts') },
  { to: '/profile', label: 'Profile', icon: <ProfileIcon />, isActive: (p) => p.startsWith('/profile') },
  { to: '/sources', label: 'Sources', icon: <SourcesIcon />, isActive: (p) => p.startsWith('/sources') },
];

export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="tabbar" aria-label="Main">
      <ul>
        {TABS.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <li key={tab.to}>
              <Link className="tab" to={tab.to} aria-current={active ? 'page' : undefined}>
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
