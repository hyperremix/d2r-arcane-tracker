import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import { readItem, writeItem } from '@dschu012/d2s/lib/d2/items';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type { CharacterClass, VaultLocationContext, VaultSourceFileType } from '../../types/grail';
import { writeFileAtomic } from '../../utils/atomicWrite';
import {
  isModernStashVersion,
  isResourceCodeOfKind,
  isResourceItemCode,
  normalizeItemCodeKey,
  RESOURCE_STASH_STACK_ATTR_ID,
  type ResourceStashTabKind,
  resolveResourceStashTabKind,
  resolveStackCount,
  SHARED_TAB_COUNT,
} from '../../utils/d2rFormat';
import { createBoundedBitReader } from '../boundedBitReader';
import { ensureD2sConstants } from '../d2s/constants';
import { constants105Extended } from '../modernStashParser';
import { backupSaveFile } from '../saveFileBackup';
import { D2I_SECTOR_HEADER_SIZE, readD2iMetadata } from '../stashFormat';
import { assertEquipValidationRules, resolveTargetCharacterClass } from './equipValidation';
import { normalizeItemId, resolveItemCode } from './itemFields';

interface StashConstants {
  constants: d2sTypes.IConstantData;
  version: number;
}

export interface MoveSaveFileItemOptions {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceItemId: number | undefined;
  sourceStashTab?: number;
  sourceGridXFromItem?: number;
  sourceGridYFromItem?: number;
  /** Code of the item to move; guards against matching a different item at the same position. */
  sourceItemCode?: string;
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX?: number;
  targetGridY?: number;
  targetEquippedSlotId?: number;
}

export interface SaveFileItemLocator {
  itemId?: number;
  /** Item code; position-only locators (simple items) are ambiguous without it. */
  itemCode?: string;
  stashTab?: number;
  gridX?: number;
  gridY?: number;
}

function getStashConstants(ext: string): StashConstants {
  if (ext === '.d2i') {
    return { constants: constants99, version: 99 };
  }

  return { constants: constants96, version: 96 };
}

function assertWritableD2iBuffer(ext: string, buffer: Buffer): void {
  if (ext !== '.d2i') {
    return;
  }

  const metadata = readD2iMetadata(buffer);
  if (isModernStashVersion(metadata.version)) {
    throw new Error('MODERN_STASH_READ_ONLY');
  }
}

async function assertWritableStashMutationTarget(
  filePath: string,
  fileType: VaultSourceFileType,
): Promise<void> {
  if (fileType !== 'd2i') {
    return;
  }

  const buffer = await readFile(filePath);
  assertWritableD2iBuffer(extname(filePath), buffer);
}

function normalizeOptionalNonNegativeInteger(
  value: unknown,
  fieldName: 'stashTab' | 'gridX' | 'gridY',
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  throw new Error(`${fieldName} must be a non-negative integer`);
}

function normalizeSaveFileItemLocator(
  itemLocator: number | SaveFileItemLocator,
): SaveFileItemLocator {
  if (typeof itemLocator === 'number') {
    if (!Number.isInteger(itemLocator)) {
      throw new Error('itemId must be an integer');
    }

    return { itemId: itemLocator };
  }

  if (!itemLocator || typeof itemLocator !== 'object') {
    throw new Error('itemLocator must be a number or an object');
  }

  const itemId = normalizeItemId(itemLocator.itemId);
  const stashTab = normalizeOptionalNonNegativeInteger(itemLocator.stashTab, 'stashTab');
  const gridX = normalizeOptionalNonNegativeInteger(itemLocator.gridX, 'gridX');
  const gridY = normalizeOptionalNonNegativeInteger(itemLocator.gridY, 'gridY');
  const hasGridCoordinates = gridX !== undefined && gridY !== undefined;

  if (itemId === undefined && !hasGridCoordinates) {
    throw new Error('itemLocator must include itemId or both gridX and gridY');
  }

  return { itemId, itemCode: normalizeItemCodeKey(itemLocator.itemCode), stashTab, gridX, gridY };
}

function itemMatchesId(item: d2sTypes.IItem, itemId: number): boolean {
  return normalizeItemId((item as { id?: unknown }).id) === itemId;
}

function findItemById(items: d2sTypes.IItem[], itemId: number): d2sTypes.IItem | undefined {
  return items.find((item) => itemMatchesId(item, itemId));
}

function extractItemById(items: d2sTypes.IItem[], itemId: number): d2sTypes.IItem | undefined {
  const index = items.findIndex((item) => itemMatchesId(item, itemId));
  if (index < 0) {
    return undefined;
  }

  const [removed] = items.splice(index, 1);
  return removed;
}

function withTargetCoordinates(
  item: d2sTypes.IItem,
  targetGridX?: number,
  targetGridY?: number,
): d2sTypes.IItem {
  if (targetGridX === undefined || targetGridY === undefined) {
    return item;
  }

  return {
    ...item,
    position_x: targetGridX,
    position_y: targetGridY,
  };
}

function withD2SLocationContext(
  item: d2sTypes.IItem,
  locationContext: VaultLocationContext,
  equippedItems: d2sTypes.IItem[],
  targetCharacterClass: CharacterClass | undefined,
  targetEquippedSlotId?: number,
): d2sTypes.IItem {
  switch (locationContext) {
    case 'inventory':
      return {
        ...item,
        location_id: 0,
        alt_position_id: 1,
        equipped_id: 0,
      };
    case 'stash':
      return {
        ...item,
        location_id: 0,
        alt_position_id: 5,
        equipped_id: 0,
      };
    case 'equipped':
      if (targetEquippedSlotId !== undefined) {
        assertEquipValidationRules(item, targetEquippedSlotId, equippedItems, targetCharacterClass);
      }

      return {
        ...item,
        location_id: 1,
        alt_position_id: 0,
        equipped_id: targetEquippedSlotId ?? item.equipped_id ?? 0,
        position_x: 0,
        position_y: 0,
      };
    case 'mercenary':
      return {
        ...item,
        location_id: 3,
        alt_position_id: 0,
        equipped_id: 0,
      };
    case 'corpse':
      return {
        ...item,
        location_id: 3,
        alt_position_id: 0,
        equipped_id: 0,
      };
    default:
      return item;
  }
}

/** Backs up the existing save file, then atomically replaces it. */
async function writeSaveFile(filePath: string, data: Buffer): Promise<void> {
  await backupSaveFile(filePath);
  await writeFileAtomic(filePath, data);
}

const OCCUPIED_CELL_ERROR = 'TARGET_CELL_OCCUPIED';

function resolveGridSpan(item: d2sTypes.IItem): { width: number; height: number } {
  const width = (item as { inv_width?: unknown }).inv_width;
  const height = (item as { inv_height?: unknown }).inv_height;
  return {
    width: typeof width === 'number' && width > 0 ? width : 1,
    height: typeof height === 'number' && height > 0 ? height : 1,
  };
}

/**
 * Throws when `candidate` would overlap any item of `containerItems` (the items already stored in
 * the target grid). Dimensions are used when known (`inv_width`/`inv_height`, present on items
 * parsed with their item data); items without dimensions count as a single cell. The UI performs
 * the full check as well, this is the last line of defence against writing overlapping items.
 */
function assertTargetCellsFree(containerItems: d2sTypes.IItem[], candidate: d2sTypes.IItem): void {
  if (candidate.position_x === undefined || candidate.position_y === undefined) {
    return;
  }

  const candidateSpan = resolveGridSpan(candidate);
  const overlaps = containerItems.some((existing) => {
    if (existing.position_x === undefined || existing.position_y === undefined) {
      return false;
    }

    const existingSpan = resolveGridSpan(existing);
    return (
      candidate.position_x < existing.position_x + existingSpan.width &&
      existing.position_x < candidate.position_x + candidateSpan.width &&
      candidate.position_y < existing.position_y + existingSpan.height &&
      existing.position_y < candidate.position_y + candidateSpan.height
    );
  });

  if (overlaps) {
    throw new Error(OCCUPIED_CELL_ERROR);
  }
}

/** Overlap check against the character grid (inventory / stash / cube) the candidate is stored in. */
function assertCharacterGridCellsFree(allItems: d2sTypes.IItem[], candidate: d2sTypes.IItem): void {
  if (candidate.location_id !== 0) {
    return;
  }

  assertTargetCellsFree(
    allItems.filter(
      (existing) =>
        existing.location_id === 0 && existing.alt_position_id === candidate.alt_position_id,
    ),
    candidate,
  );
}

function normalizeFilePathForComparison(filePath: string): string {
  const resolved = resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/**
 * True when both paths point at the same file. Paths that differ only by case, separators or
 * relative segments must be treated as the same file: otherwise a "cross-file" move would add the
 * item to the file and then remove it from that same file again, losing it.
 */
function isSameSaveFile(
  pathA: string,
  typeA: VaultSourceFileType,
  pathB: string,
  typeB: VaultSourceFileType,
): boolean {
  return (
    typeA === typeB &&
    normalizeFilePathForComparison(pathA) === normalizeFilePathForComparison(pathB)
  );
}

function countD2sItems(data: d2sTypes.ID2S): number {
  return (
    (data.items?.length ?? 0) + (data.corpse_items?.length ?? 0) + (data.merc_items?.length ?? 0)
  );
}

/**
 * Serializes a character save, re-parses the result and only then replaces the file. Refuses to
 * write when the re-parsed save has a different number of items than the in-memory data, because
 * that means the serializer would silently drop (or invent) items.
 */
async function writeD2sSaveFile(filePath: string, data: d2sTypes.ID2S): Promise<void> {
  const expectedItemCount = countD2sItems(data);
  const bytes = Buffer.from(await d2s.write(data));
  const reparsed = await d2s.read(bytes);
  const actualItemCount = countD2sItems(reparsed);

  if (actualItemCount !== expectedItemCount) {
    throw new Error(
      `Refusing to write save file: expected ${expectedItemCount} items but serialized data contains ${actualItemCount}`,
    );
  }

  await writeSaveFile(filePath, bytes);
}

function countStashItems(data: d2sTypes.IStash): number {
  return data.pages.reduce((total, page) => total + page.items.length, 0);
}

/** Classic stash counterpart of {@link writeD2sSaveFile}. */
async function writeClassicStashFile(
  filePath: string,
  data: d2sTypes.IStash,
  stashConstants: StashConstants,
): Promise<void> {
  const expectedItemCount = countStashItems(data);
  const bytes = Buffer.from(
    await d2stash.write(data, stashConstants.constants, stashConstants.version),
  );
  const reparsed = await d2stash.read(bytes, stashConstants.constants);
  const actualItemCount = countStashItems(reparsed);

  if (actualItemCount !== expectedItemCount) {
    throw new Error(
      `Refusing to write stash file: expected ${expectedItemCount} items but serialized data contains ${actualItemCount}`,
    );
  }

  await writeSaveFile(filePath, bytes);
}

async function findItemInSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
  itemId: number,
): Promise<d2sTypes.IItem | undefined> {
  const buffer = await readFile(filePath);

  if (fileType === 'd2s') {
    const data = await d2s.read(buffer);
    return (
      findItemById(data.items, itemId) ??
      findItemById(data.corpse_items, itemId) ??
      findItemById(data.merc_items, itemId)
    );
  }

  const ext = extname(filePath);

  if (ext === '.d2i') {
    const metadata = readD2iMetadata(buffer);
    if (isModernStashVersion(metadata.version)) {
      return findItemInModernStashSharedPage(filePath, itemId);
    }
  }

  const { constants } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);

  for (const page of data.pages) {
    const found = findItemById(page.items, itemId);
    if (found) {
      return found;
    }
  }

  return undefined;
}

/**
 * Reads the item identified by `itemLocator` straight from the save file on disk. Used to verify
 * that what the UI believes is in the file (a scan snapshot may be stale) still matches before
 * anything is removed from it.
 */
export async function readSaveFileItem(
  filePath: string,
  fileType: VaultSourceFileType,
  itemLocator: number | SaveFileItemLocator,
): Promise<d2sTypes.IItem | undefined> {
  ensureD2sConstants();
  const { itemId, itemCode, stashTab, gridX, gridY } = normalizeSaveFileItemLocator(itemLocator);

  if (fileType === 'd2i' && extname(filePath) === '.d2i') {
    const metadata = readD2iMetadata(await readFile(filePath));
    if (isModernStashVersion(metadata.version)) {
      return findItemInModernStashSharedPage(filePath, itemId, stashTab, gridX, gridY, itemCode);
    }
  }

  if (itemId === undefined) {
    return undefined;
  }

  return findItemInSaveFile(filePath, fileType, itemId);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Handles d2s, classic stash, and modern d2i move paths in a single coordinated function. Splitting further would require passing complex partial state between helpers.
async function moveItemWithinSingleSaveFile(options: MoveSaveFileItemOptions): Promise<void> {
  const { sourceFilePath, sourceFileType, sourceItemId } = options;
  const buffer = await readFile(sourceFilePath);

  if (sourceFileType === 'd2s') {
    // Non-d2i paths always receive a numeric item id (non-simple items only).
    const numericItemId = sourceItemId as number;
    const data = await d2s.read(buffer);
    const sourceItem =
      extractItemById(data.items, numericItemId) ??
      extractItemById(data.corpse_items, numericItemId) ??
      extractItemById(data.merc_items, numericItemId);

    if (!sourceItem) {
      throw new Error('Source item not found in save file');
    }

    const itemToWrite = withD2SLocationContext(
      withTargetCoordinates(sourceItem, options.targetGridX, options.targetGridY),
      options.targetLocationContext,
      data.items,
      resolveTargetCharacterClass(data),
      options.targetEquippedSlotId,
    );

    if (options.targetLocationContext === 'mercenary') {
      data.merc_items.push(itemToWrite);
    } else if (options.targetLocationContext === 'corpse') {
      data.corpse_items.push(itemToWrite);
    } else {
      assertCharacterGridCellsFree(data.items, itemToWrite);
      data.items.push(itemToWrite);
    }

    await writeD2sSaveFile(sourceFilePath, data);
    return;
  }

  const ext = extname(sourceFilePath);

  if (ext === '.d2i') {
    const metadata = readD2iMetadata(buffer);
    if (isModernStashVersion(metadata.version)) {
      const targetTab = options.targetStashTab ?? 0;
      const sourceItem = await findItemInModernStashSharedPage(
        sourceFilePath,
        sourceItemId,
        options.sourceStashTab,
        options.sourceGridXFromItem,
        options.sourceGridYFromItem,
        normalizeItemCodeKey(options.sourceItemCode),
      );
      if (!sourceItem) {
        throw new Error('Source item not found in stash file');
      }

      // Dropping an item back onto the cell it already occupies changes nothing.
      if (
        options.sourceStashTab === targetTab &&
        options.sourceGridXFromItem === (options.targetGridX ?? 0) &&
        options.sourceGridYFromItem === (options.targetGridY ?? 0)
      ) {
        return;
      }

      // A resource stack already lives in its resource tab: "moving" it there would first merge
      // the stack into itself and then delete the source entry, destroying the whole stack.
      if (isModernResourceTab(targetTab) && options.sourceStashTab === targetTab) {
        return;
      }
      assertStackMoveIsLossless(sourceItem, isModernResourceTab(targetTab));

      // Add and removal are applied to one in-memory buffer and written once: a failure in
      // between must not leave the file with both the original and the copy.
      let nextBuffer: Buffer;
      if (targetTab < SHARED_TAB_COUNT) {
        // The source item is still in the file while its copy is added, so it must not count as
        // an obstacle for a move inside the same tab (e.g. sliding a large item by one cell).
        const sourceCell =
          options.sourceStashTab === targetTab &&
          options.sourceGridXFromItem !== undefined &&
          options.sourceGridYFromItem !== undefined
            ? { x: options.sourceGridXFromItem, y: options.sourceGridYFromItem }
            : undefined;
        nextBuffer = await addItemToModernStashSharedPageBuffer(
          buffer,
          sourceItem,
          targetTab,
          options.targetGridX ?? 0,
          options.targetGridY ?? 0,
          shouldKeepQuantity(sourceItem),
          sourceCell,
        );
      } else if (isModernResourceTab(targetTab)) {
        nextBuffer = await addItemToModernStashResourceSectorBuffer(
          buffer,
          sourceItem,
          targetTab,
          options.targetGridX ?? 0,
          options.targetGridY ?? 0,
        );
      } else {
        throw new Error('MODERN_STASH_READ_ONLY');
      }

      nextBuffer = await removeItemFromModernStashBuffer(
        nextBuffer,
        sourceItemId,
        options.sourceStashTab,
        options.sourceGridXFromItem,
        options.sourceGridYFromItem,
        normalizeItemCodeKey(options.sourceItemCode),
      );
      await writeSaveFile(sourceFilePath, nextBuffer);
      return;
    }
  }

  assertWritableD2iBuffer(ext, buffer);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);
  // Classic stash paths always receive a numeric id (non-modern d2i handled above).
  const classicItemId = sourceItemId as number;
  let sourceItem: d2sTypes.IItem | undefined;

  for (const page of data.pages) {
    const extracted = extractItemById(page.items, classicItemId);
    if (extracted) {
      sourceItem = extracted;
      break;
    }
  }

  if (!sourceItem) {
    throw new Error('Source item not found in stash file');
  }

  const itemToWrite = withTargetCoordinates(sourceItem, options.targetGridX, options.targetGridY);
  const targetTab = options.targetStashTab ?? 0;

  while (data.pages.length <= targetTab) {
    data.pages.push({ name: '', type: 0, items: [] });
    data.pageCount = data.pages.length;
  }

  assertTargetCellsFree(data.pages[targetTab].items, itemToWrite);
  data.pages[targetTab].items.push(itemToWrite);

  await writeClassicStashFile(sourceFilePath, data, { constants, version });
}

async function removeItemFromSaveFileUnlocked(
  filePath: string,
  fileType: VaultSourceFileType,
  itemLocator: number | SaveFileItemLocator,
): Promise<void> {
  const { itemId, itemCode, stashTab, gridX, gridY } = normalizeSaveFileItemLocator(itemLocator);
  const buffer = await readFile(filePath);

  if (fileType === 'd2s') {
    if (itemId === undefined) {
      throw new Error('itemId is required for d2s removal');
    }

    const data = await d2s.read(buffer);
    // Remove exactly one item: ids are not guaranteed to be unique, and removing every match would
    // silently delete other items that happen to share the id.
    const removed =
      extractItemById(data.items, itemId) ??
      extractItemById(data.corpse_items, itemId) ??
      extractItemById(data.merc_items, itemId);
    if (!removed) {
      throw new Error('Source item not found in save file');
    }
    await writeD2sSaveFile(filePath, data);
    return;
  }

  const ext = extname(filePath);

  if (ext === '.d2i') {
    const metadata = readD2iMetadata(buffer);
    if (isModernStashVersion(metadata.version)) {
      await removeItemFromModernStashSharedPage(filePath, itemId, stashTab, gridX, gridY, itemCode);
      return;
    }
  }

  if (itemId === undefined) {
    throw new Error('itemId is required for classic stash removal');
  }

  assertWritableD2iBuffer(ext, buffer);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);

  let removed: d2sTypes.IItem | undefined;
  for (const page of data.pages) {
    removed = extractItemById(page.items, itemId);
    if (removed) {
      break;
    }
  }
  if (!removed) {
    throw new Error('Source item not found in stash file');
  }

  await writeClassicStashFile(filePath, data, { constants, version });
}

// Byte offset within the sector header where the total sector size (header + payload) is stored.
const D2I_SECTOR_SIZE_FIELD_OFFSET = 16;

// Byte offsets within a JM item-list header.
const JM_ITEM_COUNT_OFFSET = 2; // bytes 2-3 = LE uint16 item count
const JM_ITEM_DATA_OFFSET = 4; // item bytes start at byte 4

/**
 * Rebuilds a .d2i buffer, replacing one sector's payload with `newPayload`.
 * All other sectors are kept byte-for-byte identical.
 */
function rebuildD2iBuffer(
  buffer: Buffer,
  sectors: Array<{ offset: number; size: number }>,
  targetSectorOffset: number,
  newPayload: Buffer,
): Buffer {
  const parts: Buffer[] = [];
  for (const sector of sectors) {
    const header = Buffer.from(
      buffer.subarray(sector.offset, sector.offset + D2I_SECTOR_HEADER_SIZE),
    );
    if (sector.offset === targetSectorOffset) {
      header.writeUInt32LE(
        D2I_SECTOR_HEADER_SIZE + newPayload.length,
        D2I_SECTOR_SIZE_FIELD_OFFSET,
      );
      parts.push(header, newPayload);
    } else {
      const sectorData = buffer.subarray(
        sector.offset + D2I_SECTOR_HEADER_SIZE,
        sector.offset + sector.size,
      );
      parts.push(header, Buffer.from(sectorData));
    }
  }
  return Buffer.concat(parts);
}

/**
 * Returns true if an item matches the given identifier — by numeric id when
 * available (non-simple items), or by grid position (simple items like gems/runes).
 */
function itemMatchesLocator(
  item: d2sTypes.IItem,
  itemId: number | undefined,
  gridX?: number,
  gridY?: number,
  itemCode?: string,
  isResourceTabLocator = false,
): boolean {
  if (itemCode !== undefined && normalizeItemCodeKey(resolveItemCode(item)) !== itemCode) {
    return false;
  }

  // Resource-tab stacks are laid out by the game and identified by their item code: the position
  // the UI shows for them is not the one stored in the file.
  if (isResourceTabLocator && itemCode !== undefined) {
    return true;
  }

  const storedId = normalizeItemId((item as { id?: unknown }).id);

  if (gridX !== undefined && gridY !== undefined) {
    // When source coordinates are known (modern drag/drop and stack-pickup flows),
    // treat them as the authoritative locator. Falling back to id alone here can remove
    // the just-inserted copy during same-tab moves because both items share id
    // until the source is removed.
    if (item.position_x !== gridX || item.position_y !== gridY) {
      return false;
    }

    // Position alone is ambiguous when no tab was given (the same cell exists on every tab), so
    // when both sides carry an id they must agree. Otherwise a different item could be removed.
    return itemId === undefined || storedId === undefined || storedId === itemId;
  }

  return itemId !== undefined && storedId === itemId;
}

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

function isResourceStackAttributeId(value: unknown): boolean {
  if (value === RESOURCE_STASH_STACK_ATTR_ID) {
    return true;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed === RESOURCE_STASH_STACK_ATTR_ID;
  }

  return false;
}

function hasResourceStackAttribute(item: d2sTypes.IItem): boolean {
  const magicAttributes = item.magic_attributes as Array<{ id?: unknown }> | undefined;
  return (
    Array.isArray(magicAttributes) &&
    magicAttributes.some((attribute) => isResourceStackAttributeId(attribute?.id))
  );
}

function isResourceStackableItem(item: d2sTypes.IItem): boolean {
  if (hasResourceStackAttribute(item)) {
    return true;
  }

  return isResourceItemCode(resolveItemCode(item));
}

/**
 * A resource-stash stack (runes/gems/materials tabs) is a single item carrying a count. Outside the
 * resource tabs the game has no such stack, so only one unit can be materialized per item. Moving
 * the whole stack anywhere else would keep one unit and delete the rest, so it must go through a
 * stack split instead.
 */
function assertStackMoveIsLossless(item: d2sTypes.IItem, targetKeepsStackCount: boolean): void {
  if (
    !targetKeepsStackCount &&
    isResourceStackableItem(item) &&
    resolveStackCount(item as unknown as Parameters<typeof resolveStackCount>[0]) > 1
  ) {
    throw new Error('STACK_MOVE_REQUIRES_SPLIT');
  }
}

function stripResourceStashStackMetadata(item: d2sTypes.IItem): d2sTypes.IItem {
  const magicAttributes = item.magic_attributes as Array<{ id?: unknown }> | undefined;
  if (!Array.isArray(magicAttributes) || !hasResourceStackAttribute(item)) {
    return item;
  }

  return {
    ...item,
    quantity: 1,
    magic_attributes: magicAttributes.filter(
      (attribute) => !isResourceStackAttributeId(attribute?.id),
    ),
    id: undefined,
  };
}

function withUpdatedResourceStackCount(item: d2sTypes.IItem, newCount: number): d2sTypes.IItem {
  const magicAttributes = item.magic_attributes as
    | Array<{ id?: unknown; values?: unknown; [key: string]: unknown }>
    | undefined;

  if (!Array.isArray(magicAttributes)) {
    return { ...item, quantity: newCount };
  }

  let hasResourceStackAttribute = false;
  const nextMagicAttributes = magicAttributes.map((attribute) => {
    const rawId = attribute?.id;
    const normalizedId =
      typeof rawId === 'string' && rawId.trim().length > 0 ? Number.parseInt(rawId, 10) : rawId;

    if (normalizedId !== RESOURCE_STASH_STACK_ATTR_ID) {
      return attribute;
    }

    hasResourceStackAttribute = true;
    return {
      ...attribute,
      values: [newCount],
    };
  });

  if (!hasResourceStackAttribute) {
    return { ...item, quantity: newCount };
  }

  return {
    ...item,
    quantity: newCount,
    magic_attributes: nextMagicAttributes,
  };
}

/**
 * Finds an item in the shared stash sectors (JM sectors 0–SHARED_TAB_COUNT-1)
 * of a modern .d2i file. Matches by numeric id when present (non-simple items),
 * or by grid position (simple items like gems/runes that have no stored id).
 * Returns undefined if not found.
 */
async function findItemInModernStashSharedPage(
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
async function removeItemFromModernStashSharedPage(
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
async function removeItemFromModernStashBuffer(
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
async function addItemToModernStashSharedPageBuffer(
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

/**
 * Quantity to write for an item placed in a shared tab. Resource stacks (runes/gems/materials) are
 * one unit per item there, but natively stackable items (tomes, keys, arrows, javelins) carry
 * their own quantity, which must be preserved.
 */
function shouldKeepQuantity(item: d2sTypes.IItem): number {
  return isResourceStackableItem(item) ? 1 : getItemQuantity(item);
}

async function addItemToModernStashSharedPage(
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

/**
 * `quantity` is the number of units of a resource stack (runes/gems/materials) to materialize.
 * Only the resource tabs can hold more than one unit per item, so anything else must be written
 * one unit at a time; refusing beats silently keeping one unit and dropping the rest.
 */
function applyWriteQuantity(
  item: d2sTypes.IItem,
  quantity: number | undefined,
  targetKeepsStackCount: boolean,
): d2sTypes.IItem {
  if (quantity === undefined || !isResourceStackableItem(item)) {
    return item;
  }

  const itemWithQuantity = withUpdatedResourceStackCount(item, quantity);
  assertStackMoveIsLossless(itemWithQuantity, targetKeepsStackCount);
  return itemWithQuantity;
}

function isModernResourceTabTarget(
  fileType: VaultSourceFileType,
  ext: string,
  locationContext: VaultLocationContext,
  stashTab: number | undefined,
  buffer: Buffer,
): boolean {
  return (
    fileType === 'd2i' &&
    ext === '.d2i' &&
    locationContext === 'stash' &&
    isModernResourceTab(stashTab) &&
    isModernStashVersion(readD2iMetadata(buffer).version)
  );
}

async function addItemToSaveFileUnlocked(
  filePath: string,
  fileType: VaultSourceFileType,
  item: d2sTypes.IItem,
  locationContext: VaultLocationContext,
  stashTab?: number,
  targetGridX?: number,
  targetGridY?: number,
  targetEquippedSlotId?: number,
  quantity?: number,
): Promise<void> {
  const buffer = await readFile(filePath);
  const ext = extname(filePath);
  const targetIsModernResourceTab = isModernResourceTabTarget(
    fileType,
    ext,
    locationContext,
    stashTab,
    buffer,
  );

  const sourceItem = applyWriteQuantity(item, quantity, targetIsModernResourceTab);

  if (targetIsModernResourceTab) {
    await addItemToModernStashResourceSector(
      filePath,
      sourceItem,
      stashTab as number,
      targetGridX ?? 0,
      targetGridY ?? 0,
    );
    return;
  }

  const normalizedItem = stripResourceStashStackMetadata(sourceItem);

  if (fileType === 'd2s') {
    const data = await d2s.read(buffer);
    const itemToWrite = withD2SLocationContext(
      withTargetCoordinates(normalizedItem, targetGridX, targetGridY),
      locationContext,
      data.items,
      resolveTargetCharacterClass(data),
      targetEquippedSlotId,
    );

    if (locationContext === 'mercenary') {
      data.merc_items.push(itemToWrite);
    } else if (locationContext === 'corpse') {
      data.corpse_items.push(itemToWrite);
    } else {
      assertCharacterGridCellsFree(data.items, itemToWrite);
      data.items.push(itemToWrite);
    }

    await writeD2sSaveFile(filePath, data);
    return;
  }

  // Modern .d2i: shared stash pages (tabs 0–4) are writable via sector patching.
  if (
    ext === '.d2i' &&
    locationContext === 'stash' &&
    typeof stashTab === 'number' &&
    stashTab < SHARED_TAB_COUNT
  ) {
    await addItemToModernStashSharedPage(
      filePath,
      sourceItem,
      stashTab,
      targetGridX ?? 0,
      targetGridY ?? 0,
    );
    return;
  }

  assertWritableD2iBuffer(ext, buffer);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);
  const itemToWrite = withTargetCoordinates(normalizedItem, targetGridX, targetGridY);

  const targetTab = stashTab ?? 0;

  while (data.pages.length <= targetTab) {
    data.pages.push({ name: '', type: 0, items: [] });
    data.pageCount = data.pages.length;
  }

  assertTargetCellsFree(data.pages[targetTab].items, itemToWrite);
  data.pages[targetTab].items.push(itemToWrite);

  await writeClassicStashFile(filePath, data, { constants, version });
}

export interface SplitStackTarget {
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX: number;
  targetGridY: number;
}

export interface SplitStackOptions {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceStashTab: number;
  sourceItemCode: string;
  /** Raw JSON of the source IItem. Required when sourceFileType is 'd2i' (modern stash). */
  sourceRawItemJson?: string;
  splitCount: number;
  targets: SplitStackTarget[];
}

function isModernResourceTab(stashTab: number | undefined): stashTab is number {
  return resolveResourceStashTabKind(stashTab) !== undefined;
}

function isResourceCodeAllowedForTab(itemCode: string, stashTab: number): boolean {
  const tabKind: ResourceStashTabKind | undefined = resolveResourceStashTabKind(stashTab);
  return tabKind !== undefined && isResourceCodeOfKind(itemCode, tabKind);
}

function findItemByCode(items: d2sTypes.IItem[], code: string): d2sTypes.IItem | undefined {
  return items.find((item) => {
    const itemCode = normalizeItemCodeKey(
      (item as { code?: unknown; type?: unknown }).code ?? (item as { type?: unknown }).type,
    );
    return itemCode === code;
  });
}

function getItemQuantity(item: d2sTypes.IItem): number {
  const qty = (item as { quantity?: unknown }).quantity;
  if (typeof qty === 'number' && Number.isInteger(qty) && qty >= 1) {
    return qty;
  }
  return 1;
}

function withQuantityOne(item: d2sTypes.IItem): d2sTypes.IItem {
  return { ...item, quantity: 1 };
}

function withReducedQuantity(item: d2sTypes.IItem, reduceBy: number): d2sTypes.IItem {
  const current = getItemQuantity(item);
  const next = Math.max(0, current - reduceBy);
  return { ...item, quantity: next };
}

interface ModernResourceSector {
  sectorIndex: number;
  offset: number;
  size: number;
  payloadOffset: number;
  payloadSize: number;
}

interface ResourceSectorItemEntry {
  sector: ModernResourceSector;
  count: number;
  startByte: number;
  endByte: number;
  item: d2sTypes.IItem;
}

interface ResourceStackMatchHint {
  positionX?: number;
  positionY?: number;
  stackCount?: number;
}

function resolveModernJmSectors(buffer: Buffer): {
  metadata: ReturnType<typeof readD2iMetadata>;
  jmSectors: ModernResourceSector[];
} {
  const metadata = readD2iMetadata(buffer);
  const jmSectors = metadata.sectors
    .map((sector, index) => ({ sectorIndex: index, ...sector }))
    .filter((s) => s.payloadSignature === 'JM')
    .sort((a, b) => a.sectorIndex - b.sectorIndex);

  return { metadata, jmSectors };
}

async function readResourceSectorEntries(
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

function selectResourceStackEntry(
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

async function reduceResourceStackEntryInModernStashBuffer(
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

async function addItemToModernStashResourceSectorBuffer(
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

async function addItemToModernStashResourceSector(
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
async function reduceItemInModernStashResourceSector(
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

/**
 * Splits `splitCount` items off a stack and places one item at each target.
 *
 * Character saves (.d2s) and classic stashes (.sss/.d2x and pre-v105 .d2i) are edited through the
 * d2s library. A modern stash (.d2i v105+) source needs `sourceRawItemJson`: its resource-tab stack
 * (runes/gems/materials) is reduced and the copies go to the writable shared tabs (0–4) or to other
 * save files. A modern stash source without `sourceRawItemJson`, or a modern stash target outside
 * the shared tabs, throws MODERN_STASH_READ_ONLY.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This function coordinates d2s, classic stash, and multi-target file writes in a single operation. Splitting further would require passing complex partial state between helpers.
async function splitStackInSaveFileUnlocked(options: SplitStackOptions): Promise<void> {
  const { sourceFilePath, sourceFileType, sourceStashTab, sourceItemCode } = options;
  const normalizedCode = normalizeItemCodeKey(sourceItemCode);
  if (!normalizedCode) {
    throw new Error('sourceItemCode is required');
  }

  if (options.splitCount <= 0) {
    throw new Error('splitCount must be positive');
  }

  // Modern stash resource tabs (d2i v105+) support stack splitting into shared tabs.
  // Prefer a single-buffer mutation path when source and targets are in the same modern stash file.
  if (sourceFileType === 'd2i' && options.sourceRawItemJson) {
    if (typeof options.sourceRawItemJson !== 'string' || !options.sourceRawItemJson.trim()) {
      throw new Error('sourceRawItemJson is required for modern stash sources');
    }
    let sourceItem: d2sTypes.IItem;
    try {
      sourceItem = JSON.parse(options.sourceRawItemJson) as d2sTypes.IItem;
    } catch {
      throw new Error('sourceRawItemJson must be valid JSON');
    }

    const requestedSplitCount = Math.min(options.splitCount, options.targets.length);
    if (requestedSplitCount <= 0) {
      return;
    }

    const sourceHint: ResourceStackMatchHint = {
      positionX:
        typeof sourceItem.position_x === 'number' && Number.isFinite(sourceItem.position_x)
          ? sourceItem.position_x
          : undefined,
      positionY:
        typeof sourceItem.position_y === 'number' && Number.isFinite(sourceItem.position_y)
          ? sourceItem.position_y
          : undefined,
      stackCount:
        typeof sourceItem.quantity === 'number' && Number.isInteger(sourceItem.quantity)
          ? sourceItem.quantity
          : undefined,
    };

    const splitTargets = options.targets.slice(0, requestedSplitCount);
    const isSingleModernFileSplit = splitTargets.every(
      (target) =>
        isSameSaveFile(
          sourceFilePath,
          sourceFileType,
          target.targetFilePath,
          target.targetFileType,
        ) &&
        target.targetFileType === 'd2i' &&
        target.targetLocationContext === 'stash' &&
        typeof target.targetStashTab === 'number' &&
        target.targetStashTab < SHARED_TAB_COUNT,
    );

    if (isSingleModernFileSplit) {
      let workingBuffer = await readFile(sourceFilePath);
      const { metadata, jmSectors } = resolveModernJmSectors(workingBuffer);
      const entries = await readResourceSectorEntries(workingBuffer, jmSectors, metadata.version);
      const sourceEntry = selectResourceStackEntry(entries, normalizedCode, sourceHint);
      if (!sourceEntry) {
        throw new Error(`Stack item '${sourceItemCode}' not found in modern resource sectors`);
      }

      const sourceAvailable = resolveStackCount(sourceEntry.item);
      const actualSplitCount = Math.min(requestedSplitCount, sourceAvailable);
      if (actualSplitCount <= 0) {
        return;
      }

      // First reduce source in memory, then add placed copies; persist only once.
      workingBuffer = await reduceResourceStackEntryInModernStashBuffer(
        workingBuffer,
        sourceEntry,
        actualSplitCount,
      );

      for (let i = 0; i < actualSplitCount; i += 1) {
        const target = splitTargets[i];
        const copy = withQuantityOne(
          withTargetCoordinates(sourceEntry.item, target.targetGridX, target.targetGridY),
        );
        (copy as { id?: unknown }).id = undefined;
        workingBuffer = await addItemToModernStashSharedPageBuffer(
          workingBuffer,
          copy,
          target.targetStashTab as number,
          target.targetGridX,
          target.targetGridY,
        );
      }

      await writeSaveFile(sourceFilePath, workingBuffer);
      return;
    }

    // Only place as many copies as the source stack really holds; otherwise the extra copies
    // would be created out of thin air once the source entry is reduced to zero.
    const sourceBufferForCount = await readFile(sourceFilePath);
    const { metadata: countMetadata, jmSectors: countSectors } =
      resolveModernJmSectors(sourceBufferForCount);
    const countEntries = await readResourceSectorEntries(
      sourceBufferForCount,
      countSectors,
      countMetadata.version,
    );
    const countEntry = selectResourceStackEntry(countEntries, normalizedCode, sourceHint);
    if (!countEntry) {
      throw new Error(`Stack item '${sourceItemCode}' not found in modern resource sectors`);
    }
    const placeableTargets = splitTargets.slice(
      0,
      Math.min(splitTargets.length, resolveStackCount(countEntry.item)),
    );

    for (const target of placeableTargets) {
      // Modern .d2i shared stash pages (tabs 0–4) are writable via sector patching.
      const isModernSharedStash =
        target.targetFileType === 'd2i' &&
        target.targetLocationContext === 'stash' &&
        typeof target.targetStashTab === 'number' &&
        target.targetStashTab < SHARED_TAB_COUNT;
      if (!isModernSharedStash) {
        await assertWritableStashMutationTarget(target.targetFilePath, target.targetFileType);
      }

      const copy = withQuantityOne(
        withTargetCoordinates(sourceItem, target.targetGridX, target.targetGridY),
      );
      (copy as { id?: unknown }).id = undefined;
      await addItemToSaveFileUnlocked(
        target.targetFilePath,
        target.targetFileType,
        copy,
        target.targetLocationContext,
        target.targetStashTab,
        target.targetGridX,
        target.targetGridY,
      );
    }

    // Reduce the source resource-stack quantity after placements in multi-file flows.
    await reduceItemInModernStashResourceSector(
      sourceFilePath,
      normalizedCode,
      placeableTargets.length,
      sourceHint,
    );
    return;
  }

  // Validate all targets before touching any file.
  await assertWritableStashMutationTarget(sourceFilePath, sourceFileType);
  for (const target of options.targets) {
    await assertWritableStashMutationTarget(target.targetFilePath, target.targetFileType);
  }

  // Never take more units out of the source than there are placements for: every unit removed
  // from the stack must end up as a placed copy, otherwise it is lost.
  const placementLimit = Math.min(options.splitCount, options.targets.length);
  const isTargetInSourceFile = (target: SplitStackTarget): boolean =>
    isSameSaveFile(sourceFilePath, sourceFileType, target.targetFilePath, target.targetFileType);

  // Read and parse source file.
  const sourceBuffer = await readFile(sourceFilePath);

  if (sourceFileType === 'd2s') {
    const data = await d2s.read(sourceBuffer);
    const sourceItems = data.items;
    const sourceItem = findItemByCode(sourceItems, normalizedCode);
    if (!sourceItem) {
      throw new Error(`Stack item '${sourceItemCode}' not found in save file`);
    }

    const currentQty = getItemQuantity(sourceItem);
    const actualSplitCount = Math.min(placementLimit, currentQty);
    const copiesForOtherFiles: Array<{ target: SplitStackTarget; copy: d2sTypes.IItem }> = [];

    for (let i = 0; i < actualSplitCount; i += 1) {
      const target = options.targets[i];

      if (!isTargetInSourceFile(target)) {
        // Remove ID so the library assigns a new one on write.
        const copy = { ...withQuantityOne(sourceItem), id: undefined } as d2sTypes.IItem;
        copiesForOtherFiles.push({ target, copy });
        continue;
      }

      const copy = withQuantityOne(
        withTargetCoordinates(
          withD2SLocationContext(
            sourceItem,
            target.targetLocationContext,
            data.items,
            resolveTargetCharacterClass(data),
            undefined,
          ),
          target.targetGridX,
          target.targetGridY,
        ),
      );
      // Remove ID so the library assigns a new one on write.
      (copy as { id?: unknown }).id = undefined;

      if (target.targetLocationContext === 'mercenary') {
        data.merc_items.push(copy);
      } else if (target.targetLocationContext === 'corpse') {
        data.corpse_items.push(copy);
      } else {
        assertCharacterGridCellsFree(data.items, copy);
        data.items.push(copy);
      }
    }

    // Place copies in other files first: if anything fails from here on the source stack is still
    // intact, so the worst outcome is an extra copy instead of a missing one.
    for (const { target, copy } of copiesForOtherFiles) {
      await addItemToSaveFileUnlocked(
        target.targetFilePath,
        target.targetFileType,
        copy,
        target.targetLocationContext,
        target.targetStashTab,
        target.targetGridX,
        target.targetGridY,
      );
    }

    // Reduce or remove source item.
    const remaining = currentQty - actualSplitCount;
    if (remaining <= 0) {
      const idx = sourceItems.indexOf(sourceItem);
      if (idx >= 0) sourceItems.splice(idx, 1);
    } else {
      sourceItems[sourceItems.indexOf(sourceItem)] = withReducedQuantity(
        sourceItem,
        actualSplitCount,
      );
    }

    await writeD2sSaveFile(sourceFilePath, data);
    return;
  }

  // Classic stash (sss / d2x / non-modern d2i).
  const ext = extname(sourceFilePath);
  assertWritableD2iBuffer(ext, sourceBuffer);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(sourceBuffer, constants);

  const tabIndex = sourceStashTab;
  if (!data.pages[tabIndex]) {
    throw new Error(`Stash tab ${tabIndex} not found in source file`);
  }

  const tabItems = data.pages[tabIndex].items;
  const sourceItem = findItemByCode(tabItems, normalizedCode);
  if (!sourceItem) {
    throw new Error(`Stack item '${sourceItemCode}' not found in stash tab ${tabIndex}`);
  }

  const currentQty = getItemQuantity(sourceItem);
  const actualSplitCount = Math.min(placementLimit, currentQty);
  const copiesForOtherFiles: Array<{ target: SplitStackTarget; copy: d2sTypes.IItem }> = [];

  for (let i = 0; i < actualSplitCount; i += 1) {
    const target = options.targets[i];
    // Remove ID so the library can assign a new one.
    const copy = {
      ...withQuantityOne(withTargetCoordinates(sourceItem, target.targetGridX, target.targetGridY)),
      id: undefined,
    } as d2sTypes.IItem;

    if (!isTargetInSourceFile(target)) {
      copiesForOtherFiles.push({ target, copy });
      continue;
    }

    // Same file: place the copy in the in-memory stash that is written once below. Writing it
    // through the file here would be overwritten by the final write of this stale copy.
    const targetTab = target.targetStashTab ?? 0;
    while (data.pages.length <= targetTab) {
      data.pages.push({ name: '', type: 0, items: [] });
      data.pageCount = data.pages.length;
    }
    assertTargetCellsFree(data.pages[targetTab].items, copy);
    data.pages[targetTab].items.push(copy);
  }

  for (const { target, copy } of copiesForOtherFiles) {
    await addItemToSaveFileUnlocked(
      target.targetFilePath,
      target.targetFileType,
      copy,
      target.targetLocationContext,
      target.targetStashTab,
      target.targetGridX,
      target.targetGridY,
    );
  }

  // Reduce or remove source item and write source file.
  const remaining = currentQty - actualSplitCount;
  if (remaining <= 0) {
    const idx = tabItems.indexOf(sourceItem);
    if (idx >= 0) tabItems.splice(idx, 1);
  } else {
    tabItems[tabItems.indexOf(sourceItem)] = withReducedQuantity(sourceItem, actualSplitCount);
  }

  await writeClassicStashFile(sourceFilePath, data, { constants, version });
}

async function isModernD2iFile(filePath: string, fileType: VaultSourceFileType): Promise<boolean> {
  if (fileType !== 'd2i' || extname(filePath) !== '.d2i') {
    return false;
  }
  const buffer = await readFile(filePath);
  const metadata = readD2iMetadata(buffer);
  return isModernStashVersion(metadata.version);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This move flow intentionally handles same-file vs cross-file logic and modern d2i shared/resource branches in one transactional path.
async function moveItemBetweenSaveFilesUnlocked(options: MoveSaveFileItemOptions): Promise<void> {
  const isMovingWithinSameFile = isSameSaveFile(
    options.sourceFilePath,
    options.sourceFileType,
    options.targetFilePath,
    options.targetFileType,
  );

  if (isMovingWithinSameFile) {
    await moveItemWithinSingleSaveFile(options);
    return;
  }

  // Modern .d2i sources can have items removed — skip the blanket assertion.
  const sourceIsModernD2i = await isModernD2iFile(options.sourceFilePath, options.sourceFileType);
  if (!sourceIsModernD2i) {
    await assertWritableStashMutationTarget(options.sourceFilePath, options.sourceFileType);
  }

  // Modern .d2i targets on shared tabs are writable — skip the blanket assertion.
  const targetStashTab = options.targetStashTab;
  const targetIsModernD2i = await isModernD2iFile(options.targetFilePath, options.targetFileType);
  const targetIsModernD2iSharedTab =
    typeof targetStashTab === 'number' && targetStashTab < SHARED_TAB_COUNT && targetIsModernD2i;
  const targetIsModernD2iResourceTab =
    typeof targetStashTab === 'number' && isModernResourceTab(targetStashTab) && targetIsModernD2i;
  if (!targetIsModernD2iSharedTab && !targetIsModernD2iResourceTab) {
    await assertWritableStashMutationTarget(options.targetFilePath, options.targetFileType);
  }

  let sourceItem: d2sTypes.IItem | undefined;
  if (sourceIsModernD2i) {
    sourceItem = await findItemInModernStashSharedPage(
      options.sourceFilePath,
      options.sourceItemId,
      options.sourceStashTab,
      options.sourceGridXFromItem,
      options.sourceGridYFromItem,
      normalizeItemCodeKey(options.sourceItemCode),
    );
  } else {
    sourceItem = await findItemInSaveFile(
      options.sourceFilePath,
      options.sourceFileType,
      // Non-modern-d2i paths always have a numeric id (non-simple items from .d2s / classic stash)
      options.sourceItemId as number,
    );
  }
  if (!sourceItem) {
    throw new Error('Source item not found in save file');
  }

  assertStackMoveIsLossless(
    sourceItem,
    targetIsModernD2iResourceTab && options.targetLocationContext === 'stash',
  );

  if (
    targetIsModernD2iResourceTab &&
    options.targetLocationContext === 'stash' &&
    typeof options.targetStashTab === 'number'
  ) {
    await addItemToModernStashResourceSector(
      options.targetFilePath,
      sourceItem,
      options.targetStashTab,
      options.targetGridX ?? 0,
      options.targetGridY ?? 0,
    );
  } else {
    await addItemToSaveFileUnlocked(
      options.targetFilePath,
      options.targetFileType,
      sourceItem,
      options.targetLocationContext,
      options.targetStashTab,
      options.targetGridX,
      options.targetGridY,
      options.targetEquippedSlotId,
    );
  }

  if (sourceIsModernD2i) {
    await removeItemFromModernStashSharedPage(
      options.sourceFilePath,
      options.sourceItemId,
      options.sourceStashTab,
      options.sourceGridXFromItem,
      options.sourceGridYFromItem,
      normalizeItemCodeKey(options.sourceItemCode),
    );
  } else {
    await removeItemFromSaveFileUnlocked(
      options.sourceFilePath,
      options.sourceFileType,
      // Non-modern-d2i paths always have a numeric id
      options.sourceItemId as number,
    );
  }
}

// Every public mutation below reads a save file, edits it in memory and writes it back. Two of
// those running at once on the same file would let the second overwrite the first, silently
// dropping an item, so all mutations run one at a time.
let saveFileMutationQueue: Promise<unknown> = Promise.resolve();

function runExclusively<T>(operation: () => Promise<T>): Promise<T> {
  ensureD2sConstants();
  const run = saveFileMutationQueue.then(operation, operation);
  saveFileMutationQueue = run.catch(() => undefined);
  return run;
}

export function removeItemFromSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
  itemLocator: number | SaveFileItemLocator,
): Promise<void> {
  return runExclusively(() => removeItemFromSaveFileUnlocked(filePath, fileType, itemLocator));
}

export function addItemToSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
  item: d2sTypes.IItem,
  locationContext: VaultLocationContext,
  stashTab?: number,
  targetGridX?: number,
  targetGridY?: number,
  targetEquippedSlotId?: number,
  quantity?: number,
): Promise<void> {
  return runExclusively(() =>
    addItemToSaveFileUnlocked(
      filePath,
      fileType,
      item,
      locationContext,
      stashTab,
      targetGridX,
      targetGridY,
      targetEquippedSlotId,
      quantity,
    ),
  );
}

export function splitStackInSaveFile(options: SplitStackOptions): Promise<void> {
  return runExclusively(() => splitStackInSaveFileUnlocked(options));
}

export function moveItemBetweenSaveFiles(options: MoveSaveFileItemOptions): Promise<void> {
  return runExclusively(() => moveItemBetweenSaveFilesUnlocked(options));
}
