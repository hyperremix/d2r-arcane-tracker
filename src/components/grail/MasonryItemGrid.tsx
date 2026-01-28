import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { useContainerPosition, useMasonry, usePositioner, useResizeObserver } from 'masonic';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  // Responsive column width calculation (matches current breakpoints)
  const getColumnWidth = useCallback(() => {
    const viewportWidth = window.innerWidth;
    if (viewportWidth >= 1536) return Math.floor((viewportWidth - 64) / 6); // 2xl: 6 cols
    if (viewportWidth >= 1280) return Math.floor((viewportWidth - 64) / 5); // xl: 5 cols
    if (viewportWidth >= 1024) return Math.floor((viewportWidth - 64) / 4); // lg: 4 cols
    if (viewportWidth >= 768) return Math.floor((viewportWidth - 64) / 3); // md: 3 cols
    if (viewportWidth >= 640) return Math.floor((viewportWidth - 64) / 2); // sm: 2 cols
    return viewportWidth - 32; // 1 col
  }, []);

  const [columnWidth, setColumnWidth] = useState(getColumnWidth);

  // Track container dimensions - depends on columnWidth for resize recalculation
  const { width, offset } = useContainerPosition(gridRef, [columnWidth]);

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

  // Update column width on window resize with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setColumnWidth(getColumnWidth());
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [getColumnWidth]);

  // Create positioner with column configuration
  const positioner = usePositioner(
    {
      width: width || 800,
      columnWidth,
      columnGutter: 16,
    },
    [items.length, columnWidth, width],
  );

  const resizeObserver = useResizeObserver(positioner);

  // Memoize render component
  const MasonryItem = useMemo(() => {
    return function MasonryItemComponent({ data: item, width: itemWidth }: MasonryItemProps) {
      const itemProgressData = progressLookup.get(item.id);
      const normalProgress = itemProgressData?.normalProgress ?? EMPTY_PROGRESS_ARRAY;
      const etherealProgress = itemProgressData?.etherealProgress ?? EMPTY_PROGRESS_ARRAY;

      return (
        <div style={{ width: itemWidth }}>
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
    };
  }, [progressLookup, characters, onItemClick]);

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
