import { AlertTriangle, Database, Download, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDatabaseBackup } from '@/hooks/useDatabaseBackup';
import { translations } from '@/i18n/translations';
import { getFileName } from '@/lib/path';
import { useGrailStore } from '@/stores/grailStore';

/**
 * DatabaseCard component that provides database backup and restore functionality.
 * Allows users to create backups of their Holy Grail database and restore from backup files.
 * Supports both file selection dialog and drag-and-drop for restore operations.
 * @returns {JSX.Element} A settings card with backup and restore controls
 */
export function DatabaseCard() {
  const { t } = useTranslation();
  // Backup state
  const { isBackingUp, lastBackupPath, backup: handleBackup } = useDatabaseBackup();

  // Restore state
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [backedUpBeforeRestore, setBackedUpBeforeRestore] = useState(false);
  const reloadData = useGrailStore((state) => state.reloadData);

  const handleBackupBeforeRestore = async () => {
    const backedUp = await handleBackup();
    if (backedUp) {
      setBackedUpBeforeRestore(true);
    }
  };

  // Restore functionality
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.db')) {
          setSelectedFile(file);
          setSelectedFilePath(null); // No direct path for drag-and-drop
          setBackedUpBeforeRestore(false);
          setShowConfirmDialog(true);
        } else {
          setRestoreError(t(translations.settings.database.invalidFileError));
        }
      }
    },
    [t],
  );

  const handleFileSelect = async () => {
    try {
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: t(translations.settings.database.selectBackupFile),
        filters: [
          { name: t(translations.settings.database.sqliteDatabaseFilter), extensions: ['db'] },
          { name: t(translations.common.allFiles), extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result?.canceled || !result?.filePaths?.[0]) {
        return;
      }

      const filePath = result.filePaths[0];
      setSelectedFilePath(filePath);
      setSelectedFile(null); // Clear drag-and-drop file
      setBackedUpBeforeRestore(false);
      setShowConfirmDialog(true);
    } catch (error) {
      console.error('Failed to select file:', error);
      setRestoreError(t(translations.common.error));
    }
  };

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      setRestoreError(null);
      setRestoreSuccess(false);

      let result: { success: boolean } | undefined;

      if (selectedFilePath) {
        // File selected via dialog
        result = await window.electronAPI?.grail.restore(selectedFilePath);
      } else if (selectedFile) {
        // File dropped
        const fileBuffer = await selectedFile.arrayBuffer();
        result = await window.electronAPI?.grail.restoreFromBuffer(new Uint8Array(fileBuffer));
      } else {
        throw new Error('No file selected');
      }

      if (result?.success) {
        setRestoreSuccess(true);
        setSelectedFile(null);
        setSelectedFilePath(null);
        console.log('Database restore completed successfully');

        // Reload data from the restored database
        await reloadData();
      } else {
        setRestoreError(t(translations.settings.database.restoreFailed));
      }
    } catch (error) {
      console.error('Failed to restore database:', error);
      setRestoreError(t(translations.settings.database.restoreFailed));
    } finally {
      setIsRestoring(false);
      setShowConfirmDialog(false);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setSelectedFilePath(null);
    setRestoreError(null);
    setRestoreSuccess(false);
    setBackedUpBeforeRestore(false);
    setShowConfirmDialog(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-5 w-5" />
          {t(translations.settings.database.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Backup Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <h3 className="font-medium text-sm">{t(translations.settings.database.backup)}</h3>
          </div>
          <p className="text-muted-foreground text-xs">
            {t(translations.settings.database.backupDescription)}
          </p>
          <Button onClick={handleBackup} disabled={isBackingUp} size="sm" className="gap-2">
            <Download className="h-3 w-3" />
            {isBackingUp
              ? t(translations.settings.database.creatingBackup)
              : t(translations.settings.database.backupDatabase)}
          </Button>
          {lastBackupPath && (
            <output className="block text-success text-xs">
              {t(translations.settings.database.lastBackup, {
                filename: getFileName(lastBackupPath),
              })}
            </output>
          )}
        </div>

        {/* Restore Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <h3 className="font-medium text-sm">{t(translations.settings.database.restore)}</h3>
          </div>
          <p className="text-muted-foreground text-xs">
            {t(translations.settings.database.restoreDescription)}
          </p>

          {/* Dropzone */}
          <button
            type="button"
            className={`w-full rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
              isDragOver
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-muted-foreground'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileSelect}
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              {t(translations.settings.database.dropzoneText)}{' '}
              <span className="text-primary underline hover:text-primary/80">
                {t(translations.settings.database.clickToBrowse)}
              </span>
            </p>
            <p className="text-muted-foreground text-xs">
              {t(translations.settings.database.supportsDbFiles)}
            </p>
          </button>

          {/* Error/Success Messages */}
          {restoreError && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
              <AlertDescription className="text-xs">{restoreError}</AlertDescription>
            </Alert>
          )}

          {restoreSuccess && (
            <Alert live="polite" className="border-success/30 bg-success/10">
              <AlertDescription className="text-success text-xs">
                {t(translations.settings.database.restoreSuccess)}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                {t(translations.settings.database.restoreDatabase)}
              </AlertDialogTitle>
              <AlertDialogDescription>
                <span className="mb-2 block">
                  {t(translations.settings.database.confirmRestore)}
                </span>
                <span className="mb-2 block font-medium text-warning">
                  ⚠️ {t(translations.settings.database.replaceWarning)}
                </span>
                <span className="block text-sm">
                  {t(translations.settings.database.keepCurrentWarning)}
                </span>
                {backedUpBeforeRestore && (
                  <output className="mt-2 block text-sm text-success">
                    {t(translations.settings.database.backupCreatedContinue)}
                  </output>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRestoring || isBackingUp} onClick={resetState}>
                {t(translations.common.cancel)}
              </AlertDialogCancel>
              <Button
                variant="outline"
                onClick={handleBackupBeforeRestore}
                disabled={isRestoring || isBackingUp}
                className="gap-2"
              >
                <Download className="h-3 w-3" />
                {isBackingUp
                  ? t(translations.settings.database.creatingBackup)
                  : t(translations.settings.database.backupFirst)}
              </Button>
              <AlertDialogAction
                onClick={handleRestore}
                disabled={isRestoring || isBackingUp}
                variant="destructive"
              >
                {isRestoring
                  ? t(translations.settings.database.restoring)
                  : t(translations.settings.database.restoreDatabase)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
