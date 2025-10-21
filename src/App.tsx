import type { JSX } from 'react';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { SetupWizard } from '@/components/wizard/SetupWizard';
import { useIconPreloader } from './hooks/useItemIcon';
import { useTheme } from './hooks/useTheme';
import { useUpdateNotifications } from './hooks/useUpdateNotifications';
import { router } from './router';
import { useGrailStore } from './stores/grailStore';
import { useWizardStore } from './stores/wizardStore';

function App(): JSX.Element {
  const { settings } = useGrailStore();
  const { openWizard } = useWizardStore();

  // Apply theme based on user settings
  useTheme();

  // Preload popular item icons
  useIconPreloader();

  // Listen for automatic update notifications
  useUpdateNotifications();

  // Check if wizard should be shown on first launch
  useEffect(() => {
    const shouldShowWizard = !settings.wizardCompleted && !settings.wizardSkipped;
    if (shouldShowWizard) {
      // Small delay to ensure everything is loaded
      setTimeout(() => {
        openWizard();
      }, 500);
    }
  }, [settings.wizardCompleted, settings.wizardSkipped, openWizard]);

  return (
    <>
      <RouterProvider router={router} />
      <SetupWizard />
      <Toaster position="bottom-left" />
    </>
  );
}

export default App;
