import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type * as d2sTypes from '@dschu012/d2s';
import { BitReader } from '@dschu012/d2s/lib/binary/bitreader';
import { _readMagicProperties, writeItem } from '@dschu012/d2s/lib/d2/items';
import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import { describe, expect, it } from 'vitest';
import {
  constants105Extended,
  parseModernStash,
  readSectorItems,
  resolveStackCount,
} from './modernStashParser';

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
    expect(parsed.items.every((entry) => entry.stackCount >= 1 && entry.stackCount <= 511)).toBe(
      true,
    );
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
    const sharedItemsWithMagic = parsed.items.filter(
      (entry) =>
        entry.stashTabKind === 'shared' &&
        Array.isArray(entry.item.magic_attributes) &&
        entry.item.magic_attributes.length > 0,
    );
    expect(sharedItemsWithMagic.length).toBeGreaterThan(0);
    expect(
      sharedItemsWithMagic.every((entry) =>
        Array.isArray(
          (
            entry.item as {
              displayed_combined_magic_attributes?: Array<{ description?: unknown }>;
            }
          ).displayed_combined_magic_attributes,
        ),
      ),
    ).toBe(true);
    expect(
      sharedItemsWithMagic.some((entry) => {
        const displayed = (
          entry.item as {
            displayed_combined_magic_attributes?: Array<{ description?: unknown }>;
          }
        ).displayed_combined_magic_attributes;
        return (
          Array.isArray(displayed) &&
          displayed.some(
            (attribute) =>
              typeof attribute.description === 'string' && attribute.description.trim().length > 0,
          )
        );
      }),
    ).toBe(true);

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

// Build the same extended constants used in modernStashParser.ts
const constants105WithAttr381 = {
  ...constants105,
  magical_properties: (() => {
    const arr = [
      ...(constants105.magical_properties as Array<{ s: string; sB: number; np?: number }>),
    ];
    while (arr.length < 381) arr.push({ s: `unknown_${arr.length}`, sB: 0 });
    arr.push({ s: 'item_quantity_r', sB: 9 });
    return arr;
  })(),
} as unknown as d2sTypes.types.IConstantData;

describe('When _readMagicProperties processes a resource-stash binary stream', () => {
  it('Then it reads attribute 381 (item_quantity_r) as the stack count value', () => {
    // Arrange: 4 bytes encoding [attr ID 381 (9 bits)] + [value 5 (9 bits)] + [terminator 0x1FF (9 bits)]
    // Verified bit-by-bit: 0x7D=125, 0x0B=11, 0xFC=252, 0x07=7
    const reader = new BitReader(new Uint8Array([0x7d, 0x0b, 0xfc, 0x07]).buffer);

    // Act
    const attrs = _readMagicProperties(reader, constants105WithAttr381);

    // Assert
    expect(attrs).toHaveLength(1);
    expect(attrs[0].id).toBe(381);
    expect(attrs[0].values[0]).toBe(5);
    expect(attrs[0].name).toBe('item_quantity_r');
  });
});

describe('When resolveStackCount reads a simple_item resource with quantity set by the v105 field', () => {
  it('Then it returns the item.quantity value as the stack count', () => {
    // Arrange: simple resource items have simple_item=1, no magic_attributes.
    // The d2s v105 conditional field populates item.quantity for these items.
    const simpleRuneWithCount = {
      type: 'r05',
      quantity: 7,
    } as unknown as Parameters<typeof resolveStackCount>[0];

    const simpleRuneWithMaxCount = {
      type: 'r20',
      quantity: 255,
    } as unknown as Parameters<typeof resolveStackCount>[0];

    // Act & Assert
    expect(resolveStackCount(simpleRuneWithCount)).toBe(7);
    expect(resolveStackCount(simpleRuneWithMaxCount)).toBe(255);
  });
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

    const attr381TakesPriorityOverQuantity = {
      type: 'key', // 'key' IS in stackables — quantity would normally be used
      quantity: 3,
      magic_attributes: [{ id: 381, name: 'item_quantity_r', values: [42] }],
    } as unknown as Parameters<typeof resolveStackCount>[0];

    // Act & Assert
    expect(resolveStackCount(fromQuantity)).toBe(9);
    expect(resolveStackCount(fallbackToOne)).toBe(1);
    expect(resolveStackCount(fromMagicAttr)).toBe(42);
    expect(resolveStackCount(attr381TakesPriorityOverQuantity)).toBe(42);
  });
});

describe('When readSectorItems parses a JM payload with trailing invalid item bytes', () => {
  it('Then it returns already-decoded leading items instead of dropping the whole sector', async () => {
    // Arrange
    const serializedItem = Buffer.from(
      await writeItem(
        {
          type: 'r01',
          code: 'r01',
          identified: true,
          simple_item: 1,
          ethereal: 0,
          socketed: 0,
          new: 1,
          personalized: 0,
          given_runeword: 0,
          location_id: 0,
          equipped_id: 0,
          position_x: 0,
          position_y: 0,
          alt_position_id: 5,
          quality: 1,
          quantity: 1,
        } as unknown as d2sTypes.types.IItem,
        105,
        constants105Extended as unknown as d2sTypes.types.IConstantData,
        { extendedStash: false, sortProperties: true },
      ),
    );
    const header = Buffer.alloc(4);
    header.write('JM', 0, 'ascii');
    header.writeUInt16LE(2, 2);
    const payload = Buffer.concat([header, serializedItem, Buffer.from([0x00])]);

    // Act
    const parsed = await readSectorItems(payload, 105);

    // Assert
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(
      expect.objectContaining({
        type: 'r01',
        position_x: 0,
        position_y: 0,
      }),
    );
  });
});

describe('When readSectorItems reaches EOF while decoding a truncated trailing item', () => {
  it('Then it keeps the already-decoded leading items and exits without OOM', async () => {
    // Arrange
    const serializedItem = Buffer.from(
      await writeItem(
        {
          type: 'r01',
          code: 'r01',
          identified: true,
          simple_item: 1,
          ethereal: 0,
          socketed: 0,
          new: 1,
          personalized: 0,
          given_runeword: 0,
          location_id: 0,
          equipped_id: 0,
          position_x: 0,
          position_y: 0,
          alt_position_id: 5,
          quality: 1,
          quantity: 1,
        } as unknown as d2sTypes.types.IItem,
        105,
        constants105Extended as unknown as d2sTypes.types.IConstantData,
        { extendedStash: false, sortProperties: true },
      ),
    );
    const header = Buffer.alloc(4);
    header.write('JM', 0, 'ascii');
    header.writeUInt16LE(2, 2);
    const payload = Buffer.concat([header, serializedItem, Buffer.from([0x00, 0x00])]);

    // Act
    const parsed = await readSectorItems(payload, 105);

    // Assert
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(
      expect.objectContaining({
        type: 'r01',
        position_x: 0,
        position_y: 0,
      }),
    );
  });
});
