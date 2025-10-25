import { createHashRouter, Outlet } from 'react-router';
import { GrailTracker } from './components/grail/GrailTracker';
import { RunewordCalculator } from './components/runeword/RunewordCalculator';
import { Settings } from './components/settings/Settings';
import { Statistics } from './components/statistics/Statistics';
import { TitleBar } from './components/TitleBar';
import { TerrorZoneConfiguration } from './components/terror-zone/TerrorZoneConfiguration';

/**
 * Root layout component that wraps all routes with the TitleBar.
 * This ensures the TitleBar has access to the router context.
 */
function RootLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TitleBar />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}

export const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        Component: GrailTracker,
      },
      {
        path: '/statistics',
        Component: Statistics,
      },
      {
        path: '/runewords',
        Component: RunewordCalculator,
      },
      {
        path: '/settings',
        Component: Settings,
      },
      {
        path: '/terror-zones',
        Component: TerrorZoneConfiguration,
      },
    ],
  },
]);
