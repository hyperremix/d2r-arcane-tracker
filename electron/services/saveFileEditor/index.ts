import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import type { VaultLocationContext, VaultSourceFileType } from '../../types/grail';
import {
  isModernStashVersion,
  normalizeItemCodeKey,
  resolveStackCount,
  SHARED_TAB_COUNT,
} from '../../utils/d2rFormat';
import { ensureD2sConstants } from '../d2s/constants';
import { readD2iMetadata } from '../stashFormat';
import { resolveModernJmSectors } from './d2iSectors';
import { resolveTargetCharacterClass } from './equipValidation';
import {
  extractItemById,
  findItemByCode,
  findItemById,
  normalizeSaveFileItemLocator,
  type SaveFileItemLocator,
} from './itemLocators';
import {
  assertCharacterGridCellsFree,
  assertTargetCellsFree,
  withD2SLocationContext,
  withTargetCoordinates,
} from './itemPlacement';
import {
  addItemToModernStashResourceSector,
  addItemToModernStashResourceSectorBuffer,
  type ResourceStackMatchHint,
  readResourceSectorEntries,
  reduceItemInModernStashResourceSector,
  reduceResourceStackEntryInModernStashBuffer,
  selectResourceStackEntry,
} from './modernStashResourceSectors';
import {
  addItemToModernStashSharedPage,
  addItemToModernStashSharedPageBuffer,
  findItemInModernStashSharedPage,
  removeItemFromModernStashBuffer,
  removeItemFromModernStashSharedPage,
} from './modernStashSharedTabs';
import {
  applyWriteQuantity,
  assertStackMoveIsLossless,
  getItemQuantity,
  isModernResourceTab,
  shouldKeepQuantity,
  stripResourceStashStackMetadata,
  withQuantityOne,
  withReducedQuantity,
} from './resourceStacks';
import {
  assertWritableD2iBuffer,
  assertWritableStashMutationTarget,
  getStashConstants,
  isModernD2iFile,
  isSameSaveFile,
  writeClassicStashFile,
  writeD2sSaveFile,
  writeSaveFile,
} from './saveFileWrites';

export type { SaveFileItemLocator } from './itemLocators';

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
