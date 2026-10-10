import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translations } from '@/i18n/translations';
import { type SortBy, type SortOrder, sortLabelKeys, sortOptionValues } from './options';
import { SegmentButton, SegmentedControl } from './SegmentedControl';

interface SortControlsProps {
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortByChange: (sortBy: SortBy) => void;
  onSortOrderChange: (sortOrder: SortOrder) => void;
}

/**
 * Sort field select and sort direction control of the grail view options.
 */
export function SortControls({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
}: SortControlsProps) {
  const { t } = useTranslation();
  const sortById = useId();
  // Base UI renders the trigger label from `items`; without it the raw value would be shown
  const sortOptions = sortOptionValues.map((value) => ({
    value,
    label: t(sortLabelKeys[value]),
  }));

  return (
    <div className="grid gap-2">
      <Label htmlFor={sortById} className="text-muted-foreground text-xs">
        {t(translations.grail.advancedSearch.sortBy)}
      </Label>
      <Select
        items={sortOptions}
        value={sortBy}
        onValueChange={(value) => value && onSortByChange(value as SortBy)}
      >
        <SelectTrigger id={sortById} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SegmentedControl legend={t(translations.grail.advancedSearch.sortOrder)} fullWidth>
        <SegmentButton pressed={sortOrder === 'asc'} onClick={() => onSortOrderChange('asc')}>
          <ArrowUpNarrowWide aria-hidden="true" />
          {t(translations.grail.advancedSearch.ascending)}
        </SegmentButton>
        <SegmentButton pressed={sortOrder === 'desc'} onClick={() => onSortOrderChange('desc')}>
          <ArrowDownWideNarrow aria-hidden="true" />
          {t(translations.grail.advancedSearch.descending)}
        </SegmentButton>
      </SegmentedControl>
    </div>
  );
}
