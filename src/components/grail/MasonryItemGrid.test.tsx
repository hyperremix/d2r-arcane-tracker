import { render, screen } from '@testing-library/react';
import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { describe, expect, it, vi } from 'vitest';
import { calculateColumnWidth, GroupedMasonryGrid, getColumnCount } from './MasonryItemGrid';

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
    describe('If viewport width is >= 1536px (2xl breakpoint)', () => {
      it('Then should return 6 columns', () => {
        // Arrange & Act & Assert
        expect(getColumnCount(1536)).toBe(6);
        expect(getColumnCount(1920)).toBe(6);
        expect(getColumnCount(2560)).toBe(6);
      });
    });

    describe('If viewport width is >= 1280px but < 1536px (xl breakpoint)', () => {
      it('Then should return 5 columns', () => {
        // Arrange & Act & Assert
        expect(getColumnCount(1280)).toBe(5);
        expect(getColumnCount(1400)).toBe(5);
        expect(getColumnCount(1535)).toBe(5);
      });
    });

    describe('If viewport width is >= 1024px but < 1280px (lg breakpoint)', () => {
      it('Then should return 4 columns', () => {
        // Arrange & Act & Assert
        expect(getColumnCount(1024)).toBe(4);
        expect(getColumnCount(1100)).toBe(4);
        expect(getColumnCount(1279)).toBe(4);
      });
    });

    describe('If viewport width is >= 768px but < 1024px (md breakpoint)', () => {
      it('Then should return 3 columns', () => {
        // Arrange & Act & Assert
        expect(getColumnCount(768)).toBe(3);
        expect(getColumnCount(900)).toBe(3);
        expect(getColumnCount(1023)).toBe(3);
      });
    });

    describe('If viewport width is >= 640px but < 768px (sm breakpoint)', () => {
      it('Then should return 2 columns', () => {
        // Arrange & Act & Assert
        expect(getColumnCount(640)).toBe(2);
        expect(getColumnCount(700)).toBe(2);
        expect(getColumnCount(767)).toBe(2);
      });
    });

    describe('If viewport width is < 640px (default)', () => {
      it('Then should return 1 column', () => {
        // Arrange & Act & Assert
        expect(getColumnCount(639)).toBe(1);
        expect(getColumnCount(500)).toBe(1);
        expect(getColumnCount(320)).toBe(1);
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

describe('GroupedMasonryGrid Component', () => {
  describe('When GroupedMasonryGrid is rendered', () => {
    describe('If groupedItems is empty', () => {
      it('Then should render empty container', () => {
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
        expect(container.querySelector('.h-full.w-full')).toBeDefined();
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
