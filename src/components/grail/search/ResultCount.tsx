import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { useItemResultCount } from '@/stores/grailStore';

/**
 * Props for the ResultCount component.
 */
interface ResultCountProps {
  className?: string;
}

/**
 * Live "N of M items" count of the items matching the current filters.
 * Announced politely to screen readers whenever it changes.
 */
export function ResultCount({ className }: ResultCountProps) {
  const { t } = useTranslation();
  const { shown, total } = useItemResultCount();

  return (
    <output
      aria-live="polite"
      className={cn('text-muted-foreground text-xs tabular-nums', className)}
    >
      {total > 0 && t(translations.grail.advancedSearch.resultCount, { shown, count: total })}
    </output>
  );
}
