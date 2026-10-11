import type { GrailProgress, Item } from 'electron/types/grail';
import { Calendar, Check, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { formatDate } from '@/lib/date';
import { cn } from '@/lib/utils';

function getStatusClasses(isFound: boolean): string {
  return cn('inline-flex items-center gap-1 font-medium', isFound ? 'text-found' : 'text-missing');
}

/**
 * "Found" / "Not Found" text with a matching icon. Color, icon and text all carry the state, so
 * it doesn't rely on hue alone.
 */
function StatusText({ isFound }: { isFound: boolean }) {
  const { t } = useTranslation();

  return (
    <>
      {isFound ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Circle className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {isFound ? t(translations.common.found) : t(translations.common.notFound)}
    </>
  );
}

/**
 * The item's found status as a single line under its name. Items that can be ethereal show the
 * status of the normal and the ethereal version side by side instead.
 */
export function ProgressStatusSection({
  item,
  itemProgress,
}: {
  item: Item;
  itemProgress:
    | { normalFound: boolean; etherealFound: boolean; overallFound: boolean }
    | null
    | undefined;
}) {
  const { t } = useTranslation();
  const isFound = itemProgress?.overallFound || false;
  const normalFound = itemProgress?.normalFound || false;
  const etherealFound = itemProgress?.etherealFound || false;

  if (item.etherealType === 'none') {
    return (
      <p className={getStatusClasses(isFound)}>
        <StatusText isFound={isFound} />
      </p>
    );
  }

  return (
    <dl className="flex flex-wrap justify-center gap-x-4 gap-y-1">
      <div className="flex items-center gap-1">
        <dt className="text-muted-foreground">{t(translations.grail.itemDetails.normalStatus)}</dt>
        <dd className={getStatusClasses(normalFound)}>
          <StatusText isFound={normalFound} />
        </dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="text-muted-foreground">
          {t(translations.grail.itemDetails.etherealStatus)}
        </dt>
        <dd className={getStatusClasses(etherealFound)}>
          <StatusText isFound={etherealFound} />
        </dd>
      </div>
    </dl>
  );
}

// Component for found dates
export function FoundDates({
  normalProgress,
  etherealProgress,
}: {
  normalProgress: GrailProgress | undefined;
  etherealProgress: GrailProgress | undefined;
}) {
  const { t } = useTranslation();
  const hasAnyDate = normalProgress?.foundDate || etherealProgress?.foundDate;

  if (!hasAnyDate) {
    return <span className="text-xs">{t(translations.common.never)}</span>;
  }

  return (
    <div className="space-y-1">
      {normalProgress?.foundDate && (
        <div className="flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3" />
          {formatDate(normalProgress.foundDate)}
        </div>
      )}
      {etherealProgress?.foundDate && (
        <div className="flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3" />
          {formatDate(etherealProgress.foundDate)}
        </div>
      )}
    </div>
  );
}

// Component for detection methods
export function DetectionMethods({
  normalProgress,
  etherealProgress,
}: {
  normalProgress: GrailProgress | undefined;
  etherealProgress: GrailProgress | undefined;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      {normalProgress && (
        <span className="text-xs">
          {normalProgress.manuallyAdded
            ? t(translations.common.manual)
            : t(translations.common.auto)}
        </span>
      )}
      {etherealProgress && (
        <span className="text-xs">
          {etherealProgress.manuallyAdded
            ? t(translations.common.manual)
            : t(translations.common.auto)}
        </span>
      )}
    </div>
  );
}
