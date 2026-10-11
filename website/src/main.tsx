import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { isPrerendered } from './isPrerendered';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// The production build is prerendered (website/build.ts) and hydrates; the dev server doesn't
// prerender, so the page is rendered on the client.
if (isPrerendered(rootElement)) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}
