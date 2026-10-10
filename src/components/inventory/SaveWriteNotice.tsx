import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { translations } from '@/i18n/translations';

/**
 * Standing notice of the inventory views: moves, vaulting and unvaulting write straight to the save
 * files, so the game has to be closed while items are changed here.
 */
export function SaveWriteNotice() {
  const { t } = useTranslation();

  return (
    <Alert live="polite" data-testid="save-write-notice">
      <Info aria-hidden="true" />
      <AlertTitle>{t(translations.inventoryBrowser.saveWriteNotice.title)}</AlertTitle>
      <AlertDescription>
        {t(translations.inventoryBrowser.saveWriteNotice.description)}
      </AlertDescription>
    </Alert>
  );
}
