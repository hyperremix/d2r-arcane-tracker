import type { JSX } from 'react';
import { useEffect } from 'react';
import { WidgetContainer } from './components/widget/WidgetContainer';
import { useWindowBootstrap } from './hooks/useWindowBootstrap';

/**
 * Widget application entry point.
 * Minimal setup for the widget window - no router, just the widget component.
 */
function WidgetApp(): JSX.Element {
  // Load the grail data, follow settings saved in the main window (a change of the tracked item
  // types also reloads the grail data) and apply theme and language based on user settings
  useWindowBootstrap({ followSettingsUpdates: true });

  // Add widget class to body for transparent background
  useEffect(() => {
    document.body.classList.add('widget');
    return () => {
      document.body.classList.remove('widget');
    };
  }, []);

  return <WidgetContainer />;
}

export default WidgetApp;
