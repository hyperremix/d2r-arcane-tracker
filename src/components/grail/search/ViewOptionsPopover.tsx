import { LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { translations } from '@/i18n/translations';
import { GroupBySelect } from './GroupBySelect';
import type { GroupMode, SortBy, SortOrder, ViewMode } from './options';
import { SegmentButton, SegmentedControl } from './SegmentedControl';
import { SortControls } from './SortControls';

/**
 * Props for the ViewOptionsPopover component.
 */
interface ViewOptionsPopoverProps {
  viewMode: ViewMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  groupMode: GroupMode;
  /** Whether grouping by ethereal status is offered (only if ethereal items are tracked). */
  showEthereal: boolean;
  onViewModeChange: (viewMode: ViewMode) => void;
  onSortByChange: (sortBy: SortBy) => void;
  onSortOrderChange: (sortOrder: SortOrder) => void;
  onGroupModeChange: (groupMode: GroupMode) => void;
}

/**
 * "View" button of the grail toolbar with a popover holding the grid/list switch, sorting and
 * grouping. The trigger icon shows the current view mode.
 */
export function ViewOptionsPopover({
  viewMode,
  sortBy,
  sortOrder,
  groupMode,
  showEthereal,
  onViewModeChange,
  onSortByChange,
  onSortOrderChange,
  onGroupModeChange,
}: ViewOptionsPopoverProps) {
  const { t } = useTranslation();
  const ViewModeIcon = viewMode === 'list' ? List : LayoutGrid;

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-9" />}>
        <ViewModeIcon aria-hidden="true" />
        {t(translations.grail.advancedSearch.view)}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={t(translations.grail.advancedSearch.viewOptions)}
        className="w-72"
      >
        <SegmentedControl legend={t(translations.grail.advancedSearch.viewMode)} fullWidth>
          <SegmentButton pressed={viewMode === 'grid'} onClick={() => onViewModeChange('grid')}>
            <LayoutGrid aria-hidden="true" />
            {t(translations.grail.advancedSearch.grid)}
          </SegmentButton>
          <SegmentButton pressed={viewMode === 'list'} onClick={() => onViewModeChange('list')}>
            <List aria-hidden="true" />
            {t(translations.grail.advancedSearch.list)}
          </SegmentButton>
        </SegmentedControl>
        <SortControls
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortByChange={onSortByChange}
          onSortOrderChange={onSortOrderChange}
        />
        <GroupBySelect
          groupMode={groupMode}
          showEthereal={showEthereal}
          onGroupModeChange={onGroupModeChange}
        />
      </PopoverContent>
    </Popover>
  );
}
