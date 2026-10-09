import { useVirtualizer } from '@tanstack/react-virtual';
import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { useProgressLookup } from '@/hooks/useProgressLookup';
import { cn } from '@/lib/utils';
import { ItemCard } from './ItemCard';

// Stable empty arrays to avoid breaking memoization
const EMPTY_PROGRESS_ARRAY: GrailProgress[] = [];

/**
 * Props for the ItemCardCell component.
 */
interface ItemCardCellProps {
  item: Item;
  progressLookup: ReturnType<typeof useProgressLookup>;
  characters: Character[];
  onItemClick: (itemId: string) => void;
  viewMode: 'grid' | 'list';
}

/**
 * Renders an ItemCard for a virtualized cell with a stable click handler and stable progress arrays,
 * so mounted cards only re-render when the item, the progress lookup or the characters change
 * (and not on every scroll frame or parent render of the surrounding virtualizer).
 */
export const ItemCardCell = memo(function ItemCardCell({
  item,
  progressLookup,
  characters,
  onItemClick,
  viewMode,
}: ItemCardCellProps) {
  const itemProgressData = progressLookup.get(item.id);
  const normalProgress = itemProgressData?.normalProgress ?? EMPTY_PROGRESS_ARRAY;
  const etherealProgress = itemProgressData?.etherealProgress ?? EMPTY_PROGRESS_ARRAY;
  const itemId = item.id;
  const handleClick = useCallback(() => onItemClick(itemId), [onItemClick, itemId]);

  return (
    <ItemCard
      item={item}
      normalProgress={normalProgress}
      etherealProgress={etherealProgress}
      characters={characters}
      onClick={handleClick}
      viewMode={viewMode}
    />
  );
});

/**
 * Gap between grid columns (and, via the row padding, between grid rows) in pixels.
 */
export const COLUMN_GUTTER = 16;

/**
 * Minimum width of a single grid column in pixels.
 * Columns stretch to fill the remaining space, which keeps cards roughly 180-230px wide
 * once a few columns fit.
 */
export const MIN_COLUMN_WIDTH = 180;

/**
 * Gets the number of columns that fit into the given container width.
 * Mirrors the CSS `column-width` algorithm.
 * Formula: count = floor((containerWidth + gutter) / (minColumnWidth + gutter))
 */
export function getColumnCount(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 1;
  return Math.max(
    1,
    Math.floor((containerWidth + COLUMN_GUTTER) / (MIN_COLUMN_WIDTH + COLUMN_GUTTER)),
  );
}

/**
 * Estimated height of a group header row in pixels (refined by measuring rendered rows).
 */
const HEADER_ROW_HEIGHT_ESTIMATE = 60;

/**
 * Estimated height of a row of grid cards in pixels, including the row gap
 * (refined by measuring rendered rows).
 */
const ITEM_ROW_HEIGHT_ESTIMATE = 180;

/**
 * A group of items shown in the grid. `foundCount` is the number of items of the group that have
 * been found; it is only shown in the group header, so it may be omitted when headers are hidden.
 */
export interface ItemGridGroup {
  title: string;
  items: Item[];
  foundCount?: number;
}

/**
 * A virtual row of the grid: either a group header or a row of up to `columnCount` items.
 */
export type GridRow =
  | {
      type: 'header';
      key: string;
      title: string;
      itemCount: number;
      foundCount: number;
      isFirstGroup: boolean;
    }
  | { type: 'items'; key: string; items: Item[] };

/**
 * Flattens grouped items into virtual rows: one header row per group (unless `showGroupHeaders`
 * is false) followed by rows of at most `columnCount` items.
 *
 * Row keys identify what a row shows (its group, column count and item ids) rather than its
 * position. The virtualizer caches measured heights by key, so a row whose content or column count
 * changes gets a new key and is measured again instead of inheriting a stale height.
 */
export function createGridRows(
  groupedItems: ItemGridGroup[],
  columnCount: number,
  showGroupHeaders = true,
): GridRow[] {
  const itemsPerRow = Number.isFinite(columnCount) ? Math.max(1, Math.floor(columnCount)) : 1;
  const rows: GridRow[] = [];

  for (const [groupIndex, group] of groupedItems.entries()) {
    if (showGroupHeaders) {
      rows.push({
        type: 'header',
        key: `header-${groupIndex}-${group.title}`,
        title: group.title,
        itemCount: group.items.length,
        foundCount: group.foundCount ?? 0,
        isFirstGroup: groupIndex === 0,
      });
    }

    for (let start = 0; start < group.items.length; start += itemsPerRow) {
      const rowItems = group.items.slice(start, start + itemsPerRow);
      rows.push({
        type: 'items',
        key: `items-${groupIndex}-${itemsPerRow}-${rowItems.map((item) => item.id).join(',')}`,
        items: rowItems,
      });
    }
  }

  return rows;
}

/**
 * Tracks how many grid columns fit into the element's width, updating on resize.
 * Only the column count is stored, so resizes that keep the same count do not re-render.
 */
export function useElementColumnCount(elementRef: React.RefObject<HTMLDivElement | null>): number {
  const [columnCount, setColumnCount] = useState(1);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const update = () => setColumnCount(getColumnCount(element.clientWidth));
    update();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef]);

  return columnCount;
}

interface VirtualItemGridProps {
  groupedItems: ItemGridGroup[];
  /** Whether a header with the group title and found count is rendered above each group. */
  showGroupHeaders: boolean;
  progressLookup: ReturnType<typeof useProgressLookup>;
  characters: Character[];
  onItemClick: (itemId: string) => void;
}

/**
 * VirtualItemGrid component that renders items in a virtualized, responsive card grid.
 * Groups are flattened into optional header rows and rows of cards, with as many equally wide
 * columns as fit into the grid width (see {@link getColumnCount}). Only rows near the viewport are
 * mounted; row heights are measured after rendering because card heights vary (set name, discovery
 * attribution, rune images), so each row is as tall as its tallest card.
 */
export const VirtualItemGrid = memo(function VirtualItemGrid({
  groupedItems,
  showGroupHeaders,
  progressLookup,
  characters,
  onItemClick,
}: VirtualItemGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const columnCount = useElementColumnCount(contentRef);

  const rows = useMemo(
    () => createGridRows(groupedItems, columnCount, showGroupHeaders),
    [groupedItems, columnCount, showGroupHeaders],
  );

  // Stable callbacks: the virtualizer recomputes its measurements when these options change
  const getScrollElement = useCallback(() => scrollRef.current, []);
  const estimateSize = useCallback(
    (index: number) =>
      rows[index]?.type === 'header' ? HEADER_ROW_HEIGHT_ESTIMATE : ITEM_ROW_HEIGHT_ESTIMATE,
    [rows],
  );
  const getItemKey = useCallback((index: number) => rows[index].key, [rows]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    estimateSize,
    getItemKey,
    overscan: 3,
  });

  return (
    <div ref={scrollRef} className="min-h-0 w-full flex-1 overflow-auto p-4">
      <div
        ref={contentRef}
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === 'header' ? (
                <div
                  className={cn(
                    'flex items-center gap-2 pb-4',
                    // Extra space above every group but the first separates it from the previous one
                    row.isFirstGroup ? 'pt-4' : 'pt-10',
                  )}
                >
                  <h3 className="font-semibold text-lg">{row.title}</h3>
                  <Badge variant="outline">
                    {row.foundCount}/{row.itemCount}
                  </Badge>
                </div>
              ) : (
                <div
                  data-testid="item-grid-row"
                  className="grid items-start"
                  style={{
                    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    columnGap: COLUMN_GUTTER,
                    paddingBottom: COLUMN_GUTTER,
                  }}
                >
                  {row.items.map((item) => (
                    <ItemCardCell
                      key={item.id}
                      item={item}
                      progressLookup={progressLookup}
                      characters={characters}
                      onItemClick={onItemClick}
                      viewMode="grid"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
