import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type * as d2sTypes from '@dschu012/d2s';
import { BitReader } from '@dschu012/d2s/lib/binary/bitreader';
import { _readMagicProperties, writeItem } from '@dschu012/d2s/lib/d2/items';
import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import { describe, expect, it } from 'vitest';
import { constants105Extended, parseModernStash, resolveStackCount } from './modernStashParser';
import { readD2iMetadata } from './stashFormat';

const FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
);

const D2I_SECTOR_HEADER_SIZE = 64;

/** Wraps one JM payload into a minimal v105 .d2i file with a single (shared tab 0) sector. */
function buildSingleSectorD2i(payload: Buffer): Buffer {
  const header = Buffer.alloc(D2I_SECTOR_HEADER_SIZE);
  header.writeUInt32LE(0xaa55aa55, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(105, 8);
  header.writeUInt32LE(D2I_SECTOR_HEADER_SIZE + payload.length, 16);
  return Buffer.concat([header, payload]);
}

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

    // Act
    const countFromQuantity = resolveStackCount(simpleRuneWithCount);
    const countFromMaxQuantity = resolveStackCount(simpleRuneWithMaxCount);

    // Assert
    expect(countFromQuantity).toBe(7);
    expect(countFromMaxQuantity).toBe(255);
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

    // Act
    const quantityCount = resolveStackCount(fromQuantity);
    const fallbackCount = resolveStackCount(fallbackToOne);
    const magicAttrCount = resolveStackCount(fromMagicAttr);
    const priorityCount = resolveStackCount(attr381TakesPriorityOverQuantity);

    // Assert
    expect(quantityCount).toBe(9);
    expect(fallbackCount).toBe(1);
    expect(magicAttrCount).toBe(42);
    expect(priorityCount).toBe(42);
  });
});

describe('When parseModernStash reads a JM sector with trailing invalid item bytes', () => {
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
    const result = await parseModernStash(buildSingleSectorD2i(payload));

    // Assert
    expect(result.items).toHaveLength(1);
    expect(result.items[0].item).toEqual(
      expect.objectContaining({
        type: 'r01',
        position_x: 0,
        position_y: 0,
      }),
    );
    expect(result.partial).toBe(true);
  });
});

describe('When parseModernStash reaches EOF while decoding a truncated trailing item', () => {
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
    const result = await parseModernStash(buildSingleSectorD2i(payload));

    // Assert
    expect(result.items).toHaveLength(1);
    expect(result.items[0].item).toEqual(
      expect.objectContaining({
        type: 'r01',
        position_x: 0,
        position_y: 0,
      }),
    );
    expect(result.partial).toBe(true);
  });
});

describe('When parseModernStash decodes every item the sector header declares', () => {
  it('Then the file is not partial', async () => {
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
    header.writeUInt16LE(1, 2);
    const payload = Buffer.concat([header, serializedItem]);

    // Act
    const result = await parseModernStash(buildSingleSectorD2i(payload));

    // Assert
    expect(result.items).toHaveLength(1);
    expect(result.partial).toBe(false);
  });
});

describe('When parseModernStash receives a sector that is not a readable JM item list', () => {
  it.each([
    ['shorter than a JM header', Buffer.from([0x4a, 0x4d])],
    ['missing the JM signature', Buffer.from([0x00, 0x00, 0x01, 0x00])],
  ])('Then a payload %s is reported as partial with no items', async (_scenario, payload) => {
    // Arrange
    const buffer = buildSingleSectorD2i(payload);

    // Act
    const result = await parseModernStash(buffer);

    // Assert
    expect(result.items).toEqual([]);
    expect(result.partial).toBe(true);
  });
});

describe('When parseModernStash reads a shared stash whose sector declares more items than it holds', () => {
  const FIXTURE = resolve(
    process.cwd(),
    'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
  );

  it('Then an intact file is not partial', async () => {
    // Arrange
    const buffer = readFileSync(FIXTURE);

    // Act
    const parsed = await parseModernStash(buffer);

    // Assert
    expect(parsed.partial).toBe(false);
  }, 20000);

  it('Then the file is flagged partial when a sector is damaged', async () => {
    // Arrange
    const buffer = Buffer.from(readFileSync(FIXTURE));
    const firstJmSector = readD2iMetadata(buffer).sectors.findIndex(
      (sector) => sector.payloadSignature === 'JM',
    );
    const damaged = readD2iMetadata(buffer).sectors[firstJmSector];
    // Declaring far more items than the sector holds forces the decoder to run past the data.
    buffer.writeUInt16LE(0xffff, damaged.payloadOffset + 2);

    // Act
    const parsed = await parseModernStash(buffer);

    // Assert
    expect(parsed.partial).toBe(true);
  }, 20000);
});

describe('When parseModernStash reads a stash whose sector stream is damaged outside the item data', () => {
  const FIXTURE = resolve(
    process.cwd(),
    'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
  );

  it('Then a truncated tail after the last sector is flagged partial', async () => {
    // Arrange
    const buffer = Buffer.concat([readFileSync(FIXTURE), Buffer.alloc(10)]);

    // Act
    const parsed = await parseModernStash(buffer);

    // Assert
    expect(parsed.partial).toBe(true);
  }, 20000);

  it('Then a trailing sector with a bad signature is flagged partial', async () => {
    // Arrange
    const buffer = Buffer.concat([readFileSync(FIXTURE), Buffer.alloc(80, 0x11)]);

    // Act
    const parsed = await parseModernStash(buffer);

    // Assert
    expect(parsed.partial).toBe(true);
  }, 20000);

  it('Then a sector whose payload is neither an item list nor the known extra-data block is flagged partial', async () => {
    // Arrange
    const buffer = Buffer.from(readFileSync(FIXTURE));
    const sectors = readD2iMetadata(buffer).sectors;
    const lastSector = sectors[sectors.length - 1];
    buffer.write('XX', lastSector.payloadOffset, 'ascii');

    // Act
    const parsed = await parseModernStash(buffer);

    // Assert
    expect(parsed.partial).toBe(true);
  }, 20000);
});
