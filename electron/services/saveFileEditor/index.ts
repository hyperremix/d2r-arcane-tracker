import type { types as d2sTypes } from '@dschu012/d2s';
import type { VaultLocationContext, VaultSourceFileType } from '../../types/grail';
import type { SaveFileItemLocator } from './itemLocators';
import { addItemToSaveFileUnlocked, removeItemFromSaveFileUnlocked } from './itemOperations';
import { type MoveSaveFileItemOptions, moveItemBetweenSaveFilesUnlocked } from './moveItem';
import { runExclusively } from './mutationQueue';
import { type SplitStackOptions, splitStackInSaveFileUnlocked } from './splitStack';

export type { SaveFileItemLocator } from './itemLocators';
export { readSaveFileItem } from './itemOperations';
export type { MoveSaveFileItemOptions } from './moveItem';
export type { SplitStackOptions, SplitStackTarget } from './splitStack';

/**
 * Public API of the save file editor. Every mutation runs through the mutation queue, so two
 * edits never interleave on the same file.
 */

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
