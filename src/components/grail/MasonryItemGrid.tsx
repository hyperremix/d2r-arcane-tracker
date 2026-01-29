import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { useContainerPosition, useMasonry, usePositioner, useResizeObserver } from 'masonic';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { useProgressLookup } from '@/hooks/useProgressLookup';
import { ItemCard } from './ItemCard';

// Stable empty arrays to avoid breaking memoization
const EMPTY_PROGRESS_ARRAY: GrailProgress[] = [];

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
const COLUMN_GUTTER = 16;

/**
 * Gets the desired column count based on viewport width breakpoints.
 * Matches the CSS columns breakpoints used in GroupedMasonryGrid.
 */
export function getColumnCount(viewportWidth: number): number {
  if (viewportWidth >= 1536) return 6; // 2xl
  if (viewportWidth >= 1280) return 5; // xl
  if (viewportWidth >= 1024) return 4; // lg
  if (viewportWidth >= 768) return 3; // md
  if (viewportWidth >= 640) return 2; // sm
  return 1; // default
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

  // Track viewport-based column count (matches CSS columns breakpoints)
  const [columnCount, setColumnCount] = useState(() => getColumnCount(window.innerWidth));

  // Track container dimensions
  const { width, offset } = useContainerPosition(gridRef, [columnCount]);

  // Calculate column width based on actual container width and desired column count
  const columnWidth = useMemo(() => {
    if (!width || width <= 0) return 200; // fallback for initial render
    return calculateColumnWidth(width, columnCount);
  }, [width, columnCount]);

  // Handle scroll events on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      setScrollTop(container.scrollTop);
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => setIsScrolling(false), 150);
    };

    const updateContainerHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    // Initial measurements
    updateContainerHeight();
    setScrollTop(container.scrollTop);

    container.addEventListener('scroll', handleScroll, { passive: true });

    // Use ResizeObserver to track container height changes
    const resizeObserver = new ResizeObserver(updateContainerHeight);
    resizeObserver.observe(container);

    return () => {
      clearTimeout(scrollTimeout);
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // Update column count on window resize with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setColumnCount(getColumnCount(window.innerWidth));
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

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

  // Memoize render component with stable refs
  const MasonryItem = useMemo(() => {
    return function MasonryItemComponent({ data: item, width: itemWidth }: MasonryItemProps) {
      const itemProgressData = progressLookupRef.current.get(item.id);
      const normalProgress = itemProgressData?.normalProgress ?? EMPTY_PROGRESS_ARRAY;
      const etherealProgress = itemProgressData?.etherealProgress ?? EMPTY_PROGRESS_ARRAY;

      return (
        <div style={{ width: itemWidth }}>
          <ItemCard
            item={item}
            normalProgress={normalProgress}
            etherealProgress={etherealProgress}
            characters={charactersRef.current}
            onClick={() => onItemClickRef.current(item.id)}
            viewMode="grid"
          />
        </div>
      );
    };
  }, []);

  // Use effective height for masonry (fallback to a default height when not measured)
  const effectiveHeight = containerHeight || 600;
  const isMeasured = width > 0 && containerHeight > 0;

  const masonryElement = useMasonry({
    items,
    positioner,
    scrollTop: scrollTop + offset,
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

interface GroupedMasonryGridProps {
  groupedItems: Array<{ title: string; items: Item[]; foundCount: number }>;
  progressLookup: ReturnType<typeof useProgressLookup>;
  characters: Character[];
  onItemClick: (itemId: string) => void;
}

/**
 * GroupedMasonryGrid component that renders grouped items with headers and CSS column-based masonry.
 * Each group has a header followed by items in a masonry layout using CSS columns.
 */
export const GroupedMasonryGrid = memo(function GroupedMasonryGrid({
  groupedItems,
  progressLookup,
  characters,
  onItemClick,
}: GroupedMasonryGridProps) {
  return (
    <div className="h-full w-full overflow-auto p-4">
      {groupedItems.map((group) => (
        <div key={group.title} className="mb-6">
          {/* Group header */}
          <div className="flex items-center gap-2 py-4">
            <h3 className="font-semibold text-lg">{group.title}</h3>
            <Badge variant="outline">
              {group.foundCount}/{group.items.length}
            </Badge>
          </div>

          {/* Masonry grid using CSS columns */}
          <div className="columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6">
            {group.items.map((item) => {
              const itemProgressData = progressLookup.get(item.id);
              const normalProgress = itemProgressData?.normalProgress ?? EMPTY_PROGRESS_ARRAY;
              const etherealProgress = itemProgressData?.etherealProgress ?? EMPTY_PROGRESS_ARRAY;

              return (
                <div key={item.id} className="mb-4 break-inside-avoid">
                  <ItemCard
                    item={item}
                    normalProgress={normalProgress}
                    etherealProgress={etherealProgress}
                    characters={characters}
                    onClick={() => onItemClick(item.id)}
                    viewMode="grid"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
