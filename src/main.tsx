import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import WidgetApp from './WidgetApp';
import './i18n';
import './index.css';

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
      <Suspense fallback={isWidget ? null : <img src="/logo.png" alt="logo" />}>
        <AppComponent />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
