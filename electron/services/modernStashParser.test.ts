import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseModernStash, resolveStackCount } from './modernStashParser';

const FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
);

describe('When parseModernStash parses v105 fixtures', () => {
  it('Then it emits normalized stash tabs with placeable resource entries', async () => {
    // Arrange
    const buffer = readFileSync(FIXTURE_PATH);

    // Act
    const parsed = await parseModernStash(buffer);

    // Assert
    expect(parsed.version).toBe(105);
    expect(parsed.hardcore).toBe(false);
    expect(parsed.items.length).toBeGreaterThan(0);
    expect(parsed.items.length).toBe(130);

    const tabKinds = new Set(parsed.items.map((entry) => entry.stashTabKind));
    expect(tabKinds.has('shared')).toBe(true);
    expect(tabKinds.has('gems')).toBe(true);
    expect(tabKinds.has('materials')).toBe(true);
    expect(tabKinds.has('runes')).toBe(true);
    expect(parsed.items.every((entry) => entry.stackCount >= 1 && entry.stackCount <= 99)).toBe(
      true,
    );
    expect(parsed.items.every((entry) => entry.stackCount === 1)).toBe(true);
    expect(
      parsed.items.every(
        (entry) => typeof entry.item.code === 'string' && entry.item.code.trim().length > 0,
      ),
    ).toBe(true);
    expect(
      parsed.items.every(
        (entry) =>
          typeof entry.item.inv_width === 'number' &&
          entry.item.inv_width > 0 &&
          typeof entry.item.inv_height === 'number' &&
          entry.item.inv_height > 0,
      ),
    ).toBe(true);

    const runeItems = parsed.items.filter((entry) => entry.stashTabKind === 'runes');
    const gemItems = parsed.items.filter((entry) => entry.stashTabKind === 'gems');
    expect(new Set(runeItems.map((entry) => entry.item.code)).size).toBeGreaterThan(10);
    expect(new Set(gemItems.map((entry) => entry.item.code)).size).toBeGreaterThan(10);

    for (const tab of [5, 6, 7]) {
      const tabItems = parsed.items.filter((entry) => entry.stashTab === tab);
      const occupied = new Set<string>();
      tabItems.forEach((entry) => {
        const x = entry.item.position_x as number;
        const y = entry.item.position_y as number;
        const width = entry.item.inv_width as number;
        const height = entry.item.inv_height as number;

        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + width).toBeLessThanOrEqual(10);
        expect(y + height).toBeLessThanOrEqual(10);

        for (let dx = 0; dx < width; dx += 1) {
          for (let dy = 0; dy < height; dy += 1) {
            const key = `${x + dx},${y + dy}`;
            expect(occupied.has(key)).toBe(false);
            occupied.add(key);
          }
        }
      });
    }
  }, 20000);
});

describe('When resolveStackCount checks stackable sources', () => {
  it('Then it only accepts explicit quantity values for modern stash', () => {
    // Arrange
    const fromQuantity = {
      type: 'r01',
      quantity: 9,
    };
    const fallbackToOne = {
      type: 'r03',
      magic_attributes: [{ id: 381, name: 'unknown_381', values: [0] }],
    } as unknown as Parameters<typeof resolveStackCount>[0];
    const fromMagicAttr = {
      type: 'r01',
      magic_attributes: [{ id: 381, name: 'item_quantity_r', values: [42] }],
    } as unknown as Parameters<typeof resolveStackCount>[0];

    // Act & Assert
    expect(resolveStackCount(fromQuantity)).toBe(9);
    expect(resolveStackCount(fallbackToOne)).toBe(1);
    expect(resolveStackCount(fromMagicAttr)).toBe(42);
  });
});
