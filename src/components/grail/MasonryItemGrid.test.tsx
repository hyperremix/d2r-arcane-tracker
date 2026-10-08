import { act, render, screen } from '@testing-library/react';
import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLUMN_GUTTER,
  calculateColumnWidth,
  createGroupedGridRows,
  GroupedMasonryGrid,
  getColumnCount,
  MIN_COLUMN_WIDTH,
} from './MasonryItemGrid';

// Mock the ItemCard component to simplify testing
vi.mock('./ItemCard', () => ({
  ItemCard: ({
    item,
    onClick,
  }: {
    item: Item;
    normalProgress: GrailProgress[];
    etherealProgress: GrailProgress[];
    characters: Character[];
    onClick: () => void;
    viewMode: string;
  }) => (
    <button type="button" data-testid={`item-card-${item.id}`} onClick={onClick}>
      {item.name}
    </button>
  ),
}));

// Mock the Badge component
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

/**
 * Creates a mock Item for testing purposes.
 */
function createMockItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'test-item-1',
    name: 'Test Item',
    link: '',
    etherealType: 'none',
    type: 'unique',
    category: 'armor',
    subCategory: 'helms',
    treasureClass: 'elite',
    ...overrides,
  };
}

/**
 * Interface matching ProgressLookupData from useProgressLookup hook.
 */
interface ProgressLookupData {
  normalFound: boolean;
  etherealFound: boolean;
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  overallFound: boolean;
}

/**
 * Creates a mock progress lookup Map for testing.
 */
function createMockProgressLookup(
  entries: Array<{
    itemId: string;
    normalProgress?: GrailProgress[];
    etherealProgress?: GrailProgress[];
    normalFound?: boolean;
    etherealFound?: boolean;
  }> = [],
): Map<string, ProgressLookupData> {
  const map = new Map<string, ProgressLookupData>();
  for (const entry of entries) {
    const normalProgress = entry.normalProgress ?? [];
    const etherealProgress = entry.etherealProgress ?? [];
    const normalFound = entry.normalFound ?? normalProgress.length > 0;
    const etherealFound = entry.etherealFound ?? etherealProgress.length > 0;

    map.set(entry.itemId, {
      normalProgress,
      etherealProgress,
      normalFound,
      etherealFound,
      overallFound: normalFound || etherealFound,
    });
  }
  return map;
}

describe('MasonryItemGrid Column Count Calculation', () => {
  describe('When getColumnCount is called', () => {
    describe('If the container is narrower than two minimum-width columns', () => {
      it('Then should return 1 column', () => {
        // Arrange
        const twoColumnThreshold = 2 * MIN_COLUMN_WIDTH + COLUMN_GUTTER;

        // Act & Assert
        expect(getColumnCount(320)).toBe(1);
        expect(getColumnCount(twoColumnThreshold - 1)).toBe(1);
      });
    });

    describe('If the container width is zero, negative or not a number', () => {
      it('Then should fall back to 1 column', () => {
        // Arrange & Act & Assert
        expect(getColumnCount(0)).toBe(1);
        expect(getColumnCount(-100)).toBe(1);
        expect(getColumnCount(Number.NaN)).toBe(1);
      });
    });

    describe('If the container fits exactly N minimum-width columns', () => {
      it('Then should return N columns', () => {
        // Arrange
        const widthFor = (columns: number) =>
          columns * MIN_COLUMN_WIDTH + (columns - 1) * COLUMN_GUTTER;

        // Act & Assert
        expect(getColumnCount(widthFor(2))).toBe(2);
        expect(getColumnCount(widthFor(3))).toBe(3);
        expect(getColumnCount(widthFor(6))).toBe(6);
        expect(getColumnCount(widthFor(6) - 1)).toBe(5);
      });
    });

    describe('If the grid spans the full content width of typical windows', () => {
      it('Then should keep card widths between the minimum and roughly 230px', () => {
        // Arrange
        const containerWidths = [];
        for (let width = 768; width <= 2560; width += 16) {
          containerWidths.push(width);
        }

        // Act
        const columnWidths = containerWidths.map((width) =>
          calculateColumnWidth(width, getColumnCount(width)),
        );

        // Assert
        expect(Math.min(...columnWidths)).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTH);
        expect(Math.max(...columnWidths)).toBeLessThanOrEqual(230);
      });
    });

    describe('If the container grows', () => {
      it('Then should never decrease the column count', () => {
        // Arrange
        const widths: number[] = [];
        for (let width = 300; width <= 2560; width += 10) {
          widths.push(width);
        }

        // Act
        const columnCounts = widths.map((width) => getColumnCount(width));

        // Assert
        const decreases = columnCounts.filter((count, index) => count < columnCounts[index - 1]);
        expect(decreases).toEqual([]);
      });
    });
  });
});

describe('MasonryItemGrid Column Width Calculation', () => {
  describe('When calculateColumnWidth is called', () => {
    describe('If column count is 1', () => {
      it('Then should return full container width', () => {
        // Arrange
        const containerWidth = 500;
        const columnCount = 1;

        // Act
        const result = calculateColumnWidth(containerWidth, columnCount);

        // Assert
        expect(result).toBe(containerWidth);
      });
    });

    describe('If column count is greater than 1', () => {
      it('Then should calculate width accounting for gutters', () => {
        // Arrange
        const containerWidth = 1000;
        const columnCount = 4;
        // Formula: columnWidth = (containerWidth - (cols - 1) * gutter) / cols
        // = (1000 - 3 * 16) / 4 = (1000 - 48) / 4 = 952 / 4 = 238

        // Act
        const result = calculateColumnWidth(containerWidth, columnCount);

        // Assert
        expect(result).toBe(238);
      });

      it('Then should work correctly for 6 columns', () => {
        // Arrange
        const containerWidth = 1504; // typical for 1536px viewport with 32px padding
        const columnCount = 6;
        // Formula: (1504 - 5 * 16) / 6 = (1504 - 80) / 6 = 1424 / 6 = 237.33 -> 237

        // Act
        const result = calculateColumnWidth(containerWidth, columnCount);

        // Assert
        expect(result).toBe(237);
      });

      it('Then should work correctly for 2 columns', () => {
        // Arrange
        const containerWidth = 608; // typical for 640px viewport with 32px padding
        const columnCount = 2;
        // Formula: (608 - 1 * 16) / 2 = (608 - 16) / 2 = 592 / 2 = 296

        // Act
        const result = calculateColumnWidth(containerWidth, columnCount);

        // Assert
        expect(result).toBe(296);
      });
    });

    describe('If container width varies', () => {
      it('Then column width should scale proportionally', () => {
        // Arrange
        const columnCount = 4;

        // Act
        const width1 = calculateColumnWidth(800, columnCount);
        const width2 = calculateColumnWidth(1200, columnCount);

        // Assert - larger container = larger columns
        expect(width2).toBeGreaterThan(width1);
      });
    });
  });
});

/**
 * jsdom has no layout engine, so every element reports a size of 0 and the virtualizer would
 * render nothing. Stub the sizes the virtualizer and the column measurement read.
 */
function stubLayout({ height = 600, width = 0 }: { height?: number; width?: number } = {}) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
}

/**
 * Width that fits exactly the given number of minimum-width columns.
 */
function widthForColumns(columns: number) {
  return columns * MIN_COLUMN_WIDTH + (columns - 1) * COLUMN_GUTTER;
}

describe('When createGroupedGridRows is called', () => {
  describe('If a group has more items than fit into one row', () => {
    it('Then emits a header followed by rows of at most columnCount items', () => {
      // Arrange
      const items = [1, 2, 3, 4, 5].map((n) => createMockItem({ id: `item-${n}` }));

      // Act
      const rows = createGroupedGridRows([{ title: 'Helms', items, foundCount: 2 }], 2);

      // Assert
      expect(rows.map((row) => row.type)).toEqual(['header', 'items', 'items', 'items']);
      expect(rows[0]).toMatchObject({ title: 'Helms', itemCount: 5, foundCount: 2 });
      const itemRows = rows.filter((row) => row.type === 'items');
      expect(itemRows.map((row) => row.items.map((item) => item.id))).toEqual([
        ['item-1', 'item-2'],
        ['item-3', 'item-4'],
        ['item-5'],
      ]);
    });
  });

  describe('If there are multiple groups', () => {
    it('Then only the first header is marked as the first group and keys are unique', () => {
      // Arrange
      const groupedItems = [
        { title: 'Armor', items: [createMockItem({ id: 'a' })], foundCount: 0 },
        { title: 'Weapons', items: [createMockItem({ id: 'b' })], foundCount: 1 },
      ];

      // Act
      const rows = createGroupedGridRows(groupedItems, 3);

      // Assert
      const headers = rows.filter((row) => row.type === 'header');
      expect(headers.map((header) => header.isFirstGroup)).toEqual([true, false]);
      expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    });
  });

  describe('If the column count is zero or not a number', () => {
    it('Then falls back to one item per row', () => {
      // Arrange
      const items = [createMockItem({ id: 'a' }), createMockItem({ id: 'b' })];

      // Act
      const zeroRows = createGroupedGridRows([{ title: 'G', items, foundCount: 0 }], 0);
      const nanRows = createGroupedGridRows([{ title: 'G', items, foundCount: 0 }], Number.NaN);

      // Assert
      expect(zeroRows.filter((row) => row.type === 'items')).toHaveLength(2);
      expect(nanRows.filter((row) => row.type === 'items')).toHaveLength(2);
    });
  });
});

describe('GroupedMasonryGrid Component', () => {
  beforeEach(() => {
    stubLayout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('When GroupedMasonryGrid is rendered', () => {
    describe('If groupedItems is empty', () => {
      it('Then should render an empty scroll container without rows', () => {
        // Arrange
        const progressLookup = createMockProgressLookup();
        const characters: Character[] = [];
        const onItemClick = vi.fn();

        // Act
        const { container } = render(
          <GroupedMasonryGrid
            groupedItems={[]}
            progressLookup={progressLookup}
            characters={characters}
            onItemClick={onItemClick}
          />,
        );

        // Assert
        expect(container.firstElementChild).toHaveClass('overflow-auto');
        expect(screen.queryAllByTestId('grouped-grid-row')).toHaveLength(0);
      });
    });

    describe('If groupedItems has one group', () => {
      it('Then should render group header with title', () => {
        // Arrange
        const groupedItems = [
          {
            title: 'Unique Armor',
            items: [createMockItem({ id: 'item-1', name: 'Harlequin Crest' })],
            foundCount: 1,
          },
        ];
        const progressLookup = createMockProgressLookup();
        const characters: Character[] = [];
        const onItemClick = vi.fn();

        // Act
        render(
          <GroupedMasonryGrid
            groupedItems={groupedItems}
            progressLookup={progressLookup}
            characters={characters}
            onItemClick={onItemClick}
          />,
        );

        // Assert
        expect(screen.getByText('Unique Armor')).toBeDefined();
      });

      it('Then should render badge with found count', () => {
        // Arrange
        const groupedItems = [
          {
            title: 'Unique Armor',
            items: [
              createMockItem({ id: 'item-1', name: 'Harlequin Crest' }),
              createMockItem({ id: 'item-2', name: "Tyrael's Might" }),
            ],
            foundCount: 1,
          },
        ];
        const progressLookup = createMockProgressLookup();
        const characters: Character[] = [];
        const onItemClick = vi.fn();

        // Act
        render(
          <GroupedMasonryGrid
            groupedItems={groupedItems}
            progressLookup={progressLookup}
            characters={characters}
            onItemClick={onItemClick}
          />,
        );

        // Assert
        expect(screen.getByText('1/2')).toBeDefined();
      });

      it('Then should render all items in the group', () => {
        // Arrange
        const groupedItems = [
          {
            title: 'Unique Armor',
            items: [
              createMockItem({ id: 'item-1', name: 'Harlequin Crest' }),
              createMockItem({ id: 'item-2', name: "Tyrael's Might" }),
            ],
            foundCount: 1,
          },
        ];
        const progressLookup = createMockProgressLookup();
        const characters: Character[] = [];
        const onItemClick = vi.fn();

        // Act
        render(
          <GroupedMasonryGrid
            groupedItems={groupedItems}
            progressLookup={progressLookup}
            characters={characters}
            onItemClick={onItemClick}
          />,
        );

        // Assert
        expect(screen.getByText('Harlequin Crest')).toBeDefined();
        expect(screen.getByText("Tyrael's Might")).toBeDefined();
      });
    });

    describe('If groupedItems has multiple groups', () => {
      it('Then should render all group headers', () => {
        // Arrange
        const groupedItems = [
          {
            title: 'Unique Armor',
            items: [createMockItem({ id: 'item-1', name: 'Harlequin Crest' })],
            foundCount: 1,
          },
          {
            title: 'Unique Weapons',
            items: [createMockItem({ id: 'item-2', name: 'Windforce' })],
            foundCount: 0,
          },
        ];
        const progressLookup = createMockProgressLookup();
        const characters: Character[] = [];
        const onItemClick = vi.fn();

        // Act
        render(
          <GroupedMasonryGrid
            groupedItems={groupedItems}
            progressLookup={progressLookup}
            characters={characters}
            onItemClick={onItemClick}
          />,
        );

        // Assert
        expect(screen.getByText('Unique Armor')).toBeDefined();
        expect(screen.getByText('Unique Weapons')).toBeDefined();
      });

      it('Then should render items from all groups', () => {
        // Arrange
        const groupedItems = [
          {
            title: 'Unique Armor',
            items: [createMockItem({ id: 'item-1', name: 'Harlequin Crest' })],
            foundCount: 1,
          },
          {
            title: 'Unique Weapons',
            items: [createMockItem({ id: 'item-2', name: 'Windforce' })],
            foundCount: 0,
          },
        ];
        const progressLookup = createMockProgressLookup();
        const characters: Character[] = [];
        const onItemClick = vi.fn();

        // Act
        render(
          <GroupedMasonryGrid
            groupedItems={groupedItems}
            progressLookup={progressLookup}
            characters={characters}
            onItemClick={onItemClick}
          />,
        );

        // Assert
        expect(screen.getByText('Harlequin Crest')).toBeDefined();
        expect(screen.getByText('Windforce')).toBeDefined();
      });
    });

    describe('If item click handler is provided', () => {
      it('Then should call onItemClick when item is clicked', () => {
        // Arrange
        const groupedItems = [
          {
            title: 'Unique Armor',
            items: [createMockItem({ id: 'item-1', name: 'Harlequin Crest' })],
            foundCount: 1,
          },
        ];
        const progressLookup = createMockProgressLookup();
        const characters: Character[] = [];
        const onItemClick = vi.fn();

        // Act
        render(
          <GroupedMasonryGrid
            groupedItems={groupedItems}
            progressLookup={progressLookup}
            characters={characters}
            onItemClick={onItemClick}
          />,
        );

        const itemCard = screen.getByTestId('item-card-item-1');
        itemCard.click();

        // Assert
        expect(onItemClick).toHaveBeenCalledWith('item-1');
      });
    });

    describe('If item has progress data', () => {
      it('Then should pass progress data to ItemCard', () => {
        // Arrange
        const item = createMockItem({ id: 'item-1', name: 'Harlequin Crest' });
        const groupedItems = [
          {
            title: 'Unique Armor',
            items: [item],
            foundCount: 1,
          },
        ];
        const normalProgress: GrailProgress[] = [
          {
            id: 'progress-1',
            characterId: 'char-1',
            itemId: 'item-1',
            manuallyAdded: false,
            isEthereal: false,
          },
        ];
        const progressLookup = createMockProgressLookup([
          { itemId: 'item-1', normalProgress, etherealProgress: [] },
        ]);
        const characters: Character[] = [];
        const onItemClick = vi.fn();

        // Act
        render(
          <GroupedMasonryGrid
            groupedItems={groupedItems}
            progressLookup={progressLookup}
            characters={characters}
            onItemClick={onItemClick}
          />,
        );

        // Assert - ItemCard is rendered (progress is passed internally)
        expect(screen.getByTestId('item-card-item-1')).toBeDefined();
      });
    });

    describe('If item has no progress data in lookup', () => {
      it('Then should use empty progress arrays', () => {
        // Arrange
        const item = createMockItem({ id: 'item-1', name: 'Harlequin Crest' });
        const groupedItems = [
          {
            title: 'Unique Armor',
            items: [item],
            foundCount: 0,
          },
        ];
        // Empty progress lookup - item-1 is not in the map
        const progressLookup = createMockProgressLookup();
        const characters: Character[] = [];
        const onItemClick = vi.fn();

        // Act
        render(
          <GroupedMasonryGrid
            groupedItems={groupedItems}
            progressLookup={progressLookup}
            characters={characters}
            onItemClick={onItemClick}
          />,
        );

        // Assert - ItemCard is still rendered with empty progress
        expect(screen.getByTestId('item-card-item-1')).toBeDefined();
      });
    });
  });
});

describe('GroupedMasonryGrid Column Sizing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('When GroupedMasonryGrid renders a group in a container that fits three columns', () => {
    it('Then rows use the same column count and gutter as the masonry grid', () => {
      // Arrange
      stubLayout({ width: widthForColumns(3) });
      const groupedItems = [
        {
          title: 'Unique Armor',
          items: [1, 2, 3, 4].map((n) => createMockItem({ id: `item-${n}`, name: `Item ${n}` })),
          foundCount: 0,
        },
      ];

      // Act
      render(
        <GroupedMasonryGrid
          groupedItems={groupedItems}
          progressLookup={createMockProgressLookup()}
          characters={[]}
          onItemClick={vi.fn()}
        />,
      );

      // Assert
      const rows = screen.getAllByTestId('grouped-grid-row');
      expect(rows).toHaveLength(2);
      expect(rows[0].style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
      expect(rows[0].style.columnGap).toBe(`${COLUMN_GUTTER}px`);
      expect(rows[0].children).toHaveLength(3);
      expect(rows[1].children).toHaveLength(1);
    });
  });
});

describe('GroupedMasonryGrid Virtualization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('When a group has far more items than fit into the viewport', () => {
    it('Then only the rows near the top of the scroll container are mounted', () => {
      // Arrange
      stubLayout({ height: 600 });
      const items = Array.from({ length: 50 }, (_, n) =>
        createMockItem({ id: `item-${n}`, name: `Item ${n}` }),
      );

      // Act
      render(
        <GroupedMasonryGrid
          groupedItems={[{ title: 'Unique Armor', items, foundCount: 0 }]}
          progressLookup={createMockProgressLookup()}
          characters={[]}
          onItemClick={vi.fn()}
        />,
      );

      // Assert
      const renderedCards = screen.getAllByTestId(/^item-card-/);
      expect(renderedCards.length).toBeGreaterThan(0);
      expect(renderedCards.length).toBeLessThan(items.length);
      expect(screen.getByText('Unique Armor')).toBeInTheDocument();
      expect(screen.getByTestId('item-card-item-0')).toBeInTheDocument();
      expect(screen.queryByTestId('item-card-item-49')).not.toBeInTheDocument();
    });
  });
});

describe('GroupedMasonryGrid Row Measurement', () => {
  const resizeCallbacks: ResizeObserverCallback[] = [];
  let containerWidth = 0;

  beforeEach(() => {
    resizeCallbacks.length = 0;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallbacks.push(callback);
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * Stubs layout so that every row is as tall as the number of cards it holds (100px per card plus
   * 20px row padding, 50px per header), like a real browser where wider rows are taller.
   */
  function stubRowHeights() {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => containerWidth);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => containerWidth);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.index === undefined) return 600;
      const cardCount = this.querySelectorAll('[data-testid^="item-card-"]').length;
      return cardCount > 0 ? cardCount * 100 + 20 : 50;
    });
  }

  describe('When the container is resized so that the column count changes', () => {
    describe('If rows were measured at the previous column count', () => {
      it('Then the rows are measured again instead of reusing the cached heights', () => {
        // Arrange
        containerWidth = widthForColumns(1);
        stubRowHeights();
        const groupedItems = [
          {
            title: 'Unique Armor',
            items: Array.from({ length: 7 }, (_, n) =>
              createMockItem({ id: `item-${n}`, name: `Item ${n}` }),
            ),
            foundCount: 0,
          },
        ];
        const { container } = render(
          <GroupedMasonryGrid
            groupedItems={groupedItems}
            progressLookup={createMockProgressLookup()}
            characters={[]}
            onItemClick={vi.fn()}
          />,
        );
        const content = container.querySelector<HTMLElement>('div[style*="position: relative"]');
        // 50px header + 7 rows with one card each
        expect(content?.style.height).toBe(`${50 + 7 * 120}px`);

        // Act
        containerWidth = widthForColumns(3);
        act(() => {
          for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
        });

        // Assert
        expect(screen.getAllByTestId('grouped-grid-row')).toHaveLength(3);
        // 50px header + two rows with three cards and one row with a single card
        expect(content?.style.height).toBe(`${50 + 2 * 320 + 120}px`);
      });
    });
  });
});
