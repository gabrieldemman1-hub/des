import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom doesn't implement scrolling; React Router's <ScrollRestoration> calls it.
window.scrollTo = vi.fn();

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
