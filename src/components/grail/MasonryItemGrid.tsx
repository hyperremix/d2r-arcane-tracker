import { useVirtualizer } from '@tanstack/react-virtual';
import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { useContainerPosition, useMasonry, usePositioner, useResizeObserver } from 'masonic';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

interface MasonryItemGridProps {
  items: Item[];
  progressLookup: ReturnType<typeof useProgressLookup>;
  characters: Character[];
  onItemClick: (itemId: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface MasonryItemProps {
  data: Item;
  width: number;
  index: number;
}

/**
 * MasonryItemGrid component that renders items in a true masonry layout.
 * Uses the masonic library for virtualized masonry rendering with dynamic item heights.
 */
// Column gutter constant (gap between columns)
export const COLUMN_GUTTER = 16;

/**
 * Minimum width of a single masonry column in pixels.
 * Columns stretch to fill the remaining space, which keeps cards roughly 180-230px wide
 * once a few columns fit. Shared with the grid rows used by GroupedMasonryGrid.
 */
export const MIN_COLUMN_WIDTH = 180;

/**
 * Gets the number of columns that fit into the given container width.
 * Mirrors the CSS `column-width` algorithm. Shared by the virtualized masonry grid and the
 * row-based GroupedMasonryGrid so both always produce the same column count.
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
 * Calculates column width based on container width and desired column count.
 * Formula: containerWidth = cols * columnWidth + (cols - 1) * gutter
 * Solving: columnWidth = (containerWidth - (cols - 1) * gutter) / cols
 */
export function calculateColumnWidth(containerWidth: number, columnCount: number): number {
  if (columnCount <= 1) return containerWidth;
  return Math.floor((containerWidth - (columnCount - 1) * COLUMN_GUTTER) / columnCount);
}

export const MasonryItemGrid = memo(function MasonryItemGrid({
  items,
  progressLookup,
  characters,
  onItemClick,
  containerRef,
}: MasonryItemGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Track scroll position and height of the container
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);
  // Width of the scroll container; the grid is re-measured whenever it changes
  const [containerWidth, setContainerWidth] = useState(0);

  // Track grid width (the grid's document offset is not needed: it scrolls inside its container)
  const { width } = useContainerPosition(gridRef, [containerWidth]);

  // Calculate column count and width based on the actual grid width
  const columnWidth = useMemo(() => {
    if (!width || width <= 0) return 200; // fallback for initial render
    return calculateColumnWidth(width, getColumnCount(width));
  }, [width]);

  // Handle scroll events on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;
    let widthTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      setScrollTop(container.scrollTop);
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => setIsScrolling(false), 150);
    };

    const updateContainerSize = () => {
      setContainerHeight(container.clientHeight);
      // Debounce width changes so the masonry layout isn't recalculated on every resize frame
      clearTimeout(widthTimeout);
      widthTimeout = setTimeout(() => setContainerWidth(container.clientWidth), 150);
    };

    // Initial measurements
    setContainerHeight(container.clientHeight);
    setContainerWidth(container.clientWidth);
    setScrollTop(container.scrollTop);

    container.addEventListener('scroll', handleScroll, { passive: true });

    // Use ResizeObserver to track container size changes (window resizes, layout changes)
    const resizeObserver = new ResizeObserver(updateContainerSize);
    resizeObserver.observe(container);

    return () => {
      clearTimeout(scrollTimeout);
      clearTimeout(widthTimeout);
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // Create positioner with column configuration
  const positioner = usePositioner(
    {
      width: width || 800,
      columnWidth,
      columnGutter: COLUMN_GUTTER,
    },
    [items.length, columnWidth, width],
  );

  const resizeObserver = useResizeObserver(positioner);

  // Use refs for stable memoization - avoids recreating MasonryItem on prop changes
  const progressLookupRef = useRef(progressLookup);
  const charactersRef = useRef(characters);
  const onItemClickRef = useRef(onItemClick);
  progressLookupRef.current = progressLookup;
  charactersRef.current = characters;
  onItemClickRef.current = onItemClick;

  // Stable click handler so memoized cards are not re-rendered on every scroll frame
  const handleItemClick = useCallback((itemId: string) => onItemClickRef.current(itemId), []);

  // Memoize render component with stable refs
  const MasonryItem = useMemo(() => {
    return function MasonryItemComponent({ data: item, width: itemWidth }: MasonryItemProps) {
      return (
        <div style={{ width: itemWidth }}>
          <ItemCardCell
            item={item}
            progressLookup={progressLookupRef.current}
            characters={charactersRef.current}
            onItemClick={handleItemClick}
            viewMode="grid"
          />
        </div>
      );
    };
  }, [handleItemClick]);

  // Use effective height for masonry (fallback to a default height when not measured)
  const effectiveHeight = containerHeight || 600;
  const isMeasured = width > 0 && containerHeight > 0;

  const masonryElement = useMasonry({
    items,
    positioner,
    // The grid sits at the top of its own scroll container, so the container's scrollTop is
    // already relative to the grid (apart from the container padding, which overscan covers)
    scrollTop,
    isScrolling,
    height: effectiveHeight,
    resizeObserver,
    render: MasonryItem,
    containerRef: gridRef,
    overscanBy: 2,
    itemKey: (item: Item) => item.id,
  });

  // Show placeholder while measuring, but still call useMasonry above
  if (!isMeasured) {
    return <div ref={gridRef} className="h-full w-full" />;
  }

  return masonryElement;
});

/**
 * Estimated height of a group header row in pixels (refined by measuring rendered rows).
 */
const GROUP_HEADER_HEIGHT_ESTIMATE = 60;

/**
 * Estimated height of a row of grid cards in pixels, including the row gap
 * (refined by measuring rendered rows).
 */
const GROUP_ITEM_ROW_HEIGHT_ESTIMATE = 180;

/**
 * A virtual row of the grouped grid: either a group header or a row of up to `columnCount` items.
 */
export type GroupedGridRow =
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
 * Flattens grouped items into virtual rows: one header row per group followed by
 * rows of at most `columnCount` items.
 */
export function createGroupedGridRows(
  groupedItems: Array<{ title: string; items: Item[]; foundCount: number }>,
  columnCount: number,
): GroupedGridRow[] {
  const itemsPerRow = Number.isFinite(columnCount) ? Math.max(1, Math.floor(columnCount)) : 1;
  const rows: GroupedGridRow[] = [];

  for (const [groupIndex, group] of groupedItems.entries()) {
    rows.push({
      type: 'header',
      key: `header-${groupIndex}`,
      title: group.title,
      itemCount: group.items.length,
      foundCount: group.foundCount,
      isFirstGroup: groupIndex === 0,
    });

    for (let start = 0; start < group.items.length; start += itemsPerRow) {
      rows.push({
        type: 'items',
        key: `items-${groupIndex}-${start / itemsPerRow}`,
        items: group.items.slice(start, start + itemsPerRow),
      });
    }
  }

  return rows;
}

/**
 * Tracks how many grid columns fit into the element's width, updating on resize.
 * Only the column count is stored, so resizes that keep the same count do not re-render.
 */
function useElementColumnCount(elementRef: React.RefObject<HTMLDivElement | null>): number {
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

interface GroupedMasonryGridProps {
  groupedItems: Array<{ title: string; items: Item[]; foundCount: number }>;
  progressLookup: ReturnType<typeof useProgressLookup>;
  characters: Character[];
  onItemClick: (itemId: string) => void;
}

/**
 * GroupedMasonryGrid component that renders grouped items with headers in a virtualized grid.
 * Groups are flattened into header rows and rows of cards whose column count and widths match the
 * ungrouped masonry grid. Only rows near the viewport are mounted; row heights are measured after
 * rendering so cards of any height are positioned correctly.
 */
export const GroupedMasonryGrid = memo(function GroupedMasonryGrid({
  groupedItems,
  progressLookup,
  characters,
  onItemClick,
}: GroupedMasonryGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const columnCount = useElementColumnCount(contentRef);

  const rows = useMemo(
    () => createGroupedGridRows(groupedItems, columnCount),
    [groupedItems, columnCount],
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      rows[index]?.type === 'header'
        ? GROUP_HEADER_HEIGHT_ESTIMATE
        : GROUP_ITEM_ROW_HEIGHT_ESTIMATE,
    getItemKey: (index) => rows[index]?.key ?? index,
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
          if (!row) return null;

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
                  data-testid="grouped-grid-row"
                  className="grid items-start pb-4"
                  style={{
                    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    columnGap: COLUMN_GUTTER,
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
