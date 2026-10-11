import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import './i18n';
import './index.css';
import logoUrl from '/logo.png';
import { applyInitialTheme } from './lib/theme';

// Each window only loads the code of its own entry: the overlay widget must not pull in the
// router, every page and the inventory browser
const App = lazy(() => import('./App'));
const WidgetApp = lazy(() => import('./WidgetApp'));
const InventorySnapshotWindowApp = lazy(() => import('./InventorySnapshotWindowApp'));

// Apply the last-used theme before React mounts so dark-theme users don't see a light flash
// while settings load from the main process
applyInitialTheme();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Determine which app to load based on URL hash
const isWidget = window.location.hash.startsWith('#/widget');
const isInventorySnapshotWindow = window.location.hash.startsWith('#/inventory-snapshot');
const AppComponent = isWidget
  ? WidgetApp
  : isInventorySnapshotWindow
    ? InventorySnapshotWindowApp
    : App;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* The transparent widget shows nothing while its chunk loads; the other windows show the
          logo as a decorative splash */}
      <Suspense
        fallback={
          isWidget ? null : (
            <div className="fixed inset-0 flex items-center justify-center">
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          )
        }
      >
        <AppComponent />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
