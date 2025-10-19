import type { UpdateStatus } from 'electron/types/grail';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook that manages automatic update notifications.
 * Listens for update status changes and shows persistent toast notifications.
 * This hook should be used at the app root level to ensure notifications
 * appear immediately after startup regardless of which page the user is on.
 */
export function useUpdateNotifications() {
  const updateToastId = useRef<string | number | undefined>();

  const handleDownloadUpdate = useCallback(async () => {
    // Dismiss the update available toast
    if (updateToastId.current) {
      toast.dismiss(updateToastId.current);
      updateToastId.current = undefined;
    }
    try {
      await window.electronAPI.update.downloadUpdate();
      toast.info('Downloading Update', {
        description: 'Download started in the background',
      });
    } catch (error) {
      console.error('Failed to download update:', error);
      toast.error('Download Failed', {
        description: 'Failed to download update',
      });
    }
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    // Dismiss the update ready toast
    if (updateToastId.current) {
      toast.dismiss(updateToastId.current);
      updateToastId.current = undefined;
    }
    try {
      await window.electronAPI.update.quitAndInstall();
    } catch (error) {
      console.error('Failed to install update:', error);
      toast.error('Install Failed', {
        description: 'Failed to install update',
      });
    }
  }, []);

  const handleAutomaticUpdateStatus = useCallback(
    (status: UpdateStatus) => {
      // Dismiss any existing update toast
      if (updateToastId.current) {
        toast.dismiss(updateToastId.current);
      }

      // Show toast when update is available
      if (status.available && !status.downloaded && !status.downloading) {
        updateToastId.current = toast('Update Available', {
          description: `Version ${status.info?.version} is ready to download`,
          action: {
            label: 'Download',
            onClick: handleDownloadUpdate,
          },
          cancel: {
            label: 'Dismiss',
            onClick: () => {
              if (updateToastId.current) {
                toast.dismiss(updateToastId.current);
                updateToastId.current = undefined;
              }
            },
          },
          duration: Number.POSITIVE_INFINITY,
        });
      }

      // Show toast when update is downloaded
      if (status.downloaded) {
        updateToastId.current = toast('Update Ready', {
          description: 'Restart to install the update',
          action: {
            label: 'Restart Now',
            onClick: handleInstallUpdate,
          },
          cancel: {
            label: 'Later',
            onClick: () => {
              if (updateToastId.current) {
                toast.dismiss(updateToastId.current);
                updateToastId.current = undefined;
              }
            },
          },
          duration: Number.POSITIVE_INFINITY,
        });
      }

      // Show error toast if there's an error
      if (status.error) {
        toast.error('Update Check Failed', {
          description: status.error,
        });
      }
    },
    [handleDownloadUpdate, handleInstallUpdate],
  );

  useEffect(() => {
    // Listen for automatic update status changes from the main process
    const unsubscribe = window.electronAPI.update.onUpdateStatus((status) => {
      handleAutomaticUpdateStatus(status);
    });

    return unsubscribe;
  }, [handleAutomaticUpdateStatus]);
}
