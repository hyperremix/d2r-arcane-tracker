import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { type SortBy, type SortOrder, sortLabelKeys, sortOptionValues } from './options';

interface SortControlsProps {
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortByChange: (sortBy: SortBy) => void;
  onToggleSortOrder: () => void;
}

/**
 * Sort field select and sort direction toggle of the grail toolbar.
 */
export function SortControls({
  sortBy,
  sortOrder,
  onSortByChange,
  onToggleSortOrder,
}: SortControlsProps) {
  const { t } = useTranslation();
  const sortById = useId();
  const sortOrderLabel = t(translations.grail.advancedSearch.sortOrderValue, {
    order: t(
      sortOrder === 'asc'
        ? translations.grail.advancedSearch.ascending
        : translations.grail.advancedSearch.descending,
    ),
  });

  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={sortById} className="text-muted-foreground text-xs">
        {t(translations.grail.advancedSearch.sortBy)}
      </Label>
      <Select value={sortBy} onValueChange={(value) => onSortByChange(value as SortBy)}>
        <SelectTrigger id={sortById} className="h-9 min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptionValues.map((value) => (
            <SelectItem key={value} value={value}>
              {t(sortLabelKeys[value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label={sortOrderLabel}
              onClick={onToggleSortOrder}
            />
          }
        >
          {sortOrder === 'asc' ? (
            <ArrowUpNarrowWide aria-hidden="true" />
          ) : (
            <ArrowDownWideNarrow aria-hidden="true" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          <p>{sortOrderLabel}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
