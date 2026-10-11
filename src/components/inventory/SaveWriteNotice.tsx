import { ChevronDown, Info } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

/**
 * Standing notice of the inventory views: moves, vaulting and unvaulting write straight to the save
 * files, so the game has to be closed while items are changed here. It takes one line with the key
 * instruction; the full explanation is a toggle away. It can't be dismissed, so the safety message
 * stays on every inventory view.
 */
export function SaveWriteNotice() {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();

  return (
    <Alert live="polite" data-testid="save-write-notice" className="py-2">
      <Info aria-hidden="true" />
      <div className="col-start-2 flex flex-wrap items-center justify-between gap-x-3">
        <AlertTitle className="line-clamp-none">
          {t(translations.inventoryBrowser.saveWriteNotice.title)}
        </AlertTitle>
        <Button
          variant="link"
          size="xs"
          className="px-0"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded
            ? t(translations.inventoryBrowser.saveWriteNotice.hideDetails)
            : t(translations.inventoryBrowser.saveWriteNotice.showDetails)}
          <ChevronDown
            aria-hidden="true"
            className={cn('transition-transform', isExpanded && 'rotate-180')}
          />
        </Button>
      </div>
      <AlertDescription id={detailsId} hidden={!isExpanded} className="pt-1">
        {t(translations.inventoryBrowser.saveWriteNotice.description)}
      </AlertDescription>
    </Alert>
  );
}
