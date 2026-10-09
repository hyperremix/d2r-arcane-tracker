import type { JSX } from 'react';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RouterProvider } from 'react-router';

import { Toaster } from '@/components/ui/sonner';
import { SetupWizard } from '@/components/wizard/SetupWizard';
import { translations } from '@/i18n/translations';

import { useIconPreloader } from './hooks/useItemIcon';
import { useServiceErrorNotifications } from './hooks/useServiceErrorNotifications';
import { useTheme } from './hooks/useTheme';
import { useUpdateNotifications } from './hooks/useUpdateNotifications';
import { router } from './router';
import { initGrailData, useGrailStore } from './stores/grailStore';
import { useWizardStore } from './stores/wizardStore';

/**
 * Navigates to the settings page from outside the router tree (e.g. from toast actions).
 */
const openSettings = () => {
  void router.navigate('/settings');
};

function App(): JSX.Element {
  const { t } = useTranslation();
  const settingsHydrated = useGrailStore((state) => state.settingsHydrated);
  const openWizard = useWizardStore((state) => state.openWizard);
  const hasCheckedWizard = useRef(false);

  // Load the grail data once for the whole window and keep it in sync with the main process, so
  // every page sees current data. A layout effect sets the loading flag before the first paint;
  // otherwise the empty store would briefly render the "no items" state before the spinner.
  useLayoutEffect(() => initGrailData(), []);

  // Apply theme based on user settings
  useTheme();

  // Preload popular item icons
  useIconPreloader();

  // Listen for automatic update notifications
  useUpdateNotifications();

  // Listen for critical service error notifications
  useServiceErrorNotifications({ onOpenSettings: openSettings });

  // Show the setup wizard on first run, once the stored settings are known
  useEffect(() => {
    // Only check wizard once per app session
    if (!settingsHydrated || hasCheckedWizard.current) {
      return;
    }
    hasCheckedWizard.current = true;

    const { wizardCompleted, wizardSkipped } = useGrailStore.getState().settings;
    if (wizardCompleted || wizardSkipped) {
      return;
    }

    console.log('Opening wizard for first-time setup');
    // Small delay to ensure everything is loaded
    setTimeout(() => {
      openWizard();
    }, 500);
  }, [settingsHydrated, openWizard]);

  return (
    <>
      <RouterProvider router={router} />
      <SetupWizard />
      <Toaster
        position="bottom-left"
        toastOptions={{ closeButtonAriaLabel: t(translations.common.close) }}
      />
    </>
  );
}

export default App;
