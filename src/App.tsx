import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
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
  const { setSettings } = useGrailStore();
  const { openWizard } = useWizardStore();
  const hasCheckedWizard = useRef(false);

  // Apply theme based on user settings
  useTheme();

  // Preload popular item icons
  useIconPreloader();

  // Listen for automatic update notifications
  useUpdateNotifications();

  // Load settings on app startup and check if wizard should be shown
  useEffect(() => {
    const loadSettingsAndCheckWizard = async () => {
      // Only check wizard once per app session
      if (hasCheckedWizard.current) {
        return;
      }

      try {
        const settingsData = await window.electronAPI?.grail.getSettings();
        if (settingsData) {
          await setSettings(settingsData);
          console.log('Loaded settings on app startup:', {
            wizardCompleted: settingsData.wizardCompleted,
            wizardSkipped: settingsData.wizardSkipped,
          });

          // Check if wizard should be shown based on loaded settings
          const shouldShowWizard = !settingsData.wizardCompleted && !settingsData.wizardSkipped;

          hasCheckedWizard.current = true;

          if (shouldShowWizard) {
            console.log('Opening wizard for first-time setup');
            // Small delay to ensure everything is loaded
            setTimeout(() => {
              openWizard();
            }, 500);
          } else {
            console.log('Wizard already completed or skipped, not showing');
          }
        }
      } catch (error) {
        console.error('Failed to load settings on startup:', error);
      }
    };

    loadSettingsAndCheckWizard();
  }, [setSettings, openWizard]);

  return (
    <>
      <RouterProvider router={router} />
      <SetupWizard />
      <Toaster position="bottom-left" />
    </>
  );
}

export default App;
