import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '../routes';
import { DataProvider } from '../state/DataProvider';
import { KnowledgeContext, type KnowledgeApi } from '../state/knowledge-context';
import { weaponKnowledge } from './fixtures';
import { MemoryStorage } from './memory-storage';

interface Options<S extends Storage | null> {
  path?: string;
  /** Defaults to an empty MemoryStorage. */
  storage?: S;
  knowledge?: KnowledgeApi;
}

/** Renders the whole app (routes, data, knowledge) at `path`. */
export function renderApp<S extends Storage | null = MemoryStorage>({
  path = '/',
  storage = new MemoryStorage() as Storage as S,
  knowledge = weaponKnowledge,
}: Options<S> = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const result = render(
    <KnowledgeContext value={knowledge}>
      <DataProvider storage={storage}>
        <RouterProvider router={router} />
      </DataProvider>
    </KnowledgeContext>,
  );
  return { ...result, user, router, storage };
}
