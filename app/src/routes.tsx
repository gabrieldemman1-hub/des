import type { RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { AimStyleScreen } from './screens/AimStyleScreen';
import { FlowScreen } from './screens/FlowScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LearnScreen } from './screens/LearnScreen';
import { LoadoutEditorScreen } from './screens/LoadoutEditorScreen';
import { LoadoutsScreen } from './screens/LoadoutsScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SourcesScreen } from './screens/SourcesScreen';
import { TermScreen } from './screens/TermScreen';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'flows/:flowId', element: <FlowScreen /> },
      { path: 'learn', element: <LearnScreen /> },
      { path: 'learn/styles/:styleId', element: <AimStyleScreen /> },
      { path: 'learn/:termId', element: <TermScreen /> },
      { path: 'loadouts', element: <LoadoutsScreen /> },
      { path: 'loadouts/new', element: <LoadoutEditorScreen /> },
      { path: 'loadouts/:loadoutId', element: <LoadoutEditorScreen /> },
      { path: 'profile', element: <ProfileScreen /> },
      { path: 'sources', element: <SourcesScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
];
