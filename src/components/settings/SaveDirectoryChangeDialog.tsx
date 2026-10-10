import { AlertTriangle, Download } from 'lucide-react';
import { useId } from 'react';
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
import type {
  ExistingUserDataCounts,
  SaveDirectoryChangeAction,
} from '@/hooks/useSaveDirectoryChange';
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
  /** What the change would delete; shown as counts when provided, otherwise a generic warning. */
  existingData?: ExistingUserDataCounts;
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
 * Returns the label of the destructive confirm button, which names what confirming does.
 * @param {SaveDirectoryChangeAction} action - The pending change
 * @param {boolean} isProcessing - Whether the change is being applied
 * @returns {string} Translation key of the button label
 */
function getConfirmLabelKey(action: SaveDirectoryChangeAction, isProcessing: boolean): string {
  const labels = translations.settings.saveFileMonitor;
  if (action === 'restore') {
    return isProcessing ? labels.restoring : labels.confirmRestoreAction;
  }
  return isProcessing ? labels.changing : labels.confirmChangeAction;
}

/**
 * Destructive confirmation dialog shown before changing the monitored save directory.
 * Warns that switching directories permanently deletes characters and grail progress
 * (with counts when known), optionally showing the current and new directory. When a backup
 * action is provided, "Back up first" is the primary, initially focused action until a backup
 * was created; the confirm action is destructive and names what it does.
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
  existingData,
  onBackup,
  isBackingUp = false,
  hasBackedUp = false,
}: SaveDirectoryChangeDialogProps) {
  const { t } = useTranslation();
  const backupButtonId = useId();
  const isRestore = action === 'restore';
  const isBusy = isProcessing || isBackingUp;
  const isBackupSuggested = onBackup !== undefined && !hasBackedUp;

  const deleteWarning = existingData
    ? t(translations.settings.saveFileMonitor.deleteWarningCounts, {
        characters: t(translations.settings.saveFileMonitor.deletedCharacters, {
          count: existingData.characters,
        }),
        progress: t(translations.settings.saveFileMonitor.deletedProgress, {
          count: existingData.progress,
        }),
      })
    : t(translations.settings.saveFileMonitor.deleteWarning);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        // Focus the safe "Back up first" path instead of the first button
        initialFocus={
          isBackupSuggested ? () => document.getElementById(backupButtonId) ?? true : undefined
        }
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
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
            <span className="mb-2 block font-medium text-destructive">{deleteWarning}</span>
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
            <Button
              id={backupButtonId}
              variant={isBackupSuggested ? 'default' : 'outline'}
              onClick={onBackup}
              disabled={isBusy}
              className="gap-2"
            >
              <Download className="h-3 w-3" />
              {isBackingUp
                ? t(translations.settings.database.creatingBackup)
                : t(translations.settings.database.backupFirst)}
            </Button>
          )}
          <AlertDialogAction onClick={onConfirm} disabled={isBusy} variant="destructive">
            {t(getConfirmLabelKey(action, isProcessing))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
