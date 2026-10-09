import type { types as d2sTypes } from '@dschu012/d2s';
import type { VaultLocationContext, VaultSourceFileType } from '../../types/grail';
import { normalizeItemCodeKey, SHARED_TAB_COUNT } from '../../utils/d2rFormat';
import { addItemToSaveFileUnlocked, removeItemFromSaveFileUnlocked } from './itemOperations';
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
  decodeSaveFile,
  describeDecodedSaveFile,
  type OpenedSaveFile,
  openSaveFile,
} from './saveFileAdapters';
import { isSameSaveFile, writeSaveFile } from './saveFileWrites';

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Covers the no-op, shared-tab and resource-tab cases of one in-memory buffer edit; splitting would scatter that transaction.
async function moveItemWithinModernStash(
  file: OpenedSaveFile,
  options: MoveSaveFileItemOptions,
): Promise<void> {
  const { sourceFilePath, sourceItemId } = options;
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
      file.buffer,
      sourceItem,
      targetTab,
      options.targetGridX ?? 0,
      options.targetGridY ?? 0,
      shouldKeepQuantity(sourceItem),
      sourceCell,
    );
  } else if (isModernResourceTab(targetTab)) {
    nextBuffer = await addItemToModernStashResourceSectorBuffer(
      file.buffer,
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
}

async function moveItemWithinSingleSaveFile(options: MoveSaveFileItemOptions): Promise<void> {
  const file = await openSaveFile(options.sourceFilePath, options.sourceFileType);

  if (file.format.kind === 'modernStash') {
    await moveItemWithinModernStash(file, options);
    return;
  }

  const decoded = await decodeSaveFile(file);
  // Character saves and classic stashes always receive a numeric item id (non-simple items only).
  const sourceItem = decoded.extractItem(options.sourceItemId as number);
  if (!sourceItem) {
    throw new Error(`Source item not found in ${describeDecodedSaveFile(decoded)}`);
  }

  decoded.placeItem(sourceItem, {
    locationContext: options.targetLocationContext,
    stashTab: options.targetStashTab,
    gridX: options.targetGridX,
    gridY: options.targetGridY,
    equippedSlotId: options.targetEquippedSlotId,
  });
  await decoded.write();
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

  const source = await openSaveFile(options.sourceFilePath, options.sourceFileType);
  const target = await openSaveFile(options.targetFilePath, options.targetFileType);
  const sourceIsModernD2i = source.format.kind === 'modernStash';

  // Only the shared and resource tabs of a modern .d2i target can be written.
  const targetStashTab = options.targetStashTab;
  const targetIsModernD2i = target.format.kind === 'modernStash';
  const targetIsModernD2iSharedTab =
    typeof targetStashTab === 'number' && targetStashTab < SHARED_TAB_COUNT && targetIsModernD2i;
  const targetIsModernD2iResourceTab =
    typeof targetStashTab === 'number' && isModernResourceTab(targetStashTab) && targetIsModernD2i;
  if (targetIsModernD2i && !targetIsModernD2iSharedTab && !targetIsModernD2iResourceTab) {
    throw new Error('MODERN_STASH_READ_ONLY');
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
    // Character saves and classic stashes always have a numeric id (non-simple items).
    sourceItem = (await decodeSaveFile(source)).findItem(options.sourceItemId as number);
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
    await addItemToSaveFileUnlocked({
      filePath: options.targetFilePath,
      fileType: options.targetFileType,
      item: sourceItem,
      locationContext: options.targetLocationContext,
      stashTab: options.targetStashTab,
      targetGridX: options.targetGridX,
      targetGridY: options.targetGridY,
      targetEquippedSlotId: options.targetEquippedSlotId,
    });
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
