import DOMPurify from 'dompurify';
import type { UpdateInfo } from 'electron/types/grail';
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
            {isInstallDialog ? 'Update Ready to Install' : 'Update Available'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-sm">
                  Version {updateInfo.version}
                  {updateInfo.releaseDate && (
                    <span className="ml-2 font-normal text-gray-600 dark:text-gray-400">
                      Released: {new Date(updateInfo.releaseDate).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>

              {updateInfo.releaseNotes && (
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                  <p className="mb-2 font-medium text-sm">Release Notes:</p>
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
                <p className="text-sm">
                  The update has been downloaded and is ready to install. The application will
                  restart to complete the installation.
                </p>
              ) : (
                <p className="text-sm">
                  A new version of the application is available. Would you like to download it now?
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Later</AlertDialogCancel>
          <AlertDialogAction onClick={handlePrimaryAction}>
            {isInstallDialog ? 'Restart Now' : 'Download Now'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
