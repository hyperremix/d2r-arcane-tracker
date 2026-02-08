import type { GrailProgress, Item } from 'electron/types/grail';
import { Calendar, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { formatDate } from '@/lib/utils';

// Component for progress status section
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t(translations.grail.itemDetails.progressStatus)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
          {/* Overall Status */}
          <span className="font-medium">{t(translations.grail.itemDetails.overallStatus)}</span>
          <Badge variant={isFound ? 'default' : 'secondary'} className="w-fit capitalize">
            {isFound ? t(translations.common.found) : t(translations.common.notFound)}
          </Badge>

          {/* Normal Status */}
          {item.etherealType !== 'none' && (
            <>
              <span className="font-medium">{t(translations.grail.itemDetails.normalStatus)}</span>
              <Badge variant={normalFound ? 'default' : 'secondary'} className="w-fit capitalize">
                {normalFound ? t(translations.common.found) : t(translations.common.notFound)}
              </Badge>
            </>
          )}

          {/* Ethereal Status */}
          {item.etherealType !== 'none' && (
            <>
              <span className="font-medium">
                {t(translations.grail.itemDetails.etherealStatus)}
              </span>
              <Badge variant={etherealFound ? 'default' : 'secondary'} className="w-fit capitalize">
                {etherealFound ? t(translations.common.found) : t(translations.common.notFound)}
              </Badge>
            </>
          )}
        </div>
      </CardContent>
    </Card>
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
