import type { JSX } from 'react';
import { useEffect } from 'react';
import { WidgetContainer } from './components/widget/WidgetContainer';
import { useTheme } from './hooks/useTheme';

/**
 * Widget application entry point.
 * Minimal setup for the widget window - no router, just the widget component.
 */
function WidgetApp(): JSX.Element {
  // Apply theme based on user settings
  useTheme();

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
