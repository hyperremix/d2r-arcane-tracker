import type { FarmingDataUnavailable } from 'electron/types/grail';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { D2RFolderPrompt } from '@/components/terror-zone/D2RFolderPrompt';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { translations } from '@/i18n/translations';

/**
 * Explains why the farming data can't be read, with the action that fixes it: setting the D2R
 * installation folder, or extracting the game files.
 */
export function FarmingDataNotice({ unavailable }: { unavailable: FarmingDataUnavailable }) {
  const { t } = useTranslation();

  if (unavailable.errorCode === 'pathNotConfigured') {
    return <D2RFolderPrompt layout="page" />;
  }

  return (
    <Alert variant="warning">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>
        {unavailable.errorCode === 'gameFilesMissing'
          ? t(translations.farming.gameFilesMissing.title)
          : t(translations.common.error)}
      </AlertTitle>
      <AlertDescription className="space-y-2">
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
