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
/** The mercenary item list header "jf", followed directly by the golem header "kf" when no items are listed. */
const MERCENARY_AND_GOLEM_HEADERS = Buffer.from('jfkf', 'latin1');
const MERCENARY_HEADER_LENGTH = 2;
/**
 * Offset of the mercenary id in a v105 character header: the d2s fork reads it there, and halbu's
 * v105 layout puts the mercenary block at 161 (the v99 offset 0xb3 minus the 16 bytes the name moved).
 */
const MERCENARY_ID_OFFSET = 163;
const EQUIPPED_LOCATION_ID = 1;
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
  return finalizeSave(result);
}

/** An item a hired mercenary wears, with the equipment slot it sits in. */
export interface WornItem {
  item: d2sTypes.IItem;
  equippedId: number;
}

/**
 * Returns a copy of a v105 character save that has a hired mercenary wearing the given items. The
 * save gets a mercenary id and, behind the "jf" header, the item list ("JM", count, items) written
 * with the d2s v105 item writer, as the game does for a hired mercenary.
 * @param save - A v105 character save without a mercenary
 * @param wornItems - The items the mercenary wears; none hires a mercenary with an empty list
 */
export async function hireRotwMercenary(save: Buffer, wornItems: WornItem[]): Promise<Buffer> {
  const headersOffset = save.lastIndexOf(MERCENARY_AND_GOLEM_HEADERS);
  if (headersOffset === -1) {
    throw new Error('The save has no empty mercenary item list');
  }
  const itemBytes: Buffer[] = [];
  for (const { item, equippedId } of wornItems) {
    const worn: d2sTypes.IItem = {
      ...structuredClone(item),
      location_id: EQUIPPED_LOCATION_ID,
      equipped_id: equippedId,
      position_x: 0,
      position_y: 0,
      alt_position_id: 0,
    };
    itemBytes.push(Buffer.from(await writeItem(worn, 105, constants105, {})));
  }
  const itemCount = Buffer.alloc(2);
  itemCount.writeUInt16LE(wornItems.length);

  const listOffset = headersOffset + MERCENARY_HEADER_LENGTH;
  const result = Buffer.concat([
    save.subarray(0, listOffset),
    ITEM_LIST_HEADER,
    itemCount,
    ...itemBytes,
    save.subarray(listOffset),
  ]);
  result.writeUInt32LE(1, MERCENARY_ID_OFFSET);
  return finalizeSave(result);
}

/** True when the file size and checksum stored in the save header match its content. */
export function hasValidSizeAndChecksum(save: Buffer): boolean {
  const withoutChecksum = Buffer.from(save);
  withoutChecksum.writeUInt32LE(0, CHECKSUM_OFFSET);
  return (
    save.readUInt32LE(FILE_SIZE_OFFSET) === save.length &&
    save.readUInt32LE(CHECKSUM_OFFSET) === computeSaveChecksum(withoutChecksum)
  );
}

/** Updates the file size and checksum of a save whose content was changed. */
export function finalizeSave(save: Buffer): Buffer {
  save.writeUInt32LE(save.length, FILE_SIZE_OFFSET);
  save.writeUInt32LE(0, CHECKSUM_OFFSET);
  save.writeUInt32LE(computeSaveChecksum(save), CHECKSUM_OFFSET);
  return save;
}
