import { act, render, renderHook, screen } from '@testing-library/react';
import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLUMN_GUTTER,
  createGridRows,
  getColumnCount,
  MIN_COLUMN_WIDTH,
  useElementColumnCount,
  VirtualItemGrid,
} from './VirtualItemGrid';

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

describe('VirtualItemGrid Column Count Calculation', () => {
  describe('When getColumnCount is called', () => {
    describe('If the container is narrower than two minimum-width columns', () => {
      it('Then should return 1 column', () => {
        // Arrange
        const twoColumnThreshold = 2 * MIN_COLUMN_WIDTH + COLUMN_GUTTER;

        // Act
        const narrowColumnCount = getColumnCount(320);
        const justBelowThresholdColumnCount = getColumnCount(twoColumnThreshold - 1);

        // Assert
        expect(narrowColumnCount).toBe(1);
        expect(justBelowThresholdColumnCount).toBe(1);
      });
    });

    describe('If the container width is zero, negative or not a number', () => {
      it('Then should fall back to 1 column', () => {
        // Arrange
        const invalidWidths = [0, -100, Number.NaN];

        // Act
        const columnCounts = invalidWidths.map((width) => getColumnCount(width));

        // Assert
        expect(columnCounts).toEqual([1, 1, 1]);
      });
    });

    describe('If the container fits exactly N minimum-width columns', () => {
      it('Then should return N columns', () => {
        // Arrange
        const widthFor = (columns: number) =>
          columns * MIN_COLUMN_WIDTH + (columns - 1) * COLUMN_GUTTER;

        // Act
        const columnCounts = [
          getColumnCount(widthFor(2)),
          getColumnCount(widthFor(3)),
          getColumnCount(widthFor(6)),
          getColumnCount(widthFor(6) - 1),
        ];

        // Assert
        expect(columnCounts).toEqual([2, 3, 6, 5]);
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
        const columnWidths = containerWidths.map((width) => {
          const columns = getColumnCount(width);
          return (width - (columns - 1) * COLUMN_GUTTER) / columns;
        });

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

describe('When createGridRows is called', () => {
  describe('If a group has more items than fit into one row', () => {
    it('Then emits a header followed by rows of at most columnCount items', () => {
      // Arrange
      const items = [1, 2, 3, 4, 5].map((n) => createMockItem({ id: `item-${n}` }));

      // Act
      const rows = createGridRows([{ title: 'Helms', items, foundCount: 2 }], 2);

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
      const rows = createGridRows(groupedItems, 3);

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
      const zeroRows = createGridRows([{ title: 'G', items, foundCount: 0 }], 0);
      const nanRows = createGridRows([{ title: 'G', items, foundCount: 0 }], Number.NaN);

      // Assert
      expect(zeroRows.filter((row) => row.type === 'items')).toHaveLength(2);
      expect(nanRows.filter((row) => row.type === 'items')).toHaveLength(2);
    });
  });

  describe('If group headers are hidden', () => {
    it('Then emits only item rows in item order', () => {
      // Arrange
      const items = [1, 2, 3].map((n) => createMockItem({ id: `item-${n}` }));

      // Act
      const rows = createGridRows([{ title: 'All Items', items, foundCount: 1 }], 2, false);

      // Assert
      expect(rows.map((row) => row.type)).toEqual(['items', 'items']);
      expect(
        rows.flatMap((row) => (row.type === 'items' ? row.items.map((item) => item.id) : [])),
      ).toEqual(['item-1', 'item-2', 'item-3']);
    });
  });
});

describe('VirtualItemGrid Component', () => {
  beforeEach(() => {
    stubLayout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('When VirtualItemGrid is rendered', () => {
    describe('If groupedItems is empty', () => {
      it('Then should render an empty scroll container without rows', () => {
        // Arrange
        const progressLookup = createMockProgressLookup();
        const characters: Character[] = [];
        const onItemClick = vi.fn();

        // Act
        const { container } = render(
          <VirtualItemGrid
            groupedItems={[]}
            showGroupHeaders
            progressLookup={progressLookup}
            characters={characters}
            onItemClick={onItemClick}
          />,
        );

        // Assert
        expect(container.firstElementChild).toHaveClass('min-h-0', 'flex-1', 'overflow-auto');
        expect(screen.queryAllByTestId('item-grid-row')).toHaveLength(0);
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
          <VirtualItemGrid
            groupedItems={groupedItems}
            showGroupHeaders
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
          <VirtualItemGrid
            groupedItems={groupedItems}
            showGroupHeaders
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
          <VirtualItemGrid
            groupedItems={groupedItems}
            showGroupHeaders
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
          <VirtualItemGrid
            groupedItems={groupedItems}
            showGroupHeaders
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
          <VirtualItemGrid
            groupedItems={groupedItems}
            showGroupHeaders
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
          <VirtualItemGrid
            groupedItems={groupedItems}
            showGroupHeaders
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
          <VirtualItemGrid
            groupedItems={groupedItems}
            showGroupHeaders
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
          <VirtualItemGrid
            groupedItems={groupedItems}
            showGroupHeaders
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

describe('When VirtualItemGrid is rendered without group headers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('If it shows a single group of items that fits two columns', () => {
    it('Then renders the items in rows without a group header', () => {
      // Arrange
      stubLayout({ width: widthForColumns(2) });
      const groupedItems = [
        {
          title: 'All Items',
          items: [1, 2, 3].map((n) => createMockItem({ id: `item-${n}`, name: `Item ${n}` })),
          foundCount: 1,
        },
      ];

      // Act
      render(
        <VirtualItemGrid
          groupedItems={groupedItems}
          showGroupHeaders={false}
          progressLookup={createMockProgressLookup()}
          characters={[]}
          onItemClick={vi.fn()}
        />,
      );

      // Assert
      expect(screen.queryByText('All Items')).not.toBeInTheDocument();
      expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
      const rows = screen.getAllByTestId('item-grid-row');
      expect(rows).toHaveLength(2);
      expect(rows[0].style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
      expect(screen.getAllByTestId(/^item-card-/).map((card) => card.textContent)).toEqual([
        'Item 1',
        'Item 2',
        'Item 3',
      ]);
    });
  });

  describe('If an item card is clicked', () => {
    it('Then calls onItemClick with the item id', () => {
      // Arrange
      stubLayout();
      const onItemClick = vi.fn();
      render(
        <VirtualItemGrid
          groupedItems={[
            {
              title: 'All Items',
              items: [createMockItem({ id: 'item-1', name: 'Harlequin Crest' })],
              foundCount: 0,
            },
          ]}
          showGroupHeaders={false}
          progressLookup={createMockProgressLookup()}
          characters={[]}
          onItemClick={onItemClick}
        />,
      );

      // Act
      screen.getByTestId('item-card-item-1').click();

      // Assert
      expect(onItemClick).toHaveBeenCalledWith('item-1');
    });
  });
});

describe('When VirtualItemGrid is sized to its container', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('If the container fits three columns', () => {
    it('Then rows use the fitting column count and the column gutter', () => {
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
        <VirtualItemGrid
          groupedItems={groupedItems}
          showGroupHeaders
          progressLookup={createMockProgressLookup()}
          characters={[]}
          onItemClick={vi.fn()}
        />,
      );

      // Assert
      const rows = screen.getAllByTestId('item-grid-row');
      expect(rows).toHaveLength(2);
      expect(rows[0].style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
      expect(rows[0].style.columnGap).toBe(`${COLUMN_GUTTER}px`);
      expect(rows[0].style.paddingBottom).toBe(`${COLUMN_GUTTER}px`);
      expect(rows[0].children).toHaveLength(3);
      expect(rows[1].children).toHaveLength(1);
    });
  });
});

describe('When VirtualItemGrid renders a group with far more items than fit into the viewport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.each([
    { showGroupHeaders: true },
    { showGroupHeaders: false },
  ])('If the group headers are shown: $showGroupHeaders', ({ showGroupHeaders }) => {
    it('Then only the rows near the top of the scroll container are mounted', () => {
      // Arrange
      stubLayout({ height: 600 });
      const items = Array.from({ length: 50 }, (_, n) =>
        createMockItem({ id: `item-${n}`, name: `Item ${n}` }),
      );

      // Act
      render(
        <VirtualItemGrid
          groupedItems={[{ title: 'Unique Armor', items, foundCount: 0 }]}
          showGroupHeaders={showGroupHeaders}
          progressLookup={createMockProgressLookup()}
          characters={[]}
          onItemClick={vi.fn()}
        />,
      );

      // Assert
      const renderedCards = screen.getAllByTestId(/^item-card-/);
      expect(renderedCards.length).toBeGreaterThan(0);
      expect(renderedCards.length).toBeLessThan(items.length);
      expect(screen.getByTestId('item-card-item-0')).toBeInTheDocument();
      expect(screen.queryByTestId('item-card-item-49')).not.toBeInTheDocument();
      expect(screen.queryByText('Unique Armor') !== null).toBe(showGroupHeaders);
    });
  });
});

describe('When useElementColumnCount is used', () => {
  describe('If the ref is not attached to an element', () => {
    it('Then keeps the single-column fallback', () => {
      // Arrange
      const detachedRef = { current: null };

      // Act
      const { result } = renderHook(() => useElementColumnCount(detachedRef));

      // Assert
      expect(result.current).toBe(1);
    });
  });
});

describe('When the items of a rendered VirtualItemGrid shrink to fewer rows', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('If the grid is re-rendered with a shorter list', () => {
    it('Then only the remaining rows are rendered', () => {
      // Arrange
      stubLayout({ height: 600, width: widthForColumns(1) });
      const createGroups = (count: number) => [
        {
          title: 'Unique Armor',
          items: Array.from({ length: count }, (_, n) =>
            createMockItem({ id: `item-${n}`, name: `Item ${n}` }),
          ),
          foundCount: 0,
        },
      ];
      const renderGrid = (count: number) => (
        <VirtualItemGrid
          groupedItems={createGroups(count)}
          showGroupHeaders
          progressLookup={createMockProgressLookup()}
          characters={[]}
          onItemClick={vi.fn()}
        />
      );
      const { rerender } = render(renderGrid(20));

      // Act
      rerender(renderGrid(2));

      // Assert
      expect(screen.getAllByTestId('item-grid-row')).toHaveLength(2);
      expect(screen.queryByTestId('item-card-item-2')).not.toBeInTheDocument();
    });
  });
});

describe('When VirtualItemGrid rows are measured', () => {
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
   * Stubs layout with a deliberately artificial height model: a row's height is proportional to the
   * number of cards it holds (100px per card plus 20px row padding, 50px per header). A real CSS
   * grid row is only as tall as its tallest card; this model is chosen so that a column-count
   * change yields a distinguishable total height.
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

  describe('If the container is resized so that the column count changes', () => {
    it('Then rows measured at the previous column count are measured again instead of reusing cached heights', () => {
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
        <VirtualItemGrid
          groupedItems={groupedItems}
          showGroupHeaders
          progressLookup={createMockProgressLookup()}
          characters={[]}
          onItemClick={vi.fn()}
        />,
      );
      // The scroll container wraps the content element whose height is the virtualizer total size
      const content = container.firstElementChild?.firstElementChild as HTMLElement;
      const heightAtOneColumn = content.style.height;

      // Act
      containerWidth = widthForColumns(3);
      act(() => {
        for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
      });

      // Assert
      // 50px header + 7 rows with one card each
      expect(heightAtOneColumn).toBe(`${50 + 7 * 120}px`);
      expect(screen.getAllByTestId('item-grid-row')).toHaveLength(3);
      // 50px header + two rows with three cards and one row with a single card
      expect(content.style.height).toBe(`${50 + 2 * 320 + 120}px`);
    });
  });
});
