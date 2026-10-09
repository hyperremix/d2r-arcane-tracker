import type { UpdateStatus } from 'electron/types/grail';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { translations } from '@/i18n/translations';
import { downloadUpdate, installUpdate } from '@/lib/updateActions';

/**
 * Custom hook that manages automatic update notifications.
 * Listens for update status changes and shows persistent toast notifications.
 * This hook should be used at the app root level to ensure notifications
 * appear immediately after startup regardless of which page the user is on.
 */
export function useUpdateNotifications() {
  const { t } = useTranslation();
  const updateToastId = useRef<string | number | undefined>();

  /** Dismisses the update toast that is currently shown, if any. */
  const dismissUpdateToast = useCallback(() => {
    if (updateToastId.current) {
      toast.dismiss(updateToastId.current);
      updateToastId.current = undefined;
    }
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    dismissUpdateToast();
    await downloadUpdate(t);
  }, [dismissUpdateToast, t]);

  const handleInstallUpdate = useCallback(async () => {
    dismissUpdateToast();
    await installUpdate(t);
  }, [dismissUpdateToast, t]);

  const handleAutomaticUpdateStatus = useCallback(
    (status: UpdateStatus) => {
      // Dismiss any existing update toast
      if (updateToastId.current) {
        toast.dismiss(updateToastId.current);
      }

      // Show toast when update is available
      if (status.available && !status.downloaded && !status.downloading) {
        updateToastId.current = toast(t(translations.settings.updateDialog.updateAvailable), {
          description: t(translations.settings.update.versionReadyToDownload, {
            version: status.info?.version,
          }),
          action: {
            label: t(translations.settings.update.download),
            onClick: handleDownloadUpdate,
          },
          cancel: {
            label: t(translations.settings.update.dismiss),
            onClick: dismissUpdateToast,
          },
          duration: Number.POSITIVE_INFINITY,
        });
      }

      // Show toast when update is downloaded
      if (status.downloaded) {
        updateToastId.current = toast(t(translations.settings.update.updateReady), {
          description: t(translations.settings.update.restartToInstall),
          action: {
            label: t(translations.settings.updateDialog.restartNow),
            onClick: handleInstallUpdate,
          },
          cancel: {
            label: t(translations.settings.updateDialog.later),
            onClick: dismissUpdateToast,
          },
          duration: Number.POSITIVE_INFINITY,
        });
      }

      // Show error toast if there's an error
      if (status.error) {
        toast.error(t(translations.settings.update.updateCheckFailed), {
          description: status.error,
        });
      }
    },
    [dismissUpdateToast, handleDownloadUpdate, handleInstallUpdate, t],
  );

  useEffect(() => {
    // Listen for automatic update status changes from the main process
    const unsubscribe = window.electronAPI.update.onUpdateStatus((status) => {
      handleAutomaticUpdateStatus(status);
    });

    return unsubscribe;
  }, [handleAutomaticUpdateStatus]);
}
