import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { translations } from '@/i18n/translations';
import { toLocalIsoDate } from '@/lib/date';
import { getFileName } from '@/lib/path';

/**
 * State and actions returned by {@link useDatabaseBackup}.
 */
export interface DatabaseBackupState {
  /** Whether a backup is currently being written. */
  isBackingUp: boolean;
  /** Path of the most recent successful backup in this component's lifetime. */
  lastBackupPath: string | undefined;
  /**
   * Prompts for a backup location and backs up the database, showing a toast with the result.
   * @returns True if a backup was written, false if canceled or failed
   */
  backup: () => Promise<boolean>;
}

/**
 * Provides the "back up the database" flow: a save dialog followed by the backup IPC call,
 * with success and error toasts.
 * @returns {DatabaseBackupState} Backup state and the backup action
 */
export function useDatabaseBackup(): DatabaseBackupState {
  const { t } = useTranslation();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupPath, setLastBackupPath] = useState<string | undefined>(undefined);

  const backup = useCallback(async (): Promise<boolean> => {
    try {
      setIsBackingUp(true);

      // Show save dialog to let user choose backup location
      const result = await window.electronAPI?.dialog.showSaveDialog({
        title: t(translations.settings.database.backupDatabase),
        defaultPath: `holy-grail-backup-${toLocalIsoDate()}.db`,
        filters: [
          { name: t(translations.settings.database.sqliteDatabaseFilter), extensions: ['db'] },
          { name: t(translations.common.allFiles), extensions: ['*'] },
        ],
        properties: ['createDirectory'],
      });

      if (result?.canceled || !result?.filePath) {
        return false;
      }

      // Perform the backup
      const backupResult = await window.electronAPI?.grail.backup(result.filePath);

      if (backupResult?.success) {
        setLastBackupPath(result.filePath);
        toast.success(t(translations.settings.database.backupSuccess), {
          description: t(translations.settings.database.backupSuccessDescription, {
            filename: getFileName(result.filePath),
          }),
        });
        return true;
      }

      console.error('Backup failed');
      toast.error(t(translations.settings.database.backupFailed));
      return false;
    } catch (error) {
      console.error('Failed to backup database:', error);
      toast.error(t(translations.settings.database.backupFailed), {
        description: error instanceof Error ? error.message : undefined,
      });
      return false;
    } finally {
      setIsBackingUp(false);
    }
  }, [t]);

  return { isBackingUp, lastBackupPath, backup };
}
