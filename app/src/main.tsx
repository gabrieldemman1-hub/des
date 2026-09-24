// The base stylesheet first, ahead of the routes that pull in the feature stylesheets: Vite emits
// CSS in import order, and styles.css must come before the rules that build on it.
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { PwaUpdater } from './components/PwaUpdater';
import { listenForInstall } from './pwa/install';
import { routes } from './routes';
import { DataProvider } from './state/DataProvider';

// Hash-based URLs (…/#/profile) work on any static host, including a GitHub Pages subpath.
const router = createHashRouter(routes);

// Before the first render: the browser's install offer can arrive before Home has mounted.
listenForInstall();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <DataProvider>
      <RouterProvider router={router} />
      <PwaUpdater />
    </DataProvider>
  </StrictMode>,
);
