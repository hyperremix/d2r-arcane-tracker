import type { Item } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';

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
    expect(result.find((item) => item.id === 'item1')).toBeDefined(); // Base item for optional
    expect(result.find((item) => item.id === 'eth_item1')).toBeUndefined(); // Eth version should be deduplicated
    expect(result.find((item) => item.id === 'item2')).toBeDefined(); // Normal only item
    expect(result.find((item) => item.id === 'eth_item3')).toBeDefined(); // Ethereal only item
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
