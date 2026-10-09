import type { types as d2sTypes } from '@dschu012/d2s';
import type { VaultLocationContext, VaultSourceFileType } from '../../types/grail';
import { SHARED_TAB_COUNT } from '../../utils/d2rFormat';
import { ensureD2sConstants } from '../d2s/constants';
import { normalizeSaveFileItemLocator, type SaveFileItemLocator } from './itemLocators';
import { addItemToModernStashResourceSector } from './modernStashResourceSectors';
import {
  addItemToModernStashSharedPage,
  findItemInModernStashSharedPage,
  removeItemFromModernStashSharedPage,
} from './modernStashSharedTabs';
import {
  applyWriteQuantity,
  isModernResourceTab,
  stripResourceStashStackMetadata,
} from './resourceStacks';
import { decodeSaveFile, describeDecodedSaveFile, openSaveFile } from './saveFileAdapters';

/**
 * Reads, adds and removes a single item in any supported save file.
 */

export async function findItemInSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
  itemId: number,
): Promise<d2sTypes.IItem | undefined> {
  const file = await openSaveFile(filePath, fileType);

  if (file.format.kind === 'modernStash') {
    return findItemInModernStashSharedPage(filePath, itemId);
  }

  return (await decodeSaveFile(file)).findItem(itemId);
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
  const file = await openSaveFile(filePath, fileType);

  if (file.format.kind === 'modernStash') {
    return findItemInModernStashSharedPage(filePath, itemId, stashTab, gridX, gridY, itemCode);
  }

  if (itemId === undefined) {
    return undefined;
  }

  return (await decodeSaveFile(file)).findItem(itemId);
}

export async function removeItemFromSaveFileUnlocked(
  filePath: string,
  fileType: VaultSourceFileType,
  itemLocator: number | SaveFileItemLocator,
): Promise<void> {
  const { itemId, itemCode, stashTab, gridX, gridY } = normalizeSaveFileItemLocator(itemLocator);
  const file = await openSaveFile(filePath, fileType);

  if (file.format.kind === 'modernStash') {
    await removeItemFromModernStashSharedPage(filePath, itemId, stashTab, gridX, gridY, itemCode);
    return;
  }

  if (itemId === undefined) {
    throw new Error(
      file.format.kind === 'character'
        ? 'itemId is required for d2s removal'
        : 'itemId is required for classic stash removal',
    );
  }

  const decoded = await decodeSaveFile(file);
  // Remove exactly one item: ids are not guaranteed to be unique, and removing every match would
  // silently delete other items that happen to share the id.
  if (!decoded.extractItem(itemId)) {
    throw new Error(`Source item not found in ${describeDecodedSaveFile(decoded)}`);
  }

  await decoded.write();
}

/** What `addItemToSaveFile` writes and where. */
export interface AddItemToSaveFileOptions {
  filePath: string;
  fileType: VaultSourceFileType;
  item: d2sTypes.IItem;
  locationContext: VaultLocationContext;
  stashTab?: number;
  targetGridX?: number;
  targetGridY?: number;
  /** Equipped slot for `locationContext: 'equipped'`; checked against the equip-slot rules. */
  targetEquippedSlotId?: number;
  /**
   * Units of a resource stack (runes/gems/materials) to write. Only the resource tabs of a modern
   * stash keep more than one unit per item; anywhere else more than one unit is refused.
   */
  quantity?: number;
}

export async function addItemToSaveFileUnlocked({
  filePath,
  fileType,
  item,
  locationContext,
  stashTab,
  targetGridX,
  targetGridY,
  targetEquippedSlotId,
  quantity,
}: AddItemToSaveFileOptions): Promise<void> {
  const file = await openSaveFile(filePath, fileType);
  const targetIsModernResourceTab =
    file.format.kind === 'modernStash' &&
    locationContext === 'stash' &&
    isModernResourceTab(stashTab);

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

  // Shared stash pages (tabs 0–4) of a .d2i are written via sector patching. This includes
  // pre-105 .d2i files, which every other operation edits as classic stashes: they keep the modern
  // sector-splicing writer, kept from before the refactor. The extension is matched
  // case-insensitively, so a .D2I file takes the same path.
  if (
    file.format.fileType === 'd2i' &&
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

  const decoded = await decodeSaveFile(file);
  decoded.placeItem(stripResourceStashStackMetadata(sourceItem), {
    locationContext,
    stashTab,
    gridX: targetGridX,
    gridY: targetGridY,
    equippedSlotId: targetEquippedSlotId,
  });
  await decoded.write();
}
