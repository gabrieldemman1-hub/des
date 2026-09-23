import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { HomeIcon, LearnIcon, LoadoutsIcon, ProfileIcon, SourcesIcon } from './icons';

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
  { to: '/learn', label: 'Learn', icon: <LearnIcon />, isActive: (p) => p.startsWith('/learn') },
  { to: '/loadouts', label: 'Loadouts', icon: <LoadoutsIcon />, isActive: (p) => p.startsWith('/loadouts') },
  { to: '/profile', label: 'Profile', icon: <ProfileIcon />, isActive: (p) => p.startsWith('/profile') },
  { to: '/sources', label: 'Sources', icon: <SourcesIcon />, isActive: (p) => p.startsWith('/sources') },
];

export function TabBar() {
  const { pathname } = useLocation();
  const nav = useRef<HTMLElement>(null);

  // Large text can wrap the labels onto two lines, making the bar taller than --tabbar-height.
  // Publish its real height so the page keeps its end (and the toast) clear of it.
  useLayoutEffect(() => {
    const element = nav.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--tabbar-space', `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element, { box: 'border-box' });
    return () => {
      observer.disconnect();
      root.style.removeProperty('--tabbar-space');
    };
  }, []);

  return (
    <nav className="tabbar" aria-label="Main" ref={nav}>
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
