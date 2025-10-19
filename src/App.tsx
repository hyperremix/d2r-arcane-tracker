import type { JSX } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { useIconPreloader } from './hooks/useItemIcon';
import { useTheme } from './hooks/useTheme';
import { useUpdateNotifications } from './hooks/useUpdateNotifications';
import { router } from './router';

function App(): JSX.Element {
  // Apply theme based on user settings
  useTheme();

  // Preload popular item icons
  useIconPreloader();

  // Listen for automatic update notifications
  useUpdateNotifications();

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="bottom-left" />
    </>
  );
}

export default App;
