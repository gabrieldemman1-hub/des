import type { RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { FlowScreen } from './screens/FlowScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoadoutEditorScreen } from './screens/LoadoutEditorScreen';
import { LoadoutsScreen } from './screens/LoadoutsScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SourcesScreen } from './screens/SourcesScreen';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'flows/:flowId', element: <FlowScreen /> },
      { path: 'loadouts', element: <LoadoutsScreen /> },
      { path: 'loadouts/new', element: <LoadoutEditorScreen /> },
      { path: 'loadouts/:loadoutId', element: <LoadoutEditorScreen /> },
      { path: 'profile', element: <ProfileScreen /> },
      { path: 'sources', element: <SourcesScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
];
