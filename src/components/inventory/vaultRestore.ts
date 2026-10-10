import type { UnvaultTargetOptions } from 'electron/ipc/contract';
import type { VaultItem } from 'electron/types/grail';

/** Vault row fields that tell where the item was taken from. */
export type VaultItemOrigin = Pick<
  VaultItem,
  'sourceFilePath' | 'sourceFileType' | 'locationContext' | 'stashTab' | 'gridX' | 'gridY'
>;

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * True when the vault row was taken out of a save file. Such a row is the only copy of the item,
 * so it can only leave the vault by being written back to a save file position.
 */
export function isVaultedFromSaveFile(item: Pick<VaultItem, 'sourceFilePath'>): boolean {
  return Boolean(item.sourceFilePath?.trim());
}

/**
 * The save file position a vaulted item came from, as an unvault target. Only grid positions
 * (inventory and stash) are restored: equipped, mercenary and corpse items have no free-cell check
 * to fall back on, so they have to be placed by dragging them onto a board.
 *
 * @param item - Vault row with its origin fields
 * @returns The unvault target, or `undefined` when the origin cannot be restored
 */
export function resolveVaultRestoreTarget(item: VaultItemOrigin): UnvaultTargetOptions | undefined {
  const targetFilePath = item.sourceFilePath?.trim();
  if (!targetFilePath) {
    return undefined;
  }

  const { locationContext, sourceFileType, stashTab, gridX, gridY } = item;
  if (locationContext !== 'inventory' && locationContext !== 'stash') {
    return undefined;
  }

  // Stash files only hold stash positions.
  if (sourceFileType !== 'd2s' && locationContext !== 'stash') {
    return undefined;
  }

  if (!isNonNegativeInteger(gridX) || !isNonNegativeInteger(gridY)) {
    return undefined;
  }

  const target: UnvaultTargetOptions = {
    targetFilePath,
    targetFileType: sourceFileType,
    targetLocationContext: locationContext,
    targetGridX: gridX,
    targetGridY: gridY,
  };

  if (locationContext === 'stash' && isNonNegativeInteger(stashTab)) {
    target.targetStashTab = stashTab;
  }

  return target;
}
