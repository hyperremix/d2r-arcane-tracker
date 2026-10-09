import { fireEvent, render, screen } from '@testing-library/react';
import type { GrailFilter, Item, Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures';
import type { ProgressLookupData } from '@/hooks/useProgressLookup';
import { ItemGrid } from './ItemGrid';
import type { ItemGridGroup } from './VirtualItemGrid';

// ============================================================================
// Helper functions copied from ItemGrid for testing
// ============================================================================

// Helper function to group items by base ID (copied from ItemGrid for testing)
function groupItemsByBaseId(items: Item[]) {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const baseId = item.id.startsWith('eth_') ? item.id.slice(4) : item.id;
    const arr = groups.get(baseId) ?? [];
    arr.push(item);
    groups.set(baseId, arr);
  }
  return groups;
}

// Helper function to select canonical item from a family (copied from ItemGrid for testing)
function selectCanonicalItem(family: Item[]) {
  const base = family.find((i) => !i.id.startsWith('eth_'));
  const eth = family.find((i) => i.id.startsWith('eth_'));
  const representative = base ?? eth;

  if (!representative) return null;

  const type = representative.etherealType;

  if (type === 'optional' || type === 'none') {
    return base || null;
  }
  if (type === 'only') {
    return eth || null;
  }
  return null;
}

// Helper function to deduplicate items when both grail types are enabled (copied from ItemGrid for testing)
function deduplicateItems(items: Item[]) {
  const groups = groupItemsByBaseId(items);
  const canonicalItems: Item[] = [];

  for (const [, family] of groups) {
    const canonicalItem = selectCanonicalItem(family);
    if (canonicalItem) {
      canonicalItems.push(canonicalItem);
    }
  }

  return canonicalItems;
}

// getEtherealGroupKey function copied from ItemGrid for testing
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Test helper copied from source
function getEtherealGroupKey(
  itemData: Item,
  itemProgress: { normalFound: boolean; etherealFound: boolean } | undefined,
  settings: Settings,
) {
  const hasEthereal = itemProgress?.etherealFound;
  const hasNormal = itemProgress?.normalFound;
  // Use inline checks instead of importing (tests shouldn't depend on module internals)
  const canBeEthereal =
    settings.grailEthereal &&
    (itemData.etherealType === 'optional' || itemData.etherealType === 'only');
  const canBeNormal =
    settings.grailNormal &&
    (itemData.etherealType === 'none' || itemData.etherealType === 'optional');

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

// calculateGroupFoundCount function copied from ItemGrid for testing
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

type VirtualRowType =
  | { type: 'header'; groupTitle: string; itemCount: number; foundCount: number }
  | { type: 'items'; items: Item[]; groupIndex: number };

// createListRows function copied from ItemGrid for testing
function createListRows(items: Item[], groupIndex: number): VirtualRowType[] {
  return items.map((item) => ({
    type: 'items' as const,
    items: [item],
    groupIndex,
  }));
}

// ============================================================================
// Default settings for tests
// ============================================================================
const defaultSettings: Settings = {
  saveDir: '',
  lang: 'en',
  gameMode: GameMode.Both,
  grailNormal: true,
  grailEthereal: true,
  grailRunes: false,
  grailRunewords: false,
  gameVersion: GameVersion.Resurrected,
  enableSounds: true,
  notificationVolume: 0.5,
  inAppNotifications: true,
  nativeNotifications: true,
  needsSeeding: true,
  theme: 'system',
  showItemIcons: false,
};

// ============================================================================
// Pure helper function tests
// ============================================================================

describe('ItemGrid Deduplication Logic', () => {
  it('should deduplicate optional ethereal items correctly', () => {
    // Arrange
    const items: Item[] = [
      {
        id: 'item1',
        name: 'Test Item',
        type: 'unique',
        category: 'armor',
        subCategory: 'body_armor',
        treasureClass: 'normal',
        etherealType: 'optional',
        setName: undefined,
        code: 'item1',
        link: '',
      },
      {
        id: 'eth_item1',
        name: 'Test Item',
        type: 'unique',
        category: 'armor',
        subCategory: 'body_armor',
        treasureClass: 'normal',
        etherealType: 'optional',
        setName: undefined,
        code: 'item1',
        link: '',
      },
      {
        id: 'item2',
        name: 'Normal Only Item',
        type: 'unique',
        category: 'armor',
        subCategory: 'body_armor',
        treasureClass: 'exceptional',
        etherealType: 'none',
        setName: undefined,
        code: 'item2',
        link: '',
      },
      {
        id: 'eth_item3',
        name: 'Ethereal Only Item',
        type: 'unique',
        category: 'armor',
        subCategory: 'body_armor',
        treasureClass: 'elite',
        etherealType: 'only',
        setName: undefined,
        code: 'item3',
        link: '',
      },
    ];

    // Act
    const result = deduplicateItems(items);

    // Assert
    expect(result).toHaveLength(3);
    expect(result.find((item) => item.id === 'item1')).toBeDefined();
    expect(result.find((item) => item.id === 'eth_item1')).toBeUndefined();
    expect(result.find((item) => item.id === 'item2')).toBeDefined();
    expect(result.find((item) => item.id === 'eth_item3')).toBeDefined();
  });

  it('should handle items with only one version', () => {
    // Arrange
    const items: Item[] = [
      {
        id: 'item1',
        name: 'Test Item',
        type: 'unique',
        category: 'armor',
        subCategory: 'body_armor',
        treasureClass: 'normal',
        etherealType: 'optional',
        setName: undefined,
        code: 'item1',
        link: '',
      },
    ];

    // Act
    const result = deduplicateItems(items);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('item1');
  });

  it('should handle empty input', () => {
    // Arrange
    const items: Item[] = [];

    // Act
    const result = deduplicateItems(items);

    // Assert
    expect(result).toHaveLength(0);
  });
});

describe('When getEtherealGroupKey is called', () => {
  describe('If neither normal nor ethereal can apply', () => {
    it('Then returns "Not Applicable"', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('none').build();
      const settings = { ...defaultSettings, grailNormal: false, grailEthereal: true };

      // Act
      const result = getEtherealGroupKey(item, undefined, settings);

      // Assert
      expect(result).toBe('Not Applicable');
    });
  });

  describe('If only normal can apply and normal is found', () => {
    it('Then returns "Normal Found"', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('none').build();
      const settings = { ...defaultSettings, grailNormal: true, grailEthereal: false };

      // Act
      const result = getEtherealGroupKey(
        item,
        { normalFound: true, etherealFound: false },
        settings,
      );

      // Assert
      expect(result).toBe('Normal Found');
    });
  });

  describe('If only normal can apply and normal is not found', () => {
    it('Then returns "Normal Not Found"', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('none').build();
      const settings = { ...defaultSettings, grailNormal: true, grailEthereal: false };

      // Act
      const result = getEtherealGroupKey(
        item,
        { normalFound: false, etherealFound: false },
        settings,
      );

      // Assert
      expect(result).toBe('Normal Not Found');
    });
  });

  describe('If only ethereal can apply and ethereal is found', () => {
    it('Then returns "Ethereal Found"', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('only').build();
      const settings = { ...defaultSettings, grailNormal: false, grailEthereal: true };

      // Act
      const result = getEtherealGroupKey(
        item,
        { normalFound: false, etherealFound: true },
        settings,
      );

      // Assert
      expect(result).toBe('Ethereal Found');
    });
  });

  describe('If only ethereal can apply and ethereal is not found', () => {
    it('Then returns "Ethereal Not Found"', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('only').build();
      const settings = { ...defaultSettings, grailNormal: false, grailEthereal: true };

      // Act
      const result = getEtherealGroupKey(
        item,
        { normalFound: false, etherealFound: false },
        settings,
      );

      // Assert
      expect(result).toBe('Ethereal Not Found');
    });
  });

  describe('If both can apply and both found', () => {
    it('Then returns "Both Found"', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const result = getEtherealGroupKey(
        item,
        { normalFound: true, etherealFound: true },
        defaultSettings,
      );

      // Assert
      expect(result).toBe('Both Found');
    });
  });

  describe('If both can apply and only ethereal found', () => {
    it('Then returns "Ethereal Only"', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const result = getEtherealGroupKey(
        item,
        { normalFound: false, etherealFound: true },
        defaultSettings,
      );

      // Assert
      expect(result).toBe('Ethereal Only');
    });
  });

  describe('If both can apply and only normal found', () => {
    it('Then returns "Normal Only"', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const result = getEtherealGroupKey(
        item,
        { normalFound: true, etherealFound: false },
        defaultSettings,
      );

      // Assert
      expect(result).toBe('Normal Only');
    });
  });

  describe('If both can apply and neither found', () => {
    it('Then returns "Neither Found"', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const result = getEtherealGroupKey(
        item,
        { normalFound: false, etherealFound: false },
        defaultSettings,
      );

      // Assert
      expect(result).toBe('Neither Found');
    });
  });
});

describe('When calculateGroupFoundCount is called', () => {
  describe('If none found', () => {
    it('Then returns 0', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().withId('item').buildMany(3);
      const lookup = new Map<string, { overallFound: boolean }>();
      for (const item of items) {
        lookup.set(item.id, { overallFound: false });
      }

      // Act
      const result = calculateGroupFoundCount(items, lookup);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('If some found', () => {
    it('Then returns correct count', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().withId('item').buildMany(3);
      const lookup = new Map<string, { overallFound: boolean }>();
      lookup.set(items[0].id, { overallFound: true });
      lookup.set(items[1].id, { overallFound: false });
      lookup.set(items[2].id, { overallFound: true });

      // Act
      const result = calculateGroupFoundCount(items, lookup);

      // Assert
      expect(result).toBe(2);
    });
  });

  describe('If all found', () => {
    it('Then returns total', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().withId('item').buildMany(3);
      const lookup = new Map<string, { overallFound: boolean }>();
      for (const item of items) {
        lookup.set(item.id, { overallFound: true });
      }

      // Act
      const result = calculateGroupFoundCount(items, lookup);

      // Assert
      expect(result).toBe(3);
    });
  });
});

describe('When createListRows is called', () => {
  describe('If items provided', () => {
    it('Then creates one row per item with type "items"', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().withId('item').buildMany(3);

      // Act
      const result = createListRows(items, 0);

      // Assert
      expect(result).toHaveLength(3);
      for (const row of result) {
        expect(row.type).toBe('items');
        if (row.type === 'items') {
          expect(row.items).toHaveLength(1);
          expect(row.groupIndex).toBe(0);
        }
      }
    });
  });

  describe('If no items', () => {
    it('Then returns empty array', () => {
      // Arrange & Act
      const result = createListRows([], 0);

      // Assert
      expect(result).toHaveLength(0);
    });
  });
});

// ============================================================================
// Component tests
// ============================================================================

// Records the groupedItems prop of every VirtualItemGrid render and how often it is mounted
const groupedGridRenders = vi.hoisted(() => ({
  groupedItems: [] as ItemGridGroup[][],
  mounts: 0,
}));

function lastRenderedGroups(): ItemGridGroup[] {
  return groupedGridRenders.groupedItems[groupedGridRenders.groupedItems.length - 1];
}

function createFoundProgressLookup(itemId: string) {
  return new Map<string, ProgressLookupData>([
    [
      itemId,
      {
        normalFound: true,
        etherealFound: false,
        normalProgress: [],
        etherealProgress: [],
        overallFound: true,
      },
    ],
  ]);
}

// Mock dependencies for component tests
vi.mock('@/stores/grailStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/grailStore')>()),
  useGrailStore: vi.fn(),
  useFilteredItems: vi.fn(),
}));
vi.mock('@/hooks/useProgressLookup');
const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => mockNavigate,
}));
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measureElement: vi.fn(),
  }),
}));
vi.mock('./ItemCard', () => ({
  ItemCard: ({ item }: { item: Item }) => <div data-testid="item-card">{item.name}</div>,
}));
vi.mock('./ItemDetailsDialog', () => ({
  ItemDetailsDialog: ({ itemId, open }: { itemId: string | null; open: boolean }) =>
    open ? <div data-testid="item-details-dialog">{itemId}</div> : null,
}));
vi.mock('./VirtualItemGrid', () => ({
  ItemCardCell: ({ item }: { item: Item }) => <div data-testid="item-card">{item.name}</div>,
  VirtualItemGrid: ({
    groupedItems,
    showGroupHeaders,
    onItemClick,
  }: {
    groupedItems: ItemGridGroup[];
    showGroupHeaders: boolean;
    onItemClick: (itemId: string) => void;
  }) => {
    groupedGridRenders.groupedItems.push(groupedItems);
    useEffect(() => {
      groupedGridRenders.mounts += 1;
    }, []);
    const itemCount = groupedItems.reduce((count, group) => count + group.items.length, 0);
    return (
      <div data-testid="virtual-item-grid" data-show-group-headers={String(showGroupHeaders)}>
        <span data-testid="grid-item-count">{itemCount} items</span>
        <ul>
          {groupedItems.map((group) => (
            <li key={group.title} data-testid="group">
              <span data-testid="group-title">{group.title}</span>: {group.items.length}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => onItemClick('some-item')}>
          select item
        </button>
      </div>
    );
  },
}));

// Import after mocks
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { useFilteredItems, useGrailStore } from '@/stores/grailStore';

const mockSetGroupMode = vi.fn();
const mockResetFilters = vi.fn();
const mockReloadData = vi.fn();

function setupComponentMocks(
  overrides: {
    filteredItems?: Item[];
    items?: Item[];
    filter?: GrailFilter;
    loading?: boolean;
    progress?: unknown[];
    characters?: unknown[];
    settings?: Partial<Settings>;
    viewMode?: string;
    groupMode?: string;
    progressLookup?: Map<string, ProgressLookupData>;
  } = {},
) {
  const mergedSettings = { ...defaultSettings, ...overrides.settings };
  const storeState = {
    progress: overrides.progress ?? [],
    characters: overrides.characters ?? [],
    settings: mergedSettings,
    viewMode: overrides.viewMode ?? 'grid',
    groupMode: overrides.groupMode ?? 'none',
    setGroupMode: mockSetGroupMode,
    items: overrides.items ?? overrides.filteredItems ?? [],
    filter: overrides.filter ?? { foundStatus: 'all' },
    loading: overrides.loading ?? false,
    resetFilters: mockResetFilters,
    reloadData: mockReloadData,
  };

  const mockUseGrailStore = vi.mocked(useGrailStore);
  mockUseGrailStore.mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as ReturnType<typeof useGrailStore>;
  });

  vi.mocked(useFilteredItems).mockReturnValue(overrides.filteredItems ?? []);

  const progressMap = overrides.progressLookup ?? new Map<string, ProgressLookupData>();
  vi.mocked(useProgressLookup).mockReturnValue(progressMap);
}

describe('When ItemGrid component is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupedGridRenders.groupedItems.length = 0;
    groupedGridRenders.mounts = 0;
    setupComponentMocks();
  });

  describe('If viewMode "grid" and groupMode "none"', () => {
    it('Then renders all items in the virtualized grid without group headers', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().buildMany(3);
      setupComponentMocks({ filteredItems: items, viewMode: 'grid', groupMode: 'none' });

      // Act
      render(<ItemGrid />);

      // Assert
      const grid = screen.getByTestId('virtual-item-grid');
      expect(grid).toHaveAttribute('data-show-group-headers', 'false');
      expect(screen.getAllByTestId('group')).toHaveLength(1);
      expect(screen.getByTestId('grid-item-count')).toHaveTextContent('3 items');
    });
  });

  describe('If viewMode "grid" and groupMode "category"', () => {
    it('Then renders the virtualized grid with group headers', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().buildMany(3);
      setupComponentMocks({ filteredItems: items, viewMode: 'grid', groupMode: 'category' });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(screen.getByTestId('virtual-item-grid')).toHaveAttribute(
        'data-show-group-headers',
        'true',
      );
    });

    it('Then group titles are translated category labels', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('a').withCategory('armor').build(),
        HolyGrailItemBuilder.new().withId('b').withCategory('runewords').build(),
      ];
      setupComponentMocks({ filteredItems: items, viewMode: 'grid', groupMode: 'category' });

      // Act
      render(<ItemGrid />);

      // Assert
      const titles = screen.getAllByTestId('group-title').map((el) => el.textContent);
      expect(titles).toEqual(['Armor', 'Runewords']);
    });
  });

  describe('If viewMode "grid" and groupMode "type"', () => {
    it('Then group titles are translated type labels', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('a').withType('unique').build(),
        HolyGrailItemBuilder.new().withId('b').withType('runeword').build(),
      ];
      setupComponentMocks({ filteredItems: items, viewMode: 'grid', groupMode: 'type' });

      // Act
      render(<ItemGrid />);

      // Assert
      const titles = screen.getAllByTestId('group-title').map((el) => el.textContent);
      expect(titles).toEqual(['Unique', 'Runeword']);
    });
  });

  describe('If viewMode "grid" and the groupMode switches between "none" and a grouping', () => {
    it('Then the grid is remounted, but not when switching between two groupings', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().buildMany(3);
      setupComponentMocks({ filteredItems: items, viewMode: 'grid', groupMode: 'none' });
      render(<ItemGrid />);
      const mountsAfterUngroupedRender = groupedGridRenders.mounts;
      // ItemGrid is memoized and reads the mocked store, so a state change (selecting an item)
      // is what makes it render again with the updated group mode
      const renderWithGroupMode = (groupMode: string) => {
        setupComponentMocks({ filteredItems: items, viewMode: 'grid', groupMode });
        fireEvent.click(screen.getByRole('button', { name: 'select item' }));
      };

      // Act
      renderWithGroupMode('category');
      const mountsAfterGroupedRender = groupedGridRenders.mounts;
      renderWithGroupMode('type');

      // Assert
      expect(mountsAfterUngroupedRender).toBe(1);
      expect(mountsAfterGroupedRender).toBe(2);
      expect(groupedGridRenders.mounts).toBe(2);
    });
  });

  describe('If viewMode "grid", groupMode "category" and an item is found', () => {
    it('Then passes the found count of each group to VirtualItemGrid', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('found').build()];
      setupComponentMocks({
        filteredItems: items,
        groupMode: 'category',
        progressLookup: createFoundProgressLookup('found'),
      });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(lastRenderedGroups()[0].foundCount).toBe(1);
    });
  });

  describe('If viewMode "grid", groupMode "none" and an item is found', () => {
    it('Then skips counting found items because no group headers are shown', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('found').build()];
      setupComponentMocks({
        filteredItems: items,
        groupMode: 'none',
        progressLookup: createFoundProgressLookup('found'),
      });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(lastRenderedGroups()[0].foundCount).toBeUndefined();
    });
  });

  describe('If viewMode "grid" and groupMode "category" and an unrelated ItemGrid state changes', () => {
    it('Then passes the same grouped items to VirtualItemGrid', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().buildMany(3);
      setupComponentMocks({ filteredItems: items, viewMode: 'grid', groupMode: 'category' });
      render(<ItemGrid />);
      const rendersAfterMount = groupedGridRenders.groupedItems.length;

      // Act — selecting an item only changes the selected item id of ItemGrid
      fireEvent.click(screen.getByRole('button', { name: 'select item' }));

      // Assert
      expect(screen.getByTestId('item-details-dialog')).toBeInTheDocument();
      expect(groupedGridRenders.groupedItems.length).toBeGreaterThan(rendersAfterMount);
      expect(new Set(groupedGridRenders.groupedItems).size).toBe(1);
    });
  });

  describe('If viewMode "list"', () => {
    it('Then renders list virtualized container', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().buildMany(3);
      setupComponentMocks({ filteredItems: items, viewMode: 'list', groupMode: 'none' });

      // Act
      render(<ItemGrid />);

      // Assert — list view uses its own div-based virtualized container (not the card grid)
      expect(screen.queryByTestId('virtual-item-grid')).not.toBeInTheDocument();
    });
  });

  // The grid view's scroll container lives inside VirtualItemGrid and is covered by its own tests
  describe('If viewMode "list", groupMode "none" and there are items to show', () => {
    it('Then the items container is the single scroll container inside a bounded root', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().buildMany(3);
      setupComponentMocks({ filteredItems: items, viewMode: 'list', groupMode: 'none' });

      // Act
      const { container } = render(<ItemGrid />);

      // Assert — a bounded root lets the virtualizers measure the visible viewport
      const root = container.firstElementChild;
      const scroller = root?.firstElementChild;
      expect(root).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
      expect(root).not.toHaveClass('overflow-auto');
      expect(root).not.toHaveClass('overflow-y-auto');
      expect(scroller).toHaveClass('min-h-0', 'flex-1', 'overflow-auto');
    });
  });

  describe('If the empty state is shown', () => {
    it('Then the empty state scrolls inside the bounded root', () => {
      // Arrange
      setupComponentMocks({ filteredItems: [], items: [], loading: false });

      // Act
      render(<ItemGrid />);

      // Assert
      const emptyState = screen.getByTestId('item-grid-empty-state');
      expect(emptyState.parentElement).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    });
  });

  describe.each([
    ['grid', 'none'],
    ['grid', 'category'],
    ['list', 'none'],
  ])('If viewMode "%s", groupMode "%s" and active filters match no items', (viewMode, groupMode) => {
    it('Then renders the no-matches empty state instead of the items container', () => {
      // Arrange
      setupComponentMocks({
        filteredItems: [],
        items: HolyGrailItemBuilder.new().buildMany(3),
        filter: { foundStatus: 'all', searchTerm: 'does-not-exist' },
        viewMode,
        groupMode,
      });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(screen.getByTestId('item-grid-empty-state')).toHaveAttribute(
        'data-variant',
        'noMatches',
      );
      expect(screen.getByText('No items match your filters')).toBeInTheDocument();
      expect(screen.queryByTestId('virtual-item-grid')).not.toBeInTheDocument();
    });
  });

  describe('If active filters match no items and the user clicks Clear filters', () => {
    it('Then resets the store filters', () => {
      // Arrange
      setupComponentMocks({
        filteredItems: [],
        items: HolyGrailItemBuilder.new().buildMany(3),
        filter: { foundStatus: 'missing', categories: ['armor'] },
      });
      render(<ItemGrid />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      // Assert
      expect(mockResetFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe('If both normal and ethereal grail tracking are disabled', () => {
    it('Then renders the tracking-disabled empty state with a link to Settings', () => {
      // Arrange
      setupComponentMocks({
        filteredItems: HolyGrailItemBuilder.new().buildMany(3),
        settings: { grailNormal: false, grailEthereal: false },
      });
      render(<ItemGrid />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));

      // Assert
      expect(screen.getByTestId('item-grid-empty-state')).toHaveAttribute(
        'data-variant',
        'trackingDisabled',
      );
      expect(screen.getByText('Grail tracking is turned off')).toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith('/settings');
      expect(screen.queryByTestId('virtual-item-grid')).not.toBeInTheDocument();
    });
  });

  describe('If items are still loading and none are available yet', () => {
    it('Then renders the loading empty state without an action', () => {
      // Arrange
      setupComponentMocks({ filteredItems: [], items: [], loading: true });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(screen.getByTestId('item-grid-empty-state')).toHaveAttribute(
        'data-variant',
        'loading',
      );
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('If there are no items at all and nothing is loading', () => {
    it('Then renders the no-items empty state and Retry reloads the data', () => {
      // Arrange
      setupComponentMocks({ filteredItems: [], items: [], loading: false });
      render(<ItemGrid />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      // Assert
      expect(screen.getByTestId('item-grid-empty-state')).toHaveAttribute(
        'data-variant',
        'noItems',
      );
      expect(screen.getByText('No items to show yet')).toBeInTheDocument();
      expect(mockReloadData).toHaveBeenCalledTimes(1);
    });
  });

  describe('If items are loaded but tracking settings hide all of them and no filters are active', () => {
    it('Then renders the hidden-by-settings empty state with a link to Settings', () => {
      // Arrange
      const ethOnlyItems = HolyGrailItemBuilder.new().withEtherealType('only').buildMany(3);
      setupComponentMocks({
        filteredItems: ethOnlyItems,
        settings: { grailNormal: true, grailEthereal: false },
      });
      render(<ItemGrid />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));

      // Assert
      expect(screen.getByTestId('item-grid-empty-state')).toHaveAttribute(
        'data-variant',
        'hiddenBySettings',
      );
      expect(screen.getByText('No items match your tracking settings')).toBeInTheDocument();
      expect(screen.queryByText('No items to show yet')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });
  });

  describe('If grailNormal true, grailEthereal false', () => {
    it('Then only renders items that can be normal', () => {
      // Arrange
      const normalItem = HolyGrailItemBuilder.new()
        .withId('normal-item')
        .withEtherealType('none')
        .build();
      const ethOnlyItem = HolyGrailItemBuilder.new()
        .withId('eth-only')
        .withEtherealType('only')
        .build();
      setupComponentMocks({
        filteredItems: [normalItem, ethOnlyItem],
        settings: { grailNormal: true, grailEthereal: false },
        viewMode: 'grid',
        groupMode: 'none',
      });

      // Act
      render(<ItemGrid />);

      // Assert — the component filters to only normal items via filterItemsByTrackedVersions
      // VirtualItemGrid receives only the filtered items
      expect(screen.getByTestId('grid-item-count')).toHaveTextContent('1 items');
    });
  });

  describe('If grailNormal false, grailEthereal true', () => {
    it('Then only renders items that can be ethereal', () => {
      // Arrange
      const normalOnlyItem = HolyGrailItemBuilder.new()
        .withId('normal-only')
        .withEtherealType('none')
        .build();
      const ethItem = HolyGrailItemBuilder.new()
        .withId('eth-item')
        .withEtherealType('optional')
        .build();
      setupComponentMocks({
        filteredItems: [normalOnlyItem, ethItem],
        settings: { grailNormal: false, grailEthereal: true },
        viewMode: 'grid',
        groupMode: 'none',
      });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(screen.getByTestId('grid-item-count')).toHaveTextContent('1 items');
    });
  });

  describe('If ethereal tracking is enabled and group mode is ethereal', () => {
    it('Then keeps the ethereal group mode and groups items by translated ethereal status', () => {
      // Arrange
      const bothFoundItem = HolyGrailItemBuilder.new()
        .withId('both-found')
        .withEtherealType('optional')
        .build();
      const neitherFoundItem = HolyGrailItemBuilder.new()
        .withId('neither-found')
        .withEtherealType('optional')
        .build();
      const normalOnlyTypeItem = HolyGrailItemBuilder.new()
        .withId('normal-type')
        .withEtherealType('none')
        .build();
      const etherealOnlyTypeItem = HolyGrailItemBuilder.new()
        .withId('eth-type')
        .withEtherealType('only')
        .build();
      const progressLookup = new Map<string, ProgressLookupData>([
        [
          'both-found',
          {
            normalFound: true,
            etherealFound: true,
            normalProgress: [],
            etherealProgress: [],
            overallFound: true,
          },
        ],
        [
          'normal-type',
          {
            normalFound: true,
            etherealFound: false,
            normalProgress: [],
            etherealProgress: [],
            overallFound: true,
          },
        ],
      ]);
      setupComponentMocks({
        filteredItems: [bothFoundItem, neitherFoundItem, normalOnlyTypeItem, etherealOnlyTypeItem],
        settings: { grailNormal: true, grailEthereal: true },
        viewMode: 'grid',
        groupMode: 'ethereal',
        progressLookup,
      });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(mockSetGroupMode).not.toHaveBeenCalled();
      expect(screen.getAllByTestId('group').map((group) => group.textContent)).toEqual([
        'Both Found: 1',
        'Neither Found: 1',
        'Normal Found: 1',
        'Ethereal Not Found: 1',
      ]);
    });
  });

  describe('If ethereal tracking is disabled and group mode is ethereal', () => {
    it('Then resets the group mode to none', () => {
      // Arrange
      setupComponentMocks({
        filteredItems: HolyGrailItemBuilder.new().withEtherealType('none').buildMany(2),
        settings: { grailNormal: true, grailEthereal: false },
        groupMode: 'ethereal',
      });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(mockSetGroupMode).toHaveBeenCalledWith('none');
    });
  });

  describe('If ethereal tracking is disabled and group mode is not ethereal', () => {
    it('Then does not change the group mode', () => {
      // Arrange
      setupComponentMocks({
        filteredItems: HolyGrailItemBuilder.new().buildMany(2),
        settings: { grailNormal: true, grailEthereal: false },
        groupMode: 'category',
      });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(mockSetGroupMode).not.toHaveBeenCalled();
    });
  });
});
