import type { UpdateStatus } from 'electron/types/grail';
import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { translations } from '@/i18n/translations';
import { UpdateDialog } from './UpdateDialog';

/**
 * UpdateSettings component that provides controls for checking and installing app updates.
 * Displays current version, checks for updates, shows download progress, and handles installation.
 * @returns {JSX.Element} A settings card with update management controls
 */
export function UpdateSettings() {
  const { t } = useTranslation();
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
  });
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const isManualCheck = useRef(false);

  const handleDownloadUpdate = useCallback(async () => {
    setShowUpdateDialog(false);
    try {
      await window.electronAPI.update.downloadUpdate();
      toast.info(t(translations.settings.update.downloadingUpdate), {
        description: t(translations.settings.update.downloadStarted),
      });
    } catch (error) {
      console.error('Failed to download update:', error);
      toast.error(t(translations.settings.update.downloadFailed), {
        description: t(translations.settings.update.downloadFailedDescription),
      });
    }
  }, [t]);

  const handleInstallUpdate = useCallback(async () => {
    setShowInstallDialog(false);
    try {
      await window.electronAPI.update.quitAndInstall();
    } catch (error) {
      console.error('Failed to install update:', error);
      toast.error(t(translations.settings.update.installFailed), {
        description: t(translations.settings.update.installFailedDescription),
      });
    }
  }, [t]);

  const handleManualUpdateStatus = useCallback(
    (status: UpdateStatus) => {
      // For manual checks, use dialogs (more prominent)
      if (status.available && !status.downloaded && !status.downloading) {
        setShowUpdateDialog(true);
      }

      if (status.downloaded) {
        setShowInstallDialog(true);
      }

      if (status.error) {
        toast.error(t(translations.settings.update.updateCheckFailed), {
          description: status.error,
        });
      }
    },
    [t],
  );

  useEffect(() => {
    const loadUpdateInfo = async () => {
      try {
        const info = await window.electronAPI.update.getUpdateInfo();
        setCurrentVersion(info.currentVersion);
        setUpdateStatus(info.status);
      } catch (error) {
        console.error('Failed to load update info:', error);
      }
    };

    // Load initial update info
    loadUpdateInfo();

    // Listen for update status changes (for manual checks only)
    // Automatic update toasts are handled by the useUpdateNotifications hook in App.tsx
    const unsubscribe = window.electronAPI.update.onUpdateStatus((status) => {
      setUpdateStatus(status);

      // Use dialogs for manual checks only
      if (isManualCheck.current) {
        handleManualUpdateStatus(status);
      }
    });

    return unsubscribe;
  }, [handleManualUpdateStatus]);

  const handleCheckForUpdates = async () => {
    // Mark this as a manual check
    isManualCheck.current = true;

    try {
      const status = await window.electronAPI.update.checkForUpdates();
      setUpdateStatus(status);

      // Show success toast if no update available
      if (!status.available && !status.error) {
        toast.success(t(translations.settings.update.noUpdatesAvailable), {
          description: t(translations.settings.update.latestVersion),
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      toast.error(t(translations.settings.update.updateCheckFailed), {
        description: t(translations.settings.update.failedToCheck),
      });
    } finally {
      // Reset the flag after a short delay
      setTimeout(() => {
        isManualCheck.current = false;
      }, 1000);
    }
  };

  const getStatusText = () => {
    if (updateStatus.error) {
      return t(translations.settings.update.errorPrefix, { error: updateStatus.error });
    }
    if (updateStatus.checking) {
      return t(translations.settings.update.checkingForUpdates);
    }
    if (updateStatus.downloading) {
      return t(translations.settings.update.downloadingUpdateStatus);
    }
    if (updateStatus.downloaded) {
      return t(translations.settings.update.updateReadyToInstall, {
        version: updateStatus.info?.version,
      });
    }
    if (updateStatus.available) {
      return t(translations.settings.update.updateAvailable, {
        version: updateStatus.info?.version,
      });
    }
    return t(translations.settings.update.upToDate);
  };

  const getStatusColor = () => {
    if (updateStatus.error) {
      return 'text-red-600 dark:text-red-400';
    }
    if (updateStatus.available || updateStatus.downloaded) {
      return 'text-blue-600 dark:text-blue-400';
    }
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5" />
            {t(translations.settings.update.title)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  {t(translations.settings.update.currentVersion)}
                </p>
                <p className="text-gray-600 text-xs dark:text-gray-400">{currentVersion}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={`text-sm ${getStatusColor()}`}>{getStatusText()}</p>
              </div>

              {updateStatus.downloading && updateStatus.info?.downloadedPercent !== undefined && (
                <div className="space-y-1">
                  <Progress value={updateStatus.info.downloadedPercent} className="h-2" />
                  <p className="text-gray-600 text-xs dark:text-gray-400">
                    {t(translations.settings.update.percentDownloaded, {
                      percent: updateStatus.info.downloadedPercent.toFixed(1),
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCheckForUpdates}
                disabled={updateStatus.checking || updateStatus.downloading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t(translations.settings.update.checkForUpdates)}
              </Button>

              {updateStatus.available && !updateStatus.downloaded && !updateStatus.downloading && (
                <Button onClick={handleDownloadUpdate} size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  {t(translations.settings.update.downloadUpdate)}
                </Button>
              )}

              {updateStatus.downloaded && (
                <Button onClick={handleInstallUpdate} size="sm">
                  {t(translations.settings.update.installAndRestart)}
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-blue-800 text-xs dark:text-blue-200">
              <strong>{t(translations.common.note)}</strong> {t(translations.settings.update.note)}
            </p>
          </div>
        </CardContent>
      </Card>

      <UpdateDialog
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
        updateInfo={updateStatus.info}
        onDownload={handleDownloadUpdate}
      />

      <UpdateDialog
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
        updateInfo={updateStatus.info}
        onInstall={handleInstallUpdate}
        isInstallDialog
      />
    </>
  );
}
