import type { UpdateStatus } from 'electron/types/grail';
import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { UpdateDialog } from './UpdateDialog';

/**
 * UpdateSettings component that provides controls for checking and installing app updates.
 * Displays current version, checks for updates, shows download progress, and handles installation.
 * @returns {JSX.Element} A settings card with update management controls
 */
export function UpdateSettings() {
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
    setShowInstallDialog(false);
    try {
      await window.electronAPI.update.quitAndInstall();
    } catch (error) {
      console.error('Failed to install update:', error);
      toast.error('Install Failed', {
        description: 'Failed to install update',
      });
    }
  }, []);

  const handleManualUpdateStatus = useCallback((status: UpdateStatus) => {
    // For manual checks, use dialogs (more prominent)
    if (status.available && !status.downloaded && !status.downloading) {
      setShowUpdateDialog(true);
    }

    if (status.downloaded) {
      setShowInstallDialog(true);
    }

    if (status.error) {
      toast.error('Update Check Failed', {
        description: status.error,
      });
    }
  }, []);

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
    const cleanup = window.electronAPI.update.onUpdateStatus((status) => {
      setUpdateStatus(status);

      // Use dialogs for manual checks only
      if (isManualCheck.current) {
        handleManualUpdateStatus(status);
      }
    });

    return cleanup;
  }, [handleManualUpdateStatus]);

  const handleCheckForUpdates = async () => {
    // Mark this as a manual check
    isManualCheck.current = true;

    try {
      const status = await window.electronAPI.update.checkForUpdates();
      setUpdateStatus(status);

      // Show success toast if no update available
      if (!status.available && !status.error) {
        toast.success('No Updates Available', {
          description: 'You are running the latest version',
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      toast.error('Update Check Failed', {
        description: 'Failed to check for updates',
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
      return `Error: ${updateStatus.error}`;
    }
    if (updateStatus.checking) {
      return 'Checking for updates...';
    }
    if (updateStatus.downloading) {
      return 'Downloading update...';
    }
    if (updateStatus.downloaded) {
      return `Update ${updateStatus.info?.version} is ready to install`;
    }
    if (updateStatus.available) {
      return `Update ${updateStatus.info?.version} is available`;
    }
    return 'You are up to date';
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
            Application Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Current Version</p>
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
                    {updateStatus.info.downloadedPercent.toFixed(1)}% downloaded
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
                Check for Updates
              </Button>

              {updateStatus.available && !updateStatus.downloaded && !updateStatus.downloading && (
                <Button onClick={handleDownloadUpdate} size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download Update
                </Button>
              )}

              {updateStatus.downloaded && (
                <Button onClick={handleInstallUpdate} size="sm">
                  Install & Restart
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-blue-800 text-xs dark:text-blue-200">
              <strong>Note:</strong> The app automatically checks for updates on startup. A toast
              notification will appear in the bottom-left corner if an update is available. Manual
              checks show a detailed dialog with release notes.
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
