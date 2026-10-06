import type { D2SaveFile, MonitoringStatus, SaveFileEvent } from 'electron/types/grail';
import { GameMode } from 'electron/types/grail';
import {
  AlertCircle,
  CheckCircle,
  FileText,
  FolderOpen,
  MonitorOff,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { formatShortDate } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import type { SaveDirectoryChangeAction } from './SaveDirectoryChangeDialog';
import { SaveDirectoryChangeDialog } from './SaveDirectoryChangeDialog';

/**
 * SaveFileMonitor component that displays and manages save file monitoring status.
 * Shows monitoring status, monitored directory, detected characters, and provides controls
 * for changing the monitored directory or restoring to the default platform location.
 * @returns {JSX.Element} A settings card with save file monitoring status and controls
 */
export function SaveFileMonitor() {
  const { t } = useTranslation();
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus>({
    isMonitoring: false,
    directory: null,
  });
  const [saveFiles, setSaveFiles] = useState<D2SaveFile[]>([]);
  const [lastEvent, setLastEvent] = useState<SaveFileEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveFileCount, setSaveFileCount] = useState<number>(0);
  const [showChangeDirectoryDialog, setShowChangeDirectoryDialog] = useState(false);
  const [isChangingDirectory, setIsChangingDirectory] = useState(false);
  const [dialogAction, setDialogAction] = useState<SaveDirectoryChangeAction | null>(null);
  const { reloadData, settings } = useGrailStore();

  const loadMonitoringStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI?.saveFile.getMonitoringStatus();
      if (status) {
        setMonitoringStatus(status);
      }
    } catch (error) {
      console.error('Failed to load monitoring status:', error);
    }
  }, []);

  const loadSaveFiles = useCallback(async () => {
    try {
      const files = await window.electronAPI?.saveFile.getSaveFiles();
      if (files) {
        setSaveFiles(files);
      }
    } catch (error) {
      console.error('Failed to load save files:', error);
    }
  }, []);

  const getStatusBadge = useCallback(() => {
    if (error) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {t(translations.settings.saveFileMonitor.error)}
        </Badge>
      );
    }

    if (settings.gameMode === GameMode.Manual) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <MonitorOff className="h-3 w-3" />
          {t(translations.settings.saveFileMonitor.disabledManualMode)}
        </Badge>
      );
    }

    if (monitoringStatus.isMonitoring) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          {t(translations.settings.saveFileMonitor.active, { count: saveFileCount })}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <MonitorOff className="h-3 w-3" />
        {t(translations.settings.saveFileMonitor.inactive)}
      </Badge>
    );
  }, [error, monitoringStatus.isMonitoring, saveFileCount, settings.gameMode, t]);

  const handleChangeDirectory = useCallback(async () => {
    try {
      setIsChangingDirectory(true);
      setError(null);

      // Open directory dialog
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: t(translations.settings.saveFileMonitor.selectSaveFileDirectory),
        properties: ['openDirectory'],
      });

      if (result?.canceled || !result?.filePaths?.[0]) {
        return;
      }

      const newDirectory = result.filePaths[0];

      // Update the save directory (this will truncate user data and restart monitoring)
      await window.electronAPI?.saveFile.updateSaveDirectory(newDirectory);

      // Reload data to reflect the changes
      await reloadData();

      // Reload monitoring status and save files
      await loadMonitoringStatus();
      await loadSaveFiles();

      setShowChangeDirectoryDialog(false);
    } catch (error) {
      console.error('Failed to change directory:', error);
      setError(t(translations.settings.saveFileMonitor.changeDirectoryFailed));
    } finally {
      setIsChangingDirectory(false);
    }
  }, [loadMonitoringStatus, loadSaveFiles, reloadData, t]);

  const handleRestoreDefaultDirectory = useCallback(async () => {
    try {
      setIsChangingDirectory(true);
      setError(null);

      // Restore the default directory (this will truncate user data and restart monitoring)
      await window.electronAPI?.saveFile.restoreDefaultDirectory();

      // Reload data to reflect the changes
      await reloadData();

      // Reload monitoring status and save files
      await loadMonitoringStatus();
      await loadSaveFiles();

      setShowChangeDirectoryDialog(false);
      setDialogAction(null);
    } catch (error) {
      console.error('Failed to restore default directory:', error);
      setError(t(translations.settings.saveFileMonitor.restoreDirectoryFailed));
    } finally {
      setIsChangingDirectory(false);
    }
  }, [loadMonitoringStatus, loadSaveFiles, reloadData, t]);

  useEffect(() => {
    loadMonitoringStatus();
    loadSaveFiles();

    // Listen for save file events
    const handleSaveFileEvent = (
      _event: Electron.IpcRendererEvent,
      saveFileEvent: SaveFileEvent,
    ) => {
      setLastEvent(saveFileEvent);
      // Reload save files when events occur
      loadSaveFiles();
    };

    const handleMonitoringStatusChange = (
      _event: Electron.IpcRendererEvent,
      status: {
        status: string;
        directory?: string | null;
        saveFileCount?: number;
        error?: string;
        errorType?: string;
      },
    ) => {
      setMonitoringStatus((prev) => ({
        isMonitoring: status.status === 'started',
        directory: status.directory !== undefined ? status.directory : prev.directory,
      }));

      if (status.status === 'error') {
        setError(status.error || t(translations.settings.saveFileMonitor.unknownError));
        setSaveFileCount(status.saveFileCount || 0);
      } else if (status.status === 'started') {
        setError(null);
        setSaveFileCount(status.saveFileCount || 0);
      } else {
        setError(null);
        setSaveFileCount(0);
      }
    };

    window.ipcRenderer?.on('save-file-event', handleSaveFileEvent);
    window.ipcRenderer?.on('monitoring-status-changed', handleMonitoringStatusChange);

    return () => {
      window.ipcRenderer?.off('save-file-event', handleSaveFileEvent);
      window.ipcRenderer?.off('monitoring-status-changed', handleMonitoringStatusChange);
    };
  }, [
    loadMonitoringStatus, // Reload save files when events occur
    loadSaveFiles,
    t,
  ]);

  // Automatically stop monitoring when gameMode is Manual
  useEffect(() => {
    const handleManualMode = async () => {
      if (settings.gameMode === GameMode.Manual && monitoringStatus.isMonitoring) {
        try {
          await window.electronAPI?.saveFile.stopMonitoring();
          await loadMonitoringStatus();
        } catch (error) {
          console.error('Failed to stop monitoring for Manual mode:', error);
        }
      }
    };

    handleManualMode();
  }, [settings.gameMode, monitoringStatus.isMonitoring, loadMonitoringStatus]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t(translations.settings.saveFileMonitor.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Monitoring Status */}
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {error && (
              <div className="flex items-center gap-1 text-destructive text-sm">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Manual Mode Notice */}
        {settings.gameMode === GameMode.Manual && (
          <Alert live="polite" className="border-warning/30 bg-warning/10">
            <AlertDescription className="text-sm text-warning">
              <strong>{t(translations.settings.saveFileMonitor.manualModeActive)}</strong>{' '}
              {t(translations.settings.saveFileMonitor.manualModeNotice)}
            </AlertDescription>
          </Alert>
        )}

        {/* Monitored Directory */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-medium text-sm">
              {t(translations.settings.saveFileMonitor.monitoredDirectory)}
            </h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDialogAction('change');
                  setShowChangeDirectoryDialog(true);
                }}
                disabled={isChangingDirectory}
              >
                <FolderOpen className="h-3 w-3" />
                {t(translations.settings.saveFileMonitor.changeDirectory)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDialogAction('restore');
                  setShowChangeDirectoryDialog(true);
                }}
                disabled={isChangingDirectory}
              >
                <RotateCcw className="h-3 w-3" />
                {t(translations.settings.saveFileMonitor.restoreDefault)}
              </Button>
            </div>
          </div>
          {monitoringStatus.directory ? (
            <div className="rounded bg-muted p-2 font-mono text-muted-foreground text-xs">
              {monitoringStatus.directory}
            </div>
          ) : (
            <div className="rounded bg-muted p-2 text-muted-foreground text-xs">
              {t(translations.settings.saveFileMonitor.noDirectorySelected)}
            </div>
          )}
        </div>

        {/* Last Event */}
        {lastEvent && (
          <div className="border-t pt-3">
            <h4 className="mb-2 font-medium text-sm">
              {t(translations.settings.saveFileMonitor.latestActivity)}
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {lastEvent.type}
                </Badge>
                <span className="font-medium">{lastEvent.file.name}</span>
              </div>
              <div className="text-muted-foreground">
                {t(translations.settings.saveFileMonitor.levelClass, {
                  level: lastEvent.file.level,
                  characterClass: lastEvent.file.characterClass,
                })}
                {lastEvent.file.hardcore && ` ${t(translations.settings.saveFileMonitor.hc)}`}
              </div>
            </div>
          </div>
        )}

        {/* Save Files List */}
        {saveFiles.length > 0 && (
          <div className="border-t pt-3">
            <h4 className="mb-2 font-medium text-sm">
              {t(translations.settings.saveFileMonitor.detectedCharacters, {
                count: saveFiles.length,
              })}
            </h4>
            <div className="max-h-32 space-y-2 overflow-y-auto">
              {saveFiles.map((file, index) => (
                <div
                  key={`${file.path}-${index}`}
                  className="flex items-center justify-between rounded bg-muted p-2 text-xs"
                >
                  <div>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-muted-foreground">
                      {t(translations.settings.saveFileMonitor.levelClass, {
                        level: file.level,
                        characterClass: file.characterClass,
                      })}
                      {file.hardcore && ` ${t(translations.settings.saveFileMonitor.hc)}`}
                    </div>
                  </div>
                  <div className="text-muted-foreground">{formatShortDate(file.lastModified)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Change Directory Confirmation Dialog */}
      <SaveDirectoryChangeDialog
        open={showChangeDirectoryDialog}
        onOpenChange={(open) => {
          setShowChangeDirectoryDialog(open);
          if (!open) {
            setDialogAction(null);
          }
        }}
        action={dialogAction ?? 'change'}
        isProcessing={isChangingDirectory}
        onConfirm={
          dialogAction === 'restore' ? handleRestoreDefaultDirectory : handleChangeDirectory
        }
      />
    </Card>
  );
}
