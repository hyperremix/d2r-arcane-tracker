import type { ParsedInventoryItem } from 'electron/types/grail';
import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  formatInventoryTileLabel,
  formatQuality,
  formatSourceFileTypeLabel,
} from './inventoryItemLabels';

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

function createItem(overrides: Partial<ParsedInventoryItem>): ParsedInventoryItem {
  return {
    itemName: 'Shako',
    quality: 'unique',
    locationContext: 'inventory',
    sourceFileType: 'd2s',
    ...overrides,
  } as ParsedInventoryItem;
}

describe('When an inventory tile label is built', () => {
  it('If the item is in a stash tab, Then the label names the item, its quality and the tab', () => {
    // Arrange
    const item = createItem({ locationContext: 'stash', stashTab: 1 });

    // Act
    const label = formatInventoryTileLabel(item, t);

    // Assert
    expect(label).toBe('Shako, Unique, Stash Tab 2');
  });

  it('If the item is equipped, Then the label names the equipped location', () => {
    // Arrange
    const item = createItem({ quality: 'magic', locationContext: 'equipped' });

    // Act
    const label = formatInventoryTileLabel(item, t);

    // Assert
    expect(label).toBe('Shako, Magic, Equipped');
  });
});

describe('When an item quality is formatted', () => {
  it.each([
    ['normal', 'Normal'],
    ['crafted', 'Crafted'],
    ['mystery', 'mystery'],
  ])('If the quality is %s, Then it reads %s', (quality, expected) => {
    // Arrange / Act
    const result = formatQuality(quality, t);

    // Assert
    expect(result).toBe(expected);
  });
});

describe('When a source file type is formatted', () => {
  it.each([
    ['d2s', 'Character'],
    ['d2i', 'Shared stash'],
    ['sss', 'Shared stash'],
    ['d2x', 'Shared stash'],
    ['', 'Unknown source file'],
    [undefined, 'Unknown source file'],
  ])('If the type is %s, Then it reads %s', (sourceFileType, expected) => {
    // Arrange / Act
    const result = formatSourceFileTypeLabel(sourceFileType, t);

    // Assert
    expect(result).toBe(expected);
  });
});
