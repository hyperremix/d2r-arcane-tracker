import { readFile } from 'node:fs/promises';
import type { types as d2sTypes } from '@dschu012/d2s';
import { readItem, writeItem } from '@dschu012/d2s/lib/d2/items';
import { normalizeItemCodeKey, resolveStackCount, SHARED_TAB_COUNT } from '../../utils/d2rFormat';
import { createBoundedBitReader } from '../boundedBitReader';
import { constants105Extended } from '../modernStashParser';
import {
  JM_ITEM_COUNT_OFFSET,
  JM_ITEM_DATA_OFFSET,
  type ModernResourceSector,
  rebuildD2iBuffer,
  resolveModernJmSectors,
} from './d2iSectors';
import { resolveItemCode } from './itemFields';
import { addItemToModernStashSharedPageBuffer } from './modernStashSharedTabs';
import {
  isModernResourceTab,
  isResourceCodeAllowedForTab,
  withUpdatedResourceStackCount,
} from './resourceStacks';
import { writeSaveFile } from './saveFileWrites';

/**
 * Reads and changes the stacks in the resource tabs (gems, materials, runes) of a modern .d2i
 * stash; only the changed stack is re-serialized.
 */

interface ResourceSectorItemEntry {
  sector: ModernResourceSector;
  count: number;
  startByte: number;
  endByte: number;
  item: d2sTypes.IItem;
}

export interface ResourceStackMatchHint {
  positionX?: number;
  positionY?: number;
  stackCount?: number;
}

export async function readResourceSectorEntries(
  buffer: Buffer,
  jmSectors: ModernResourceSector[],
  version: number,
): Promise<ResourceSectorItemEntry[]> {
  const config = { extendedStash: false, sortProperties: true };
  const constants = constants105Extended as unknown as d2sTypes.IConstantData;
  const entries: ResourceSectorItemEntry[] = [];

  // Resource sectors live at JM indices >= SHARED_TAB_COUNT.
  for (let jmIdx = SHARED_TAB_COUNT; jmIdx < jmSectors.length; jmIdx++) {
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

    // Read items one at a time, tracking byte boundaries via reader.offset.
    const reader = createBoundedBitReader(payload, 'readResourceSectorEntries');
    reader.ReadString(2); // skip "JM"
    reader.ReadUInt16(); // skip count

    for (let i = 0; i < count; i++) {
      const startBit = reader.offset;
      const item = await readItem(reader, version, constants, config);
      const endBit = reader.offset;
      entries.push({
        sector: targetSector,
        count,
        startByte: startBit / 8,
        endByte: endBit / 8,
        item,
      });
    }
  }

  return entries;
}

export function selectResourceStackEntry(
  entries: ResourceSectorItemEntry[],
  itemCode: string,
  hint?: ResourceStackMatchHint,
): ResourceSectorItemEntry | undefined {
  const normalizedCode = normalizeItemCodeKey(itemCode);
  if (!normalizedCode) {
    return undefined;
  }

  const matchingEntries = entries.filter((entry) => {
    const code = normalizeItemCodeKey(
      (entry.item as { code?: unknown; type?: unknown }).code ??
        (entry.item as { type?: unknown }).type,
    );
    return code === normalizedCode;
  });

  if (matchingEntries.length === 0) {
    return undefined;
  }

  let bestEntry = matchingEntries[0];
  let bestScore = -1;

  for (const entry of matchingEntries) {
    let score = 0;

    if (
      hint?.positionX !== undefined &&
      hint.positionY !== undefined &&
      entry.item.position_x === hint.positionX &&
      entry.item.position_y === hint.positionY
    ) {
      score += 2;
    }

    if (hint?.stackCount !== undefined && resolveStackCount(entry.item) === hint.stackCount) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  return bestEntry;
}

export async function reduceResourceStackEntryInModernStashBuffer(
  buffer: Buffer,
  entry: ResourceSectorItemEntry,
  reduceBy: number,
): Promise<Buffer> {
  const { metadata } = resolveModernJmSectors(buffer);
  const payload = Buffer.from(
    buffer.subarray(
      entry.sector.payloadOffset,
      entry.sector.payloadOffset + entry.sector.payloadSize,
    ),
  );
  const currentCount = resolveStackCount(entry.item);
  const newCount = currentCount - reduceBy;

  // Build new item bytes — binary splice: only the matching item is re-serialized.
  const beforeBytes = payload.subarray(JM_ITEM_DATA_OFFSET, entry.startByte);
  const afterBytes = payload.subarray(entry.endByte);

  let newPayload: Buffer;
  if (newCount <= 0) {
    // Remove the item entirely.
    const newHeader = Buffer.alloc(JM_ITEM_DATA_OFFSET);
    newHeader.write('JM', 0, 'ascii');
    newHeader.writeUInt16LE(entry.count - 1, JM_ITEM_COUNT_OFFSET);
    newPayload = Buffer.concat([newHeader, beforeBytes, afterBytes]);
  } else {
    // Re-serialize only the matching item with reduced quantity.
    const updatedItem = withUpdatedResourceStackCount(entry.item, newCount);
    const config = { extendedStash: false, sortProperties: true };
    const constants = constants105Extended as unknown as d2sTypes.IConstantData;
    const updatedItemBytes = Buffer.from(
      await writeItem(updatedItem as d2sTypes.IItem, metadata.version, constants, config),
    );
    const newHeader = Buffer.alloc(JM_ITEM_DATA_OFFSET);
    newHeader.write('JM', 0, 'ascii');
    newHeader.writeUInt16LE(entry.count, JM_ITEM_COUNT_OFFSET);
    newPayload = Buffer.concat([newHeader, beforeBytes, updatedItemBytes, afterBytes]);
  }

  return rebuildD2iBuffer(buffer, metadata.sectors, entry.sector.offset, newPayload);
}

async function increaseResourceStackEntryInModernStashBuffer(
  buffer: Buffer,
  entry: ResourceSectorItemEntry,
  increaseBy: number,
): Promise<Buffer> {
  if (increaseBy <= 0) {
    return buffer;
  }

  const { metadata } = resolveModernJmSectors(buffer);
  const payload = Buffer.from(
    buffer.subarray(
      entry.sector.payloadOffset,
      entry.sector.payloadOffset + entry.sector.payloadSize,
    ),
  );
  const currentCount = resolveStackCount(entry.item);
  const newCount = currentCount + increaseBy;
  const beforeBytes = payload.subarray(JM_ITEM_DATA_OFFSET, entry.startByte);
  const afterBytes = payload.subarray(entry.endByte);
  const updatedItem = withUpdatedResourceStackCount(entry.item, newCount);
  const config = { extendedStash: false, sortProperties: true };
  const constants = constants105Extended as unknown as d2sTypes.IConstantData;
  const updatedItemBytes = Buffer.from(
    await writeItem(updatedItem as d2sTypes.IItem, metadata.version, constants, config),
  );
  const newHeader = Buffer.alloc(JM_ITEM_DATA_OFFSET);
  newHeader.write('JM', 0, 'ascii');
  newHeader.writeUInt16LE(entry.count, JM_ITEM_COUNT_OFFSET);
  const newPayload = Buffer.concat([newHeader, beforeBytes, updatedItemBytes, afterBytes]);

  return rebuildD2iBuffer(buffer, metadata.sectors, entry.sector.offset, newPayload);
}

export async function addItemToModernStashResourceSectorBuffer(
  buffer: Buffer,
  item: d2sTypes.IItem,
  stashTab: number,
  gridX: number,
  gridY: number,
): Promise<Buffer> {
  if (!isModernResourceTab(stashTab)) {
    throw new Error('MODERN_STASH_READ_ONLY');
  }

  const itemCode = normalizeItemCodeKey(resolveItemCode(item));
  if (!itemCode) {
    throw new Error('Source item code is required for modern resource tab moves');
  }
  if (!isResourceCodeAllowedForTab(itemCode, stashTab)) {
    throw new Error(`Item code '${itemCode}' cannot be moved to modern stash tab ${stashTab}`);
  }

  const countToAdd = Math.max(
    1,
    resolveStackCount(item as unknown as Parameters<typeof resolveStackCount>[0]),
  );
  const { metadata, jmSectors } = resolveModernJmSectors(buffer);
  const entries = await readResourceSectorEntries(buffer, jmSectors, metadata.version);
  const existingEntry = selectResourceStackEntry(entries, itemCode);
  if (existingEntry) {
    return increaseResourceStackEntryInModernStashBuffer(buffer, existingEntry, countToAdd);
  }

  return addItemToModernStashSharedPageBuffer(buffer, item, stashTab, gridX, gridY, countToAdd);
}

export async function addItemToModernStashResourceSector(
  filePath: string,
  item: d2sTypes.IItem,
  stashTab: number,
  gridX: number,
  gridY: number,
): Promise<void> {
  const buffer = await readFile(filePath);
  const nextBuffer = await addItemToModernStashResourceSectorBuffer(
    buffer,
    item,
    stashTab,
    gridX,
    gridY,
  );
  await writeSaveFile(filePath, nextBuffer);
}

/**
 * Reduces the quantity of a stackable item in a modern stash resource sector (runes/gems/materials).
 * Removes the item entirely if its quantity reaches zero.
 *
 * Searches ALL resource sectors (JM sectors at index >= SHARED_TAB_COUNT) for the best matching
 * source entry by item code and optional source hints. Uses binary splice: only the modified item
 * is re-serialized; all other items keep their original raw bytes, avoiding round-trip data loss.
 */
export async function reduceItemInModernStashResourceSector(
  filePath: string,
  itemCode: string,
  reduceBy: number,
  sourceHint?: ResourceStackMatchHint,
): Promise<void> {
  const buffer = await readFile(filePath);
  const { metadata, jmSectors } = resolveModernJmSectors(buffer);
  const entries = await readResourceSectorEntries(buffer, jmSectors, metadata.version);
  const entry = selectResourceStackEntry(entries, itemCode, sourceHint);
  if (!entry) {
    throw new Error(`Stack item '${itemCode}' not found in modern resource sectors`);
  }

  const nextBuffer = await reduceResourceStackEntryInModernStashBuffer(buffer, entry, reduceBy);
  await writeSaveFile(filePath, nextBuffer);
}
