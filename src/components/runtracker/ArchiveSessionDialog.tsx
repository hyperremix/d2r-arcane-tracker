import { Loader2 } from 'lucide-react';
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

interface ArchiveSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}

/**
 * Confirmation dialog shown before archiving a run tracker session.
 * Shared by the active session card and the session detail view.
 */
export function ArchiveSessionDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: ArchiveSessionDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(translations.runTracker.archiveDialog.title)}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(translations.runTracker.archiveDialog.description)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t(translations.common.cancel)}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {pending
              ? t(translations.runTracker.archiveDialog.archiving)
              : t(translations.runTracker.archiveDialog.confirm)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
