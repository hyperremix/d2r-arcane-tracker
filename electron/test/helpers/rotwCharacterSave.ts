import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import { writeItem } from '@dschu012/d2s/lib/d2/items';
import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import { parseModernStash } from '../../services/modernStashParser';

/**
 * A real Reign of the Warlock (v105) save of a level 1 softcore Warlock named "Warlock", as the game
 * writes it. Taken from the MIT-licensed halbu project (https://github.com/feored/halbu,
 * assets/test/Warlock_v105.d2s, Copyright (c) 2023 feor). It holds the starting items only.
 */
export const WARLOCK_SAVE_FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/WarlockV105.d2s',
);

/** A real v105 modern shared stash, used as the source of real v105 items. */
const MODERN_STASH_FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
);

const FILE_SIZE_OFFSET = 0x08;
const CHECKSUM_OFFSET = 0x0c;
const ITEM_LIST_HEADER = Buffer.from('JM', 'latin1');
/** Location ids of an item in the character's inventory grid. */
const STORED_LOCATION_ID = 0;
const INVENTORY_ALT_POSITION_ID = 1;

/** Reads the Warlock save fixture. */
export function readWarlockSave(): Buffer {
  return readFileSync(WARLOCK_SAVE_FIXTURE_PATH);
}

/**
 * Reads an item of the modern shared stash fixture by its unique or set name. These items were
 * written by the game in the v105 item format that character saves use as well.
 */
export async function readModernStashItem(name: string): Promise<d2sTypes.IItem> {
  const { items } = await parseModernStash(readFileSync(MODERN_STASH_FIXTURE_PATH));
  const entry = items.find(({ item }) => item.unique_name === name || item.set_name === name);
  if (!entry) {
    throw new Error(`No item named ${name} in the modern stash fixture`);
  }
  return entry.item as d2sTypes.IItem;
}

/** The checksum D2 stores at 0x0c, computed with the checksum field zeroed. */
function computeSaveChecksum(save: Buffer): number {
  let checksum = 0;
  for (const byte of save) {
    checksum = (((checksum << 1) | (checksum >>> 31)) + byte) >>> 0;
  }
  return checksum;
}

/**
 * Returns a copy of a v105 character save with an item added to the inventory grid. The item is
 * serialized with the d2s v105 item writer and spliced in as the first entry of the character's
 * item list (items are byte-aligned), then the item count, file size and checksum are updated.
 * @param save - A v105 character save
 * @param item - The item to add; its location is set to the inventory cell (x, y)
 */
export async function addItemToRotwCharacterSave(
  save: Buffer,
  item: d2sTypes.IItem,
  x: number,
  y: number,
): Promise<Buffer> {
  const itemListOffset = save.indexOf(ITEM_LIST_HEADER);
  if (itemListOffset === -1) {
    throw new Error('The save has no item list');
  }
  const placed: d2sTypes.IItem = {
    ...structuredClone(item),
    location_id: STORED_LOCATION_ID,
    alt_position_id: INVENTORY_ALT_POSITION_ID,
    equipped_id: 0,
    position_x: x,
    position_y: y,
  };
  const itemBytes = Buffer.from(await writeItem(placed, 105, constants105, {}));

  const firstItemOffset = itemListOffset + ITEM_LIST_HEADER.length + 2;
  const result = Buffer.concat([
    save.subarray(0, firstItemOffset),
    itemBytes,
    save.subarray(firstItemOffset),
  ]);
  const itemCountOffset = itemListOffset + ITEM_LIST_HEADER.length;
  result.writeUInt16LE(result.readUInt16LE(itemCountOffset) + 1, itemCountOffset);
  result.writeUInt32LE(result.length, FILE_SIZE_OFFSET);
  result.writeUInt32LE(0, CHECKSUM_OFFSET);
  result.writeUInt32LE(computeSaveChecksum(result), CHECKSUM_OFFSET);
  return result;
}
