import type { FarmingDataUnavailable } from 'electron/types/grail';
import { AlertCircle, FolderCog, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';

/**
 * Explains why the farming data can't be read, with the action that fixes it: setting the D2R
 * installation folder, or extracting the game files.
 */
export function FarmingDataNotice({ unavailable }: { unavailable: FarmingDataUnavailable }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openSettings = (
    <Button type="button" onClick={() => navigate('/settings')} className="mt-2">
      <Settings aria-hidden="true" />
      {t(translations.terrorZone.openInstallationSettings)}
    </Button>
  );

  if (unavailable.errorCode === 'pathNotConfigured') {
    return (
      <div
        data-testid="farming-not-configured"
        className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
      >
        <FolderCog aria-hidden="true" className="size-10 text-muted-foreground" />
        <h2 className="font-semibold text-foreground text-lg">
          {t(translations.farming.notConfigured.title)}
        </h2>
        <p className="max-w-md text-muted-foreground text-sm">
          {t(translations.farming.notConfigured.description)}
        </p>
        {openSettings}
      </div>
    );
  }

  return (
    <Alert className="border-destructive/30 bg-destructive/10">
      <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
      <AlertTitle className="font-bold text-destructive">
        {unavailable.errorCode === 'gameFilesMissing'
          ? t(translations.farming.gameFilesMissing.title)
          : t(translations.common.error)}
      </AlertTitle>
      <AlertDescription className="space-y-2 text-destructive">
        <p>
          {unavailable.errorCode === 'gameFilesMissing'
            ? t(translations.farming.gameFilesMissing.description, {
                files: (unavailable.missingFiles ?? []).join(', '),
              })
            : t(translations.farming.readFailed)}
        </p>
        <p>{t(translations.terrorZone.extractionNote)}</p>
      </AlertDescription>
    </Alert>
  );
}
