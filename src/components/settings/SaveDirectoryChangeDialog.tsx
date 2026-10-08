import { AlertCircle, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import type { SaveDirectoryChangeAction } from '@/hooks/useSaveDirectoryChange';
import { translations } from '@/i18n/translations';

/**
 * Props for the SaveDirectoryChangeDialog component.
 */
export interface SaveDirectoryChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: SaveDirectoryChangeAction;
  isProcessing: boolean;
  onConfirm: () => void;
  /** Directory currently being monitored; shown (or as "no directory selected") when either path is provided. */
  currentDirectory?: string;
  /** Directory the change would switch to, shown when provided. */
  newDirectory?: string;
  /** Starts a database backup; the "Back up first" action is only shown when provided. */
  onBackup?: () => void;
  /** Whether a backup started from this dialog is in progress. */
  isBackingUp?: boolean;
  /** Whether a backup was created from this dialog for the pending change. */
  hasBackedUp?: boolean;
}

/**
 * Lists the current and new save directory shown in the confirmation dialog.
 * @param {Pick<SaveDirectoryChangeDialogProps, 'currentDirectory' | 'newDirectory'>} props - Paths to show
 * @returns {JSX.Element} A description list of the affected directories
 */
function DirectoryChangePaths({
  currentDirectory,
  newDirectory,
}: Pick<SaveDirectoryChangeDialogProps, 'currentDirectory' | 'newDirectory'>) {
  const { t } = useTranslation();
  const pathClassName = 'break-all rounded bg-muted p-2 font-mono text-muted-foreground text-xs';

  return (
    <dl className="mt-3 space-y-2 text-sm">
      {(currentDirectory !== undefined || newDirectory !== undefined) && (
        <div>
          <dt className="font-medium">
            {t(translations.settings.saveFileMonitor.currentDirectoryLabel)}
          </dt>
          <dd className={pathClassName}>
            {currentDirectory || t(translations.settings.saveFileMonitor.noDirectorySelected)}
          </dd>
        </div>
      )}
      {newDirectory !== undefined && (
        <div>
          <dt className="font-medium">
            {t(translations.settings.saveFileMonitor.newDirectoryLabel)}
          </dt>
          <dd className={pathClassName}>{newDirectory}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Destructive confirmation dialog shown before changing the monitored save directory.
 * Warns that switching directories permanently deletes characters and grail progress,
 * optionally showing the current and new directory and offering to back up first.
 * @param {SaveDirectoryChangeDialogProps} props - Dialog state and callbacks
 * @returns {JSX.Element} An alert dialog asking the user to confirm the directory change
 */
export function SaveDirectoryChangeDialog({
  open,
  onOpenChange,
  action,
  isProcessing,
  onConfirm,
  currentDirectory,
  newDirectory,
  onBackup,
  isBackingUp = false,
  hasBackedUp = false,
}: SaveDirectoryChangeDialogProps) {
  const { t } = useTranslation();
  const isRestore = action === 'restore';
  const isBusy = isProcessing || isBackingUp;

  const confirmLabel = isProcessing
    ? isRestore
      ? t(translations.settings.saveFileMonitor.restoring)
      : t(translations.settings.saveFileMonitor.changing)
    : isRestore
      ? t(translations.settings.saveFileMonitor.restoreDefault)
      : t(translations.settings.saveFileMonitor.changeDirectory);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            {isRestore
              ? t(translations.settings.saveFileMonitor.restoreDefaultDirectory)
              : t(translations.settings.saveFileMonitor.changeSaveFileDirectory)}
          </AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            <span className="mb-2 block">
              {isRestore
                ? t(translations.settings.saveFileMonitor.confirmRestoreDirectory)
                : t(translations.settings.saveFileMonitor.confirmChangeDirectory)}
            </span>
            <span className="mb-2 block font-medium text-warning">
              {t(translations.settings.saveFileMonitor.deleteWarning)}
            </span>
            <span className="block text-sm">
              {t(translations.settings.saveFileMonitor.backupWarning)}
            </span>
            {hasBackedUp && (
              <output className="mt-2 block text-sm text-success">
                {t(translations.settings.saveFileMonitor.backupCreatedContinue)}
              </output>
            )}
            {(currentDirectory !== undefined || newDirectory !== undefined) && (
              <DirectoryChangePaths
                currentDirectory={currentDirectory}
                newDirectory={newDirectory}
              />
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy}>{t(translations.common.cancel)}</AlertDialogCancel>
          {onBackup && (
            <Button variant="outline" onClick={onBackup} disabled={isBusy} className="gap-2">
              <Download className="h-3 w-3" />
              {isBackingUp
                ? t(translations.settings.database.creatingBackup)
                : t(translations.settings.database.backupFirst)}
            </Button>
          )}
          <AlertDialogAction onClick={onConfirm} disabled={isBusy} variant="destructive">
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
