import dayjs from 'dayjs';
import { AlertTriangle, Database, Download, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
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
import { useGrailStore } from '@/stores/grailStore';

/**
 * DatabaseCard component that provides database backup and restore functionality.
 * Allows users to create backups of their Holy Grail database and restore from backup files.
 * Supports both file selection dialog and drag-and-drop for restore operations.
 * @returns {JSX.Element} A settings card with backup and restore controls
 */
export function DatabaseCard() {
  // Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupPath, setLastBackupPath] = useState<string | null>(null);

  // Restore state
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const { reloadData } = useGrailStore();

  // Backup functionality
  const handleBackup = async () => {
    try {
      setIsBackingUp(true);

      // Show save dialog to let user choose backup location
      const result = await window.electronAPI?.dialog.showSaveDialog({
        title: 'Backup Database',
        defaultPath: `holy-grail-backup-${dayjs().format('YYYY-MM-DD')}.db`,
        filters: [
          { name: 'SQLite Database', extensions: ['db'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['createDirectory'],
      });

      if (result?.canceled || !result?.filePath) {
        return;
      }

      // Perform the backup
      const backupResult = await window.electronAPI?.grail.backup(result.filePath);

      if (backupResult?.success) {
        setLastBackupPath(result.filePath);
        console.log('Database backup completed successfully');
      } else {
        console.error('Backup failed');
      }
    } catch (error) {
      console.error('Failed to backup database:', error);
    } finally {
      setIsBackingUp(false);
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.db')) {
        setSelectedFile(file);
        setSelectedFilePath(null); // No direct path for drag-and-drop
        setShowConfirmDialog(true);
      } else {
        setRestoreError('Please select a valid database file (.db)');
      }
    }
  }, []);

  const handleFileSelect = async () => {
    try {
      const result = await window.electronAPI?.dialog.showOpenDialog({
        title: 'Select Database Backup',
        filters: [
          { name: 'SQLite Database', extensions: ['db'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result?.canceled || !result?.filePaths?.[0]) {
        return;
      }

      const filePath = result.filePaths[0];
      setSelectedFilePath(filePath);
      setSelectedFile(null); // Clear drag-and-drop file
      setShowConfirmDialog(true);
    } catch (error) {
      console.error('Failed to select file:', error);
      setRestoreError('Failed to select file');
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
        setRestoreError('Restore failed');
      }
    } catch (error) {
      console.error('Failed to restore database:', error);
      setRestoreError('Failed to restore database');
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
    setShowConfirmDialog(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-5 w-5" />
          Database
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Backup Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <h3 className="font-medium text-sm">Backup</h3>
          </div>
          <p className="text-gray-600 text-xs">
            Create a backup of your database to preserve your progress
          </p>
          <Button onClick={handleBackup} disabled={isBackingUp} size="sm" className="gap-2">
            <Download className="h-3 w-3" />
            {isBackingUp ? 'Creating Backup...' : 'Backup Database'}
          </Button>
          {lastBackupPath && (
            <p className="text-green-600 text-xs">Last backup: {lastBackupPath.split('/').pop()}</p>
          )}
        </div>

        {/* Restore Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <h3 className="font-medium text-sm">Restore</h3>
          </div>
          <p className="text-gray-600 text-xs dark:text-gray-400">
            Restore your database from a backup file
          </p>

          {/* Dropzone */}
          <button
            type="button"
            className={`w-full rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileSelect}
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p className="text-gray-600 text-sm dark:text-gray-400">
              Drag and drop a database file here, or{' '}
              <span className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200">
                click to browse
              </span>
            </p>
            <p className="text-gray-500 text-xs dark:text-gray-400">Supports .db files</p>
          </button>

          {/* Error/Success Messages */}
          {restoreError && (
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-red-800 text-xs dark:text-red-200">{restoreError}</p>
            </div>
          )}

          {restoreSuccess && (
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-green-800 text-xs dark:text-green-200">
                Database restored successfully! All data has been refreshed and is now up to date.
              </p>
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Restore Database
              </AlertDialogTitle>
              <AlertDialogDescription>
                <span className="mb-2 block">
                  Are you sure you want to restore the database from the backup?
                </span>
                <span className="mb-2 block font-medium text-orange-600">
                  ⚠️ This action will permanently replace all current data.
                </span>
                <span className="block text-sm">
                  Make sure you have created a backup of your current progress if you want to keep
                  it.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRestoring} onClick={resetState}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRestore}
                disabled={isRestoring}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isRestoring ? 'Restoring...' : 'Restore Database'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
