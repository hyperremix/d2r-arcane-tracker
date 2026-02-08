import DOMPurify from 'dompurify';
import type { UpdateInfo } from 'electron/types/grail';
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
import { formatShortDate } from '@/lib/utils';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo?: UpdateInfo;
  onDownload?: () => void;
  onInstall?: () => void;
  isInstallDialog?: boolean;
}

/**
 * UpdateDialog component that displays information about available updates.
 * Shows update version, release date, and release notes.
 * Provides actions for downloading or installing updates.
 * @param {UpdateDialogProps} props - Component props
 * @returns {JSX.Element} An alert dialog for update notifications
 */
export function UpdateDialog({
  open,
  onOpenChange,
  updateInfo,
  onDownload,
  onInstall,
  isInstallDialog = false,
}: UpdateDialogProps) {
  const { t } = useTranslation();

  const handlePrimaryAction = () => {
    if (isInstallDialog && onInstall) {
      onInstall();
    } else if (onDownload) {
      onDownload();
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!updateInfo) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isInstallDialog
              ? t(translations.settings.updateDialog.updateReadyToInstall)
              : t(translations.settings.updateDialog.updateAvailable)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="sr-only">
              {t(translations.settings.updateDialog.updateInformation)}
            </span>
          </AlertDialogDescription>
          <div className="space-y-3">
            <div>
              <p className="font-medium text-sm">
                {t(translations.settings.updateDialog.version, { version: updateInfo.version })}
                {updateInfo.releaseDate && (
                  <span className="ml-2 font-normal text-gray-600 dark:text-gray-400">
                    {t(translations.settings.updateDialog.released, {
                      date: formatShortDate(updateInfo.releaseDate),
                    })}
                  </span>
                )}
              </p>
            </div>

            {updateInfo.releaseNotes && (
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                <p className="mb-2 font-medium text-sm">
                  {t(translations.settings.updateDialog.releaseNotes)}
                </p>
                <div className="max-h-48 overflow-y-auto text-xs">
                  <div
                    className="release-notes"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized with DOMPurify before rendering
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(updateInfo.releaseNotes),
                    }}
                  />
                </div>
              </div>
            )}

            {isInstallDialog ? (
              <p className="text-sm">{t(translations.settings.updateDialog.installDescription)}</p>
            ) : (
              <p className="text-sm">{t(translations.settings.updateDialog.downloadDescription)}</p>
            )}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {t(translations.settings.updateDialog.later)}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handlePrimaryAction}>
            {isInstallDialog
              ? t(translations.settings.updateDialog.restartNow)
              : t(translations.settings.updateDialog.downloadNow)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
