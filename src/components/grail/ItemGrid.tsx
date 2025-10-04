import { useVirtualizer } from '@tanstack/react-virtual';
import type { Character, Item, Settings } from 'electron/types/grail';
import { Grid, List } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProgressLookup } from '@/hooks/useProgressLookup';
import {
  canItemBeEthereal,
  canItemBeNormal,
  shouldShowEtherealStatus,
  shouldShowNormalStatus,
} from '@/lib/ethereal';
import { cn } from '@/lib/utils';
import { useFilteredItems, useGrailStore } from '@/stores/grailStore';
import { ItemCard } from './ItemCard';
import { ItemDetailsDialog } from './ItemDetailsDialog';

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
) {
  const hasEthereal = itemProgress?.etherealFound;
  const hasNormal = itemProgress?.normalFound;
  const canBeEthereal = shouldShowEtherealStatus(itemData, settings);
  const canBeNormal = shouldShowNormalStatus(itemData, settings);

  if (!canBeEthereal && !canBeNormal) {
    return 'Not Applicable';
  }
  if (!canBeEthereal) {
    return hasNormal ? 'Normal Found' : 'Normal Not Found';
  }
  if (!canBeNormal) {
    return hasEthereal ? 'Ethereal Found' : 'Ethereal Not Found';
  }
  if (hasEthereal && hasNormal) {
    return 'Both Found';
  }
  if (hasEthereal) {
    return 'Ethereal Only';
  }
  if (hasNormal) {
    return 'Normal Only';
  }
  return 'Neither Found';
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
 * ItemGrid component that displays Holy Grail items in a filterable, sortable, and groupable grid or list view.
 * Supports multiple view modes (grid/list) and grouping options (category, type, ethereal status).
 * Memoized to prevent unnecessary re-renders when parent component updates.
 * @returns {JSX.Element} A grid or list of Holy Grail items with view and grouping controls
 */
export const ItemGrid = memo(function ItemGrid() {
  const { progress, characters, selectedCharacterId, settings } = useGrailStore();
  const filteredItems = useFilteredItems(); // This uses DB items as base and applies all filters
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Helper function to filter items when only one grail type is enabled
  const filterSingleGrailType = useCallback(
    (items: Item[]) => {
      if (settings.grailNormal && !settings.grailEthereal) {
        return items.filter((item) => canItemBeNormal(item));
      }
      if (!settings.grailNormal && settings.grailEthereal) {
        return items.filter((item) => canItemBeEthereal(item));
      }
      return []; // Neither enabled
    },
    [settings.grailNormal, settings.grailEthereal],
  );

  // Filter items based on grail settings
  const displayItems = useMemo(() => {
    // If only one of normal/ethereal is enabled, use simple filtering
    if (!settings.grailNormal || !settings.grailEthereal) {
      return filterSingleGrailType(filteredItems);
    }

    // Both normal and ethereal are enabled - return all items (no deduplication needed)
    return filteredItems;
  }, [filteredItems, settings.grailNormal, settings.grailEthereal, filterSingleGrailType]);

  // Create a lookup map for progress data including both normal and ethereal versions
  const progressLookup = useProgressLookup(displayItems, progress, settings, selectedCharacterId);

  // Reset group mode to 'none' if ethereal grouping is selected but ethereal items are enabled
  useEffect(() => {
    if (groupMode === 'ethereal' && settings.grailEthereal) {
      setGroupMode('none');
    }
  }, [groupMode, settings.grailEthereal]);

  const groupedItems = useMemo(() => {
    if (groupMode === 'none') {
      return [{ title: 'All Items', items: displayItems }];
    }

    const groups = new Map<string, typeof displayItems>();

    displayItems.forEach((itemData) => {
      let groupKey = '';

      switch (groupMode) {
        case 'category':
          groupKey = itemData.category;
          break;
        case 'type':
          groupKey = itemData.type;
          break;
        case 'ethereal': {
          // For consolidated view, group by whether either version is found
          const itemProgress = progressLookup.get(itemData.id);
          groupKey = getEtherealGroupKey(itemData, itemProgress, settings);
          break;
        }
        default:
          groupKey = 'All Items';
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      const group = groups.get(groupKey);
      if (group) {
        group.push(itemData);
      }
    });

    return Array.from(groups.entries()).map(([title, items]) => ({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      items,
    }));
  }, [displayItems, groupMode, progressLookup, settings]);

  const handleItemClick = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
  }, []);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          {/* Group Mode */}
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="none">No Grouping</option>
            <option value="category">By Category</option>
            <option value="type">By Type</option>
            {settings.grailEthereal && <option value="ethereal">By Ethereal</option>}
          </select>

          {/* View Mode Toggle */}
          <div className="flex rounded border">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Items Grid with Virtual Scrolling */}
      <VirtualizedItemsContainer
        groupedItems={groupedItems}
        viewMode={viewMode}
        groupMode={groupMode}
        progressLookup={progressLookup}
        characters={characters}
        handleItemClick={handleItemClick}
        showItemIcons={settings.showItemIcons}
      />

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
  groupedItems: Array<{ title: string; items: Item[] }>;
  viewMode: ViewMode;
  groupMode: GroupMode;
  progressLookup: ReturnType<typeof useProgressLookup>;
  characters: Character[];
  handleItemClick: (itemId: string) => void;
  showItemIcons: boolean;
}

/**
 * Creates item rows for grid view by chunking items into rows based on column count.
 * @param {Item[]} items - Items to chunk into rows
 * @param {number} columnsCount - Number of columns per row
 * @param {number} groupIndex - Index of the group
 * @returns {VirtualRowType[]} Array of virtual row objects
 */
function createGridRows(items: Item[], columnsCount: number, groupIndex: number): VirtualRowType[] {
  const rows: VirtualRowType[] = [];
  for (let i = 0; i < items.length; i += columnsCount) {
    rows.push({
      type: 'items',
      items: items.slice(i, i + columnsCount),
      groupIndex,
    });
  }
  return rows;
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
 * VirtualizedItemsContainer component that renders all items with virtual scrolling using parent scroll.
 * Flattens grouped items into virtual rows and uses the parent container's scroll instead of creating a separate one.
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
  showItemIcons,
}: VirtualizedItemsContainerProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate columns for grid view based on viewport width
  const getColumnsCount = useCallback(() => {
    if (viewMode === 'list') return 1;

    const width = window.innerWidth;
    if (width >= 1536) return 7; // 2xl
    if (width >= 1280) return 6; // xl
    if (width >= 1024) return 5; // lg
    if (width >= 768) return 4; // md
    if (width >= 640) return 3; // sm
    return 2; // default
  }, [viewMode]);

  const [columnsCount, setColumnsCount] = useState(getColumnsCount);

  // Update columns count on window resize
  useEffect(() => {
    const handleResize = () => setColumnsCount(getColumnsCount());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getColumnsCount]);

  // Flatten groups into virtual rows (headers + item rows)
  const virtualRows = useMemo<VirtualRowType[]>(() => {
    const rows: VirtualRowType[] = [];

    for (const [groupIndex, group] of groupedItems.entries()) {
      // Add header row if grouping is enabled
      if (groupMode !== 'none') {
        const foundCount = group.items.filter(
          (item) => progressLookup.get(item.id)?.overallFound || false,
        ).length;
        rows.push({
          type: 'header',
          groupTitle: group.title,
          itemCount: group.items.length,
          foundCount,
        });
      }

      // Add item rows based on view mode
      const itemRows =
        viewMode === 'grid'
          ? createGridRows(group.items, columnsCount, groupIndex)
          : createListRows(group.items, groupIndex);
      rows.push(...itemRows);
    }

    return rows;
  }, [groupedItems, groupMode, viewMode, columnsCount, progressLookup]);

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (row.type === 'header') return 56; // Header height
      // Adjust grid height based on whether icons are shown
      const gridHeight = showItemIcons ? 256 : 180;
      return viewMode === 'grid' ? gridHeight : 80; // Grid row or list item height
    },
    overscan: 5, // Render 5 rows above and below viewport
  });

  return (
    <div ref={parentRef} className="w-full">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = virtualRows[virtualRow.index];

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

          // Item row
          if (viewMode === 'list') {
            const item = row.items[0];
            if (!item) return null;

            const itemProgressData = progressLookup.get(item.id);
            const normalProgress = itemProgressData?.normalProgress || [];
            const etherealProgress = itemProgressData?.etherealProgress || [];

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
                <ItemCard
                  item={item}
                  normalProgress={normalProgress}
                  etherealProgress={etherealProgress}
                  characters={characters}
                  onClick={() => handleItemClick(item.id)}
                  viewMode={viewMode}
                />
              </div>
            );
          }

          // Grid view: render row of items
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
              <div
                className={cn(
                  'grid gap-4',
                  columnsCount === 2 && 'grid-cols-2',
                  columnsCount === 3 && 'grid-cols-3',
                  columnsCount === 4 && 'grid-cols-4',
                  columnsCount === 5 && 'grid-cols-5',
                  columnsCount === 6 && 'grid-cols-6',
                  columnsCount === 7 && 'grid-cols-7',
                )}
              >
                {row.items.map((item) => {
                  const itemProgressData = progressLookup.get(item.id);
                  const normalProgress = itemProgressData?.normalProgress || [];
                  const etherealProgress = itemProgressData?.etherealProgress || [];

                  return (
                    <ItemCard
                      key={item.id}
                      item={item}
                      normalProgress={normalProgress}
                      etherealProgress={etherealProgress}
                      characters={characters}
                      onClick={() => handleItemClick(item.id)}
                      viewMode={viewMode}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
