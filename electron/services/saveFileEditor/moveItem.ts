import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import type { VaultLocationContext, VaultSourceFileType } from '../../types/grail';
import {
  isModernStashVersion,
  normalizeItemCodeKey,
  SHARED_TAB_COUNT,
} from '../../utils/d2rFormat';
import { readD2iMetadata } from '../stashFormat';
import { resolveTargetCharacterClass } from './equipValidation';
import { extractItemById } from './itemLocators';
import {
  addItemToSaveFileUnlocked,
  findItemInSaveFile,
  removeItemFromSaveFileUnlocked,
} from './itemOperations';
import {
  assertCharacterGridCellsFree,
  assertTargetCellsFree,
  withD2SLocationContext,
  withTargetCoordinates,
} from './itemPlacement';
import {
  addItemToModernStashResourceSector,
  addItemToModernStashResourceSectorBuffer,
} from './modernStashResourceSectors';
import {
  addItemToModernStashSharedPageBuffer,
  findItemInModernStashSharedPage,
  removeItemFromModernStashBuffer,
  removeItemFromModernStashSharedPage,
} from './modernStashSharedTabs';
import {
  assertStackMoveIsLossless,
  isModernResourceTab,
  shouldKeepQuantity,
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

/**
 * Moves an item within one save file or between two save files.
 */

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This move flow intentionally handles same-file vs cross-file logic and modern d2i shared/resource branches in one transactional path.
export async function moveItemBetweenSaveFilesUnlocked(
  options: MoveSaveFileItemOptions,
): Promise<void> {
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
