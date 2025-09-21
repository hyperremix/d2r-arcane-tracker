import { createBrowserRouter } from 'react-router';
import { GrailTracker } from './components/grail/GrailTracker';
import { Settings } from './components/settings/Settings';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: GrailTracker,
  },
  {
    path: '/settings',
    Component: Settings,
  },
]);
