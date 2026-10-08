import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import WidgetApp from './WidgetApp';
import './i18n';
import './index.css';
import logoUrl from '/logo.png';
import { applyInitialTheme } from './lib/theme';

// Apply the last-used theme before React mounts so dark-theme users don't see a light flash
// while settings load from the main process
applyInitialTheme();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Determine which app to load based on URL hash
const isWidget = window.location.hash.startsWith('#/widget');
const AppComponent = isWidget ? WidgetApp : App;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={isWidget ? null : <img src={logoUrl} alt="logo" />}>
        <AppComponent />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
