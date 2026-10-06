import { AlertCircle } from 'lucide-react';
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
import { translations } from '@/i18n/translations';

/**
 * The kind of save directory change being confirmed.
 */
export type SaveDirectoryChangeAction = 'change' | 'restore';

/**
 * Props for the SaveDirectoryChangeDialog component.
 */
export interface SaveDirectoryChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: SaveDirectoryChangeAction;
  isProcessing: boolean;
  onConfirm: () => void;
}

/**
 * Destructive confirmation dialog shown before changing the monitored save directory.
 * Warns that switching directories permanently deletes characters and grail progress.
 * @param {SaveDirectoryChangeDialogProps} props - Dialog state and callbacks
 * @returns {JSX.Element} An alert dialog asking the user to confirm the directory change
 */
export function SaveDirectoryChangeDialog({
  open,
  onOpenChange,
  action,
  isProcessing,
  onConfirm,
}: SaveDirectoryChangeDialogProps) {
  const { t } = useTranslation();
  const isRestore = action === 'restore';

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
          <AlertDialogDescription>
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
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>
            {t(translations.common.cancel)}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isProcessing} variant="destructive">
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
