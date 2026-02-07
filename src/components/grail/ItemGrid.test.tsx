import { render, screen } from '@testing-library/react';
import type { Item, Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures';
import type { ProgressLookupData } from '@/hooks/useProgressLookup';
import { ItemGrid } from './ItemGrid';

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

// Mock dependencies for component tests
vi.mock('@/stores/grailStore');
vi.mock('@/hooks/useProgressLookup');
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
vi.mock('./MasonryItemGrid', () => ({
  MasonryItemGrid: ({ items }: { items: Item[] }) => (
    <div data-testid="masonry-item-grid">{items.length} items</div>
  ),
  GroupedMasonryGrid: ({
    groupedItems,
  }: {
    groupedItems: Array<{ title: string; items: Item[] }>;
  }) => <div data-testid="grouped-masonry-grid">{groupedItems.length} groups</div>,
}));

// Import after mocks
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { useFilteredItems, useGrailStore } from '@/stores/grailStore';

const mockSetGroupMode = vi.fn();

function setupComponentMocks(
  overrides: {
    filteredItems?: Item[];
    progress?: unknown[];
    characters?: unknown[];
    selectedCharacterId?: string | null;
    settings?: Partial<Settings>;
    viewMode?: string;
    groupMode?: string;
  } = {},
) {
  const mergedSettings = { ...defaultSettings, ...overrides.settings };
  const storeState = {
    progress: overrides.progress ?? [],
    characters: overrides.characters ?? [],
    selectedCharacterId: overrides.selectedCharacterId ?? null,
    settings: mergedSettings,
    viewMode: overrides.viewMode ?? 'grid',
    groupMode: overrides.groupMode ?? 'none',
    setGroupMode: mockSetGroupMode,
  };

  const mockUseGrailStore = vi.mocked(useGrailStore);
  mockUseGrailStore.mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as ReturnType<typeof useGrailStore>;
  });

  vi.mocked(useFilteredItems).mockReturnValue(overrides.filteredItems ?? []);

  const progressMap = new Map<string, ProgressLookupData>();
  vi.mocked(useProgressLookup).mockReturnValue(progressMap);
}

describe('When ItemGrid component is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupComponentMocks();
  });

  describe('If viewMode "grid" and groupMode "none"', () => {
    it('Then renders MasonryItemGrid', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().buildMany(3);
      setupComponentMocks({ filteredItems: items, viewMode: 'grid', groupMode: 'none' });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(screen.getByTestId('masonry-item-grid')).toBeInTheDocument();
    });
  });

  describe('If viewMode "grid" and groupMode "category"', () => {
    it('Then renders GroupedMasonryGrid', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().buildMany(3);
      setupComponentMocks({ filteredItems: items, viewMode: 'grid', groupMode: 'category' });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(screen.getByTestId('grouped-masonry-grid')).toBeInTheDocument();
    });
  });

  describe('If viewMode "list"', () => {
    it('Then renders list virtualized container', () => {
      // Arrange
      const items = HolyGrailItemBuilder.new().buildMany(3);
      setupComponentMocks({ filteredItems: items, viewMode: 'list', groupMode: 'none' });

      // Act
      render(<ItemGrid />);

      // Assert — list view uses a div-based virtualized container (no masonry)
      expect(screen.queryByTestId('masonry-item-grid')).not.toBeInTheDocument();
      expect(screen.queryByTestId('grouped-masonry-grid')).not.toBeInTheDocument();
    });
  });

  describe('If no items pass filter', () => {
    it('Then renders empty grid', () => {
      // Arrange
      setupComponentMocks({ filteredItems: [], viewMode: 'grid', groupMode: 'none' });

      // Act
      render(<ItemGrid />);

      // Assert
      expect(screen.getByTestId('masonry-item-grid')).toHaveTextContent('0 items');
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

      // Assert — the component filters to only normal items via filterSingleGrailType
      // MasonryItemGrid receives only the filtered items
      expect(screen.getByTestId('masonry-item-grid')).toHaveTextContent('1 items');
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
      expect(screen.getByTestId('masonry-item-grid')).toHaveTextContent('1 items');
    });
  });
});
