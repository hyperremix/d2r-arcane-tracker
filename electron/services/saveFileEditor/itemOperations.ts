import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import type { VaultLocationContext, VaultSourceFileType } from '../../types/grail';
import { isModernStashVersion, SHARED_TAB_COUNT } from '../../utils/d2rFormat';
import { ensureD2sConstants } from '../d2s/constants';
import { readD2iMetadata } from '../stashFormat';
import { resolveTargetCharacterClass } from './equipValidation';
import {
  extractItemById,
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
import {
  assertWritableD2iBuffer,
  getStashConstants,
  writeClassicStashFile,
  writeD2sSaveFile,
} from './saveFileWrites';

/**
 * Reads, adds and removes a single item in any supported save file.
 */

export async function findItemInSaveFile(
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

export async function removeItemFromSaveFileUnlocked(
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

export async function addItemToSaveFileUnlocked(
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
