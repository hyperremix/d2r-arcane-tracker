import { createHashRouter, Outlet } from 'react-router';
import { GrailTracker } from './components/grail/GrailTracker';
import { InventoryBrowserMain } from './components/inventory/InventoryBrowserMain';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { RunewordCalculator } from './components/runeword/RunewordCalculator';
import { RunTracker } from './components/runtracker/RunTracker';
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
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export const router = createHashRouter([
  {
    element: <RootLayout />,
    // Last resort if the layout itself (e.g. the title bar) fails to render.
    errorElement: <RouteErrorBoundary fullScreen />,
    children: [
      {
        // Pathless layout route: page errors render here, inside RootLayout,
        // so the title bar stays usable and navigating away recovers.
        errorElement: <RouteErrorBoundary />,
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
            path: '/runs',
            Component: RunTracker,
          },
          {
            path: '/runewords',
            Component: RunewordCalculator,
          },
          {
            path: '/inventory-browser',
            Component: InventoryBrowserMain,
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
    ],
  },
]);
