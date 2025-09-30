import { createBrowserRouter, Outlet } from 'react-router';
import { GrailTracker } from './components/grail/GrailTracker';
import { Settings } from './components/settings/Settings';
import { TitleBar } from './components/TitleBar';

/**
 * Root layout component that wraps all routes with the TitleBar.
 * This ensures the TitleBar has access to the router context.
 */
function RootLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TitleBar />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        Component: GrailTracker,
      },
      {
        path: '/settings',
        Component: Settings,
      },
    ],
  },
]);
