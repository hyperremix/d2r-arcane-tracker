import { useVirtualizer } from '@tanstack/react-virtual';
import type { Character, Item, Settings } from 'electron/types/grail';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { translations } from '@/i18n/translations';
import {
  filterItemsByTrackedVersions,
  shouldShowEtherealStatus,
  shouldShowNormalStatus,
} from '@/lib/ethereal';
import { itemCategoryLabelKeys, itemTypeLabelKeys } from '@/lib/labelKeys';
import { countActiveFilters, useFilteredItems, useGrailStore } from '@/stores/grailStore';
import { ItemDetailsDialog } from './ItemDetailsDialog';
import { getItemGridEmptyStateVariant, ItemGridEmptyState } from './ItemGridEmptyState';
import type { ItemGridGroup } from './VirtualItemGrid';
import { ItemCardCell, VirtualItemGrid } from './VirtualItemGrid';

/**
 * Determines the ethereal grouping key for an item based on its ethereal status and progress.
 * @param {Item} itemData - The Holy Grail item data
 * @param {{ normalFound: boolean; etherealFound: boolean } | undefined} itemProgress - The progress data for the item
 * @returns {string} A string key representing the item's ethereal status group
 */
function getEtherealGroupKey(
  itemData: Item,
  itemProgress: { normalFound: boolean; etherealFound: boolean } | undefined,
  settings: Settings,
  t: (key: string) => string,
) {
  const hasEthereal = itemProgress?.etherealFound;
  const hasNormal = itemProgress?.normalFound;
  const canBeEthereal = shouldShowEtherealStatus(itemData, settings);
  const canBeNormal = shouldShowNormalStatus(itemData, settings);

  if (!canBeEthereal && !canBeNormal) {
    return t(translations.grail.itemGrid.notApplicable);
  }
  if (!canBeEthereal) {
    return hasNormal
      ? t(translations.grail.itemGrid.normalFound)
      : t(translations.grail.itemGrid.normalNotFound);
  }
  if (!canBeNormal) {
    return hasEthereal
      ? t(translations.grail.itemGrid.etherealFound)
      : t(translations.grail.itemGrid.etherealNotFound);
  }
  if (hasEthereal && hasNormal) {
    return t(translations.grail.itemGrid.bothFound);
  }
  if (hasEthereal) {
    return t(translations.grail.itemGrid.etherealOnly);
  }
  if (hasNormal) {
    return t(translations.grail.itemGrid.normalOnly);
  }
  return t(translations.grail.itemGrid.neitherFound);
}

/**
 * Type representing the available view modes for displaying items.
 */
type ViewMode = 'grid' | 'list';
/**
 * Type representing the available grouping modes for organizing items.
 */
type GroupMode = 'none' | 'category' | 'type' | 'ethereal';

/**
 * A group of items before its found count is known (the count is added for the grid).
 */
type ItemGroup = Omit<ItemGridGroup, 'foundCount'>;

/**
 * ItemGrid component that displays Holy Grail items in a filterable, sortable, and groupable grid or list view.
 * Supports multiple view modes (grid/list) and grouping options (category, type, ethereal status).
 * Memoized to prevent unnecessary re-renders when parent component updates.
 * @returns {JSX.Element} A grid or list of Holy Grail items with view and grouping controls
 */
export const ItemGrid = memo(function ItemGrid() {
  const { t } = useTranslation();
  // Use individual selectors to prevent unnecessary re-renders
  const progress = useGrailStore((state) => state.progress);
  const characters = useGrailStore((state) => state.characters);
  const settings = useGrailStore((state) => state.settings);
  const viewMode = useGrailStore((state) => state.viewMode);
  const groupMode = useGrailStore((state) => state.groupMode);
  const setGroupMode = useGrailStore((state) => state.setGroupMode);
  const totalItemCount = useGrailStore((state) => state.items.length);
  const loading = useGrailStore((state) => state.loading);
  const hasActiveFilters = useGrailStore((state) => countActiveFilters(state.filter) > 0);
  const filteredItems = useFilteredItems(); // This uses DB items as base and applies all filters
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Keep only items with a tracked version (normal and/or ethereal) according to grail settings
  const displayItems = useMemo(
    () =>
      filterItemsByTrackedVersions(filteredItems, {
        grailNormal: settings.grailNormal,
        grailEthereal: settings.grailEthereal,
      }),
    [filteredItems, settings.grailNormal, settings.grailEthereal],
  );

  // Create a lookup map for progress data including both normal and ethereal versions
  const progressLookup = useProgressLookup(displayItems, progress, settings);

  // Reset group mode to 'none' if ethereal grouping is selected but ethereal tracking is disabled,
  // since the "By Ethereal" option is only offered while ethereal tracking is enabled
  useEffect(() => {
    if (groupMode === 'ethereal' && !settings.grailEthereal) {
      setGroupMode('none');
    }
  }, [groupMode, settings.grailEthereal, setGroupMode]);

  const groupedItems = useMemo(() => {
    if (groupMode === 'none') {
      return [{ title: t(translations.common.allItems), items: displayItems }];
    }

    const groups = new Map<string, typeof displayItems>();

    displayItems.forEach((itemData) => {
      let groupKey = '';

      switch (groupMode) {
        case 'category':
          groupKey = t(itemCategoryLabelKeys[itemData.category]);
          break;
        case 'type':
          groupKey = t(itemTypeLabelKeys[itemData.type]);
          break;
        case 'ethereal': {
          // For consolidated view, group by whether either version is found
          const itemProgress = progressLookup.get(itemData.id);
          groupKey = getEtherealGroupKey(itemData, itemProgress, settings, t);
          break;
        }
        default:
          groupKey = t(translations.common.allItems);
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      const group = groups.get(groupKey);
      if (group) {
        group.push(itemData);
      }
    });

    return Array.from(groups.entries()).map(([title, items]) => ({ title, items }));
  }, [displayItems, groupMode, progressLookup, settings, t]);

  const handleItemClick = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
  }, []);

  const emptyStateVariant = getItemGridEmptyStateVariant({
    displayItemCount: displayItems.length,
    totalItemCount,
    grailNormal: settings.grailNormal,
    grailEthereal: settings.grailEthereal,
    hasActiveFilters,
    loading,
  });

  // The root fills the bounded height given by its parent so the grid/list container below is the
  // single scroll container; that bounded height is what lets the virtualizers mount only the
  // cards near the viewport instead of every card.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {emptyStateVariant ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ItemGridEmptyState variant={emptyStateVariant} />
        </div>
      ) : (
        /* Items Grid with Virtual Scrolling */
        <VirtualizedItemsContainer
          groupedItems={groupedItems}
          viewMode={viewMode}
          groupMode={groupMode}
          progressLookup={progressLookup}
          characters={characters}
          handleItemClick={handleItemClick}
        />
      )}

      {/* Item Details Dialog */}
      <ItemDetailsDialog
        itemId={selectedItemId}
        open={!!selectedItemId}
        onOpenChange={(open) => !open && setSelectedItemId(null)}
      />
    </div>
  );
});

/**
 * Type representing a virtual row item, which can be either a group header or item row(s).
 */
type VirtualRowType =
  | { type: 'header'; groupTitle: string; itemCount: number; foundCount: number }
  | { type: 'items'; items: Item[]; groupIndex: number };

/**
 * Props interface for VirtualizedItemsContainer component.
 */
interface VirtualizedItemsContainerProps {
  groupedItems: ItemGroup[];
  viewMode: ViewMode;
  groupMode: GroupMode;
  progressLookup: ReturnType<typeof useProgressLookup>;
  characters: Character[];
  handleItemClick: (itemId: string) => void;
}

/**
 * Creates item rows for list view with one item per row.
 * @param {Item[]} items - Items to convert to rows
 * @param {number} groupIndex - Index of the group
 * @returns {VirtualRowType[]} Array of virtual row objects
 */
function createListRows(items: Item[], groupIndex: number): VirtualRowType[] {
  return items.map((item) => ({
    type: 'items' as const,
    items: [item],
    groupIndex,
  }));
}

/**
 * Calculates the number of items found in a group.
 * @param {Item[]} items - Items in the group
 * @param {Map} progressLookup - Progress lookup map
 * @returns {number} Number of found items
 */
function calculateGroupFoundCount(
  items: Item[],
  progressLookup: Map<string, { overallFound: boolean }>,
): number {
  let foundCount = 0;
  for (const item of items) {
    if (progressLookup.get(item.id)?.overallFound) {
      foundCount++;
    }
  }
  return foundCount;
}

/**
 * Props for renderVirtualRow function.
 */
interface RenderVirtualRowProps {
  virtualRow: ReturnType<ReturnType<typeof useVirtualizer>['getVirtualItems']>[number];
  row: VirtualRowType;
  progressLookup: ReturnType<typeof useProgressLookup>;
  characters: Character[];
  handleItemClick: (itemId: string) => void;
}

/**
 * Renders a single virtual row (header or list item).
 */
function renderVirtualRow({
  virtualRow,
  row,
  progressLookup,
  characters,
  handleItemClick,
}: RenderVirtualRowProps): JSX.Element | null {
  if (row.type === 'header') {
    return (
      <div
        key={virtualRow.key}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
        }}
      >
        <div className="flex items-center gap-2 py-4">
          <h3 className="font-semibold text-lg">{row.groupTitle}</h3>
          <Badge variant="outline">
            {row.foundCount}/{row.itemCount}
          </Badge>
        </div>
      </div>
    );
  }

  // List view item
  const item = row.items[0];
  if (!item) return null;

  return (
    <div
      key={virtualRow.key}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      <ItemCardCell
        item={item}
        progressLookup={progressLookup}
        characters={characters}
        onItemClick={handleItemClick}
        viewMode="list"
      />
    </div>
  );
}

/**
 * Props for the ListVirtualizedContainer component.
 */
interface ListVirtualizedContainerProps {
  groupedItems: ItemGroup[];
  groupMode: GroupMode;
  progressLookup: ReturnType<typeof useProgressLookup>;
  characters: Character[];
  handleItemClick: (itemId: string) => void;
}

/**
 * ListVirtualizedContainer component that renders items in row-based virtualization.
 * Used for list view only.
 */
function ListVirtualizedContainer({
  groupedItems,
  groupMode,
  progressLookup,
  characters,
  handleItemClick,
}: ListVirtualizedContainerProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten groups into virtual rows (headers + item rows)
  const virtualRows = useMemo<VirtualRowType[]>(() => {
    const rows: VirtualRowType[] = [];

    for (const [groupIndex, group] of groupedItems.entries()) {
      // Add header row if grouping is enabled
      if (groupMode !== 'none') {
        const foundCount = calculateGroupFoundCount(group.items, progressLookup);
        rows.push({
          type: 'header',
          groupTitle: group.title,
          itemCount: group.items.length,
          foundCount,
        });
      }

      rows.push(...createListRows(group.items, groupIndex));
    }

    return rows;
  }, [groupedItems, groupMode, progressLookup]);

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (row.type === 'header') return 56; // Header height
      return 80; // List item height
    },
    overscan: 5, // Render 5 rows above and below viewport
  });

  return (
    <div ref={listRef} className="min-h-0 w-full flex-1 overflow-auto p-4">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) =>
          renderVirtualRow({
            virtualRow,
            row: virtualRows[virtualRow.index],
            progressLookup,
            characters,
            handleItemClick,
          }),
        )}
      </div>
    </div>
  );
}

/**
 * Props for the GridContainer component.
 */
interface GridContainerProps {
  groupedItems: ItemGroup[];
  showGroupHeaders: boolean;
  progressLookup: ReturnType<typeof useProgressLookup>;
  characters: Character[];
  handleItemClick: (itemId: string) => void;
}

/**
 * GridContainer component that renders the (optionally grouped) items in the virtualized grid.
 * The groups with their found counts are memoized so the memoized grid (and its row model) is
 * only recomputed when the groups or the progress change, not on unrelated ItemGrid renders.
 */
function GridContainer({
  groupedItems,
  showGroupHeaders,
  progressLookup,
  characters,
  handleItemClick,
}: GridContainerProps) {
  const groupsWithFoundCount = useMemo(
    () =>
      groupedItems.map((group) => ({
        ...group,
        // The found count is only shown in group headers, so skip counting when they are hidden
        foundCount: showGroupHeaders
          ? calculateGroupFoundCount(group.items, progressLookup)
          : undefined,
      })),
    [groupedItems, progressLookup, showGroupHeaders],
  );

  return (
    <VirtualItemGrid
      groupedItems={groupsWithFoundCount}
      showGroupHeaders={showGroupHeaders}
      progressLookup={progressLookup}
      characters={characters}
      onItemClick={handleItemClick}
    />
  );
}

/**
 * VirtualizedItemsContainer component that renders all items with virtual scrolling.
 * Both the grid and the list view use row-based virtualization.
 * @param {VirtualizedItemsContainerProps} props - Component props
 * @returns {JSX.Element} A virtualized container of all items
 */
function VirtualizedItemsContainer({
  groupedItems,
  viewMode,
  groupMode,
  progressLookup,
  characters,
  handleItemClick,
}: VirtualizedItemsContainerProps) {
  // For grid view, use row-based virtualization with a header above each group (when grouped).
  // The key remounts the grid (resetting its scroll position) when switching between the
  // ungrouped and the grouped layout.
  if (viewMode === 'grid') {
    const showGroupHeaders = groupMode !== 'none';
    return (
      <GridContainer
        key={showGroupHeaders ? 'grouped' : 'ungrouped'}
        groupedItems={groupedItems}
        showGroupHeaders={showGroupHeaders}
        progressLookup={progressLookup}
        characters={characters}
        handleItemClick={handleItemClick}
      />
    );
  }

  // For list view, use row-based virtualization
  return (
    <ListVirtualizedContainer
      groupedItems={groupedItems}
      groupMode={groupMode}
      progressLookup={progressLookup}
      characters={characters}
      handleItemClick={handleItemClick}
    />
  );
}
