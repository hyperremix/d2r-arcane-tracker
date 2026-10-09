import { readFile } from 'node:fs/promises';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import { readItem, writeItem } from '@dschu012/d2s/lib/d2/items';
import { normalizeItemCodeKey, SHARED_TAB_COUNT } from '../../utils/d2rFormat';
import { createBoundedBitReader } from '../boundedBitReader';
import { constants105Extended } from '../modernStashParser';
import { readD2iMetadata } from '../stashFormat';
import { JM_ITEM_COUNT_OFFSET, JM_ITEM_DATA_OFFSET, rebuildD2iBuffer } from './d2iSectors';
import { resolveItemCode } from './itemFields';
import { itemMatchesLocator } from './itemLocators';
import { assertTargetCellsFree } from './itemPlacement';
import {
  isResourceCodeAllowedForTab,
  shouldKeepQuantity,
  stripResourceStashStackMetadata,
} from './resourceStacks';
import { writeSaveFile } from './saveFileWrites';

/**
 * Finds, adds and removes items in the shared tabs (0-4) of a modern .d2i stash by splicing
 * item bytes, so items that are not touched keep their original bytes.
 */

/**
 * JM sector indexes that can hold the given tab. Shared tabs 0-4 have a sector each; the gems,
 * materials and runes tabs (5-7) all live in the sector(s) after them, so tabs 6 and 7 do not have
 * a sector of their own.
 */
function resolveSectorIndexesForTab(sectorCount: number, stashTab?: number): number[] {
  const indexes: number[] = [];
  const first = stashTab === undefined ? 0 : Math.min(stashTab, SHARED_TAB_COUNT);
  const last = stashTab === undefined || stashTab < SHARED_TAB_COUNT ? first + 1 : sectorCount;
  const limit =
    stashTab === undefined ? Math.min(SHARED_TAB_COUNT, sectorCount) : Math.min(last, sectorCount);
  for (let index = first; index < limit; index += 1) {
    indexes.push(index);
  }
  return indexes;
}

/** A resource tab only owns the items of its kind; its sector is shared with the other kinds. */
function itemBelongsToStashTab(item: d2sTypes.IItem, stashTab: number | undefined): boolean {
  if (stashTab === undefined || stashTab < SHARED_TAB_COUNT) {
    return true;
  }

  const code = normalizeItemCodeKey(resolveItemCode(item));
  return code !== undefined && isResourceCodeAllowedForTab(code, stashTab);
}

/**
 * Finds an item in the shared stash sectors (JM sectors 0–SHARED_TAB_COUNT-1)
 * of a modern .d2i file. Matches by numeric id when present (non-simple items),
 * or by grid position (simple items like gems/runes that have no stored id).
 * Returns undefined if not found.
 */
export async function findItemInModernStashSharedPage(
  filePath: string,
  itemId: number | undefined,
  stashTab?: number,
  gridX?: number,
  gridY?: number,
  itemCode?: string,
): Promise<d2sTypes.IItem | undefined> {
  const buffer = await readFile(filePath);
  const metadata = readD2iMetadata(buffer);

  const jmSectors = metadata.sectors
    .map((sector, index) => ({ sectorIndex: index, ...sector }))
    .filter((s) => s.payloadSignature === 'JM')
    .sort((a, b) => a.sectorIndex - b.sectorIndex);

  const config = { extendedStash: false, sortProperties: true };
  const constants = constants105Extended as unknown as d2sTypes.IConstantData;

  for (const jmIdx of resolveSectorIndexesForTab(jmSectors.length, stashTab)) {
    const targetSector = jmSectors[jmIdx];
    const payload = Buffer.from(
      buffer.subarray(
        targetSector.payloadOffset,
        targetSector.payloadOffset + targetSector.payloadSize,
      ),
    );

    if (payload.length < JM_ITEM_DATA_OFFSET || payload.toString('ascii', 0, 2) !== 'JM') {
      continue;
    }

    const count = payload.readUInt16LE(JM_ITEM_COUNT_OFFSET);
    const reader = createBoundedBitReader(payload, 'findItemInModernStashSharedPage');
    reader.ReadString(2); // skip "JM"
    reader.ReadUInt16(); // skip count

    for (let i = 0; i < count; i++) {
      let item: d2sTypes.IItem;
      try {
        item = await readItem(reader, metadata.version, constants, config);
      } catch {
        // Cannot parse this item — stop searching this sector (reader offset unknown)
        break;
      }
      if (
        itemMatchesLocator(
          item,
          itemId,
          gridX,
          gridY,
          itemCode,
          stashTab !== undefined && stashTab >= SHARED_TAB_COUNT,
        ) &&
        itemBelongsToStashTab(item, stashTab)
      ) {
        return item;
      }
    }
  }

  return undefined;
}

/**
 * Removes an item from the shared stash sectors (JM sectors 0–SHARED_TAB_COUNT-1)
 * of a modern .d2i file. Matches by numeric id (non-simple items) or by grid
 * position (simple items like gems/runes that have no stored id).
 *
 * Uses binary splice: items are parsed one-by-one and parsing stops as soon as
 * the target is matched. Items after the target are kept as raw bytes without
 * further parsing — this prevents failures for items with unsupported attributes.
 *
 * Throws if the item is not found in any shared tab.
 */
export async function removeItemFromModernStashSharedPage(
  filePath: string,
  itemId: number | undefined,
  stashTab?: number,
  gridX?: number,
  gridY?: number,
  itemCode?: string,
): Promise<void> {
  const buffer = await readFile(filePath);
  const nextBuffer = await removeItemFromModernStashBuffer(
    buffer,
    itemId,
    stashTab,
    gridX,
    gridY,
    itemCode,
  );
  await writeSaveFile(filePath, nextBuffer);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Handles multi-sector search, per-item parsing with early exit, binary splice, and graceful fallback — each branch is necessary.
export async function removeItemFromModernStashBuffer(
  buffer: Buffer,
  itemId: number | undefined,
  stashTab?: number,
  gridX?: number,
  gridY?: number,
  itemCode?: string,
): Promise<Buffer> {
  const metadata = readD2iMetadata(buffer);

  const jmSectors = metadata.sectors
    .map((sector, index) => ({ sectorIndex: index, ...sector }))
    .filter((s) => s.payloadSignature === 'JM')
    .sort((a, b) => a.sectorIndex - b.sectorIndex);

  const config = { extendedStash: false, sortProperties: true };
  const constants = constants105Extended as unknown as d2sTypes.IConstantData;

  for (const jmIdx of resolveSectorIndexesForTab(jmSectors.length, stashTab)) {
    const targetSector = jmSectors[jmIdx];
    const payload = Buffer.from(
      buffer.subarray(
        targetSector.payloadOffset,
        targetSector.payloadOffset + targetSector.payloadSize,
      ),
    );

    if (payload.length < JM_ITEM_DATA_OFFSET || payload.toString('ascii', 0, 2) !== 'JM') {
      continue;
    }

    const count = payload.readUInt16LE(JM_ITEM_COUNT_OFFSET);
    const reader = createBoundedBitReader(payload, 'removeItemFromModernStashSharedPage');
    reader.ReadString(2); // skip "JM"
    reader.ReadUInt16(); // skip count

    let matchStartByte: number | undefined;
    let matchEndByte: number | undefined;

    // Parse items one-by-one and stop as soon as the target is found.
    // Items after the match are NOT parsed — their raw bytes are spliced verbatim.
    // This prevents "Save Bits is undefined" failures for items with unsupported
    // magic attributes that happen to sit after the target in the same sector.
    for (let i = 0; i < count; i++) {
      const startBit = reader.offset;
      let item: d2sTypes.IItem;
      try {
        item = await readItem(reader, metadata.version, constants, config);
      } catch {
        // Cannot parse this item — if we haven't found the target yet, abort
        break;
      }
      const endBit = reader.offset;

      if (
        itemMatchesLocator(
          item,
          itemId,
          gridX,
          gridY,
          itemCode,
          stashTab !== undefined && stashTab >= SHARED_TAB_COUNT,
        ) &&
        itemBelongsToStashTab(item, stashTab)
      ) {
        matchStartByte = startBit / 8;
        matchEndByte = endBit / 8;
        break; // Stop here — do not parse any further items
      }
    }

    if (matchStartByte === undefined || matchEndByte === undefined) {
      continue; // Not found in this sector — try next
    }

    const beforeBytes = payload.subarray(JM_ITEM_DATA_OFFSET, matchStartByte);
    // afterBytes covers all remaining raw item bytes from the item after the match
    const afterBytes = payload.subarray(matchEndByte);

    const newHeader = Buffer.alloc(JM_ITEM_DATA_OFFSET);
    newHeader.write('JM', 0, 'ascii');
    newHeader.writeUInt16LE(count - 1, JM_ITEM_COUNT_OFFSET);
    const newPayload = Buffer.concat([newHeader, beforeBytes, afterBytes]);

    return rebuildD2iBuffer(buffer, metadata.sectors, targetSector.offset, newPayload);
  }

  throw new Error('Item not found in any modern stash shared tab');
}

/**
 * Items parsed straight from a sector carry no grid dimensions. Enhancing them with the item data
 * adds `inv_width` / `inv_height`; without it every item counts as a single cell.
 */
async function enhanceForGridSpan(items: d2sTypes.IItem[]): Promise<void> {
  try {
    await d2s.enhanceItems(items, constants105Extended as unknown as d2sTypes.IConstantData, 1, {
      sortProperties: true,
    } as never);
  } catch {
    // Dimensions stay unknown (single cell) for items with unsupported or modded data.
  }
}

interface GridCell {
  x: number;
  y: number;
}

async function assertSharedTabCellsFree(
  parsedExistingItems: d2sTypes.IItem[],
  newItem: d2sTypes.IItem,
): Promise<void> {
  if (parsedExistingItems.length === 0) {
    return;
  }

  await enhanceForGridSpan(parsedExistingItems);
  // Measure a deep copy: enhancing mutates the item and it is serialized afterwards.
  const measuredItem = JSON.parse(JSON.stringify(newItem)) as d2sTypes.IItem;
  await enhanceForGridSpan([measuredItem]);
  assertTargetCellsFree(parsedExistingItems, { ...newItem, ...pickGridSpan(measuredItem) });
}

function pickGridSpan(item: d2sTypes.IItem): Partial<d2sTypes.IItem> {
  const { inv_width, inv_height } = item as { inv_width?: unknown; inv_height?: unknown };
  return { inv_width, inv_height } as Partial<d2sTypes.IItem>;
}

/**
 * Appends one item to a shared stash sector (tabs 0–4) inside a modern .d2i file.
 * The sector payload is a standard JM item list. We binary-splice: reuse existing
 * item bytes unchanged and only serialize the new item, then patch the count field
 * and sector size and rebuild the file buffer.
 */
export async function addItemToModernStashSharedPageBuffer(
  buffer: Buffer,
  item: d2sTypes.IItem,
  stashTab: number,
  gridX: number,
  gridY: number,
  stackCount = 1,
  ignoredCell?: GridCell,
): Promise<Buffer> {
  const metadata = readD2iMetadata(buffer);

  const jmSectors = metadata.sectors
    .map((sector, index) => ({ sectorIndex: index, ...sector }))
    .filter((s) => s.payloadSignature === 'JM')
    .sort((a, b) => a.sectorIndex - b.sectorIndex);

  if (Math.min(stashTab, SHARED_TAB_COUNT) >= jmSectors.length) {
    throw new Error(
      `Stash tab ${stashTab} not found in modern stash (${jmSectors.length} JM sectors)`,
    );
  }

  // Tabs 5-7 (gems/materials/runes) share the first sector after the shared tabs.
  const targetSector = jmSectors[Math.min(stashTab, SHARED_TAB_COUNT)];
  const payload = Buffer.from(
    buffer.subarray(
      targetSector.payloadOffset,
      targetSector.payloadOffset + targetSector.payloadSize,
    ),
  );

  if (payload.length < JM_ITEM_DATA_OFFSET || payload.toString('ascii', 0, 2) !== 'JM') {
    throw new Error(`Invalid JM sector payload for stash tab ${stashTab}`);
  }

  const existingCount = payload.readUInt16LE(JM_ITEM_COUNT_OFFSET);

  // Strip the resource-stash quantity attribute and set correct stash location fields.
  // We only serialize the NEW item — existing items are kept as raw bytes, avoiding
  // the need to parse them (which would fail for items with stats that lack sB).
  const normalizedItem = stripResourceStashStackMetadata(item);
  const isSimpleItem = (normalizedItem as { simple_item?: unknown }).simple_item === 1;
  const normalizedStackCount = Number.isInteger(stackCount) && stackCount > 0 ? stackCount : 1;
  const newItem: d2sTypes.IItem = {
    ...normalizedItem,
    location_id: 0,
    alt_position_id: 5,
    equipped_id: 0,
    position_x: gridX,
    position_y: gridY,
    quantity: normalizedStackCount,
    // Keep ids for non-simple items so they remain movable after repeated shared-tab moves.
    // Simple resource-derived items are intentionally id-less.
    id: isSimpleItem ? undefined : normalizedItem.id,
  };

  const config = { extendedStash: false, sortProperties: true };
  const constants = constants105Extended as unknown as d2sTypes.IConstantData;
  const newItemBytes = Buffer.from(await writeItem(newItem, metadata.version, constants, config));

  // Some modern sectors may contain trailing bytes after the counted item stream.
  // If we can parse all existing items, insert new item bytes before that trailing tail.
  // Otherwise, fall back to appending at the payload end (legacy behavior).
  let existingItemBytes = payload.subarray(JM_ITEM_DATA_OFFSET);
  let trailingBytes = Buffer.alloc(0);
  const parsedExistingItems: d2sTypes.IItem[] = [];
  try {
    const reader = createBoundedBitReader(payload, 'addItemToModernStashSharedPageBuffer');
    reader.ReadString(2); // skip "JM"
    reader.ReadUInt16(); // skip count

    for (let i = 0; i < existingCount; i += 1) {
      parsedExistingItems.push(await readItem(reader, metadata.version, constants, config));
    }

    const itemDataEndByte = reader.offset / 8;
    existingItemBytes = payload.subarray(JM_ITEM_DATA_OFFSET, itemDataEndByte);
    trailingBytes = payload.subarray(itemDataEndByte);
  } catch {
    // Keep fallback (append at end) if we cannot safely parse all existing items.
    parsedExistingItems.length = 0;
  }

  // Resource tabs lay their stacks out themselves, so only shared tabs have a grid to collide on.
  if (stashTab < SHARED_TAB_COUNT) {
    await assertSharedTabCellsFree(
      ignoredCell
        ? parsedExistingItems.filter(
            (existing) =>
              existing.position_x !== ignoredCell.x || existing.position_y !== ignoredCell.y,
          )
        : parsedExistingItems,
      newItem,
    );
  }

  // Binary splice: reuse the raw existing-item bytes and prepend the serialized new item.
  // Prepending makes newly placed items visible even when parsing later existing items fails
  // (for example, unsupported/modded attrs in shared tabs).
  // If trailing bytes are present, keep them after the item stream.
  const newHeader = Buffer.alloc(JM_ITEM_DATA_OFFSET);
  newHeader.write('JM', 0, 'ascii');
  newHeader.writeUInt16LE(existingCount + 1, JM_ITEM_COUNT_OFFSET);
  const newPayload = Buffer.concat([newHeader, newItemBytes, existingItemBytes, trailingBytes]);

  return rebuildD2iBuffer(buffer, metadata.sectors, targetSector.offset, newPayload);
}

export async function addItemToModernStashSharedPage(
  filePath: string,
  item: d2sTypes.IItem,
  stashTab: number,
  gridX: number,
  gridY: number,
  ignoredCell?: GridCell,
): Promise<void> {
  const buffer = await readFile(filePath);
  const nextBuffer = await addItemToModernStashSharedPageBuffer(
    buffer,
    item,
    stashTab,
    gridX,
    gridY,
    shouldKeepQuantity(item),
    ignoredCell,
  );
  await writeSaveFile(filePath, nextBuffer);
}
