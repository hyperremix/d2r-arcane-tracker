import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RollQualityBadge } from '@/components/inventory/RollQuality';
import { Badge } from '@/components/ui/badge';
import { translations } from '@/i18n/translations';
import type { ItemRollQuality } from '@/lib/rollQuality';

interface ItemSummaryRowProps {
  title: string;
  subtitle?: string;
  ethereal: boolean;
  rollQuality?: ItemRollQuality;
  /** Extra badge shown before the roll quality, for example "Best roll". */
  highlight?: ReactNode;
}

/** One item in a compact list: a title and subtitle, ethereal and roll quality badges. */
export function ItemSummaryRow({
  title,
  subtitle,
  ethereal,
  rollQuality,
  highlight,
}: ItemSummaryRowProps) {
  const { t } = useTranslation();

  return (
    <span className="flex w-full items-center gap-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-sm">{title}</span>
        {subtitle && <span className="truncate text-muted-foreground text-xs">{subtitle}</span>}
      </span>
      {ethereal && (
        <Badge variant="secondary" className="shrink-0">
          {t(translations.grail.itemDetails.ethereal)}
        </Badge>
      )}
      {highlight}
      {rollQuality && <RollQualityBadge rollQuality={rollQuality} />}
    </span>
  );
}
