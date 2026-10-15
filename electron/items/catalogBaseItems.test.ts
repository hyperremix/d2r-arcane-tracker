import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import { describe, expect, it } from 'vitest';
import { items } from './index';

interface ParserBaseItem {
  n?: string;
}

/**
 * Catalog entries whose `itemBase` is deliberately not the parser's name for their `code`. The
 * parser calls these base items "Crafted Sunder Charm" and "Colossal Jewel", which are internal
 * names; the catalog shows the in-game names that diablo2.io uses.
 */
const displayNameExceptions: Record<string, string> = {
  cs2: 'Grand Charm',
  cjw: 'Jewel',
};

describe('When the catalog item bases are compared with the v105 parser base items', () => {
  it('If a catalog item has a code, Then its item base is the parser name of that code, except for the display names', () => {
    // Arrange
    const parserBaseItems: Record<string, ParserBaseItem | undefined> = {
      ...constants105.armor_items,
      ...constants105.weapon_items,
      ...constants105.other_items,
    };
    const itemsWithBase = items.filter((item) => item.code && item.itemBase);

    // Act
    const mismatches = itemsWithBase
      .filter((item) => {
        const code = item.code as string;
        const expected = displayNameExceptions[code] ?? parserBaseItems[code]?.n;
        return item.itemBase !== expected;
      })
      .map(
        (item) =>
          `${item.id}: ${item.code} ${item.itemBase} (parser: ${parserBaseItems[item.code as string]?.n})`,
      );

    // Assert
    expect(itemsWithBase.length).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });
});
