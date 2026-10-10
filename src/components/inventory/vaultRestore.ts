import type { UnvaultTargetOptions } from 'electron/ipc/contract';
import type { VaultItem } from 'electron/types/grail';
import { resolveStackCount, type StackCountSource } from 'electron/utils/d2rFormat';
import { parseRawItemJson } from 'electron/utils/rawItemJson';

/** Vault row fields that tell where the item was taken from. */
export type VaultItemOrigin = Pick<
  VaultItem,
  'sourceFilePath' | 'sourceFileType' | 'locationContext' | 'stashTab' | 'gridX' | 'gridY'
> &
  Partial<Pick<VaultItem, 'stackCount' | 'rawItemJson'>>;

/**
 * True when a stack row no longer holds the stack it was taken from. Vaulting a resource stack
 * merges it into the existing row for that item code, which keeps the first stack's item data and
 * origin but sums the counts, so the origin does not describe where those units came from.
 */
function isMergedStack({ stackCount, rawItemJson }: VaultItemOrigin): boolean {
  if (rawItemJson === undefined || stackCount === undefined) {
    return false;
  }

  const parsed = parseRawItemJson<StackCountSource>(rawItemJson);
  return stackCount !== (parsed ? resolveStackCount(parsed) : 1);
}

/**
 * True when the row returned by `vault.addItem` is the row this add created. A resource stack that
 * was merged into an existing vault row comes back as that row: its count is the sum of both and
 * its origin is the first stack's, neither of which describes the item that was just vaulted.
 */
export function isVaultRowCreatedByAdd(input: VaultItemOrigin, row: VaultItemOrigin): boolean {
  return (
    (row.stackCount ?? 1) === (input.stackCount ?? 1) &&
    row.sourceFilePath === input.sourceFilePath &&
    row.locationContext === input.locationContext &&
    row.stashTab === input.stashTab &&
    row.gridX === input.gridX &&
    row.gridY === input.gridY
  );
}

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
 * to fall back on, so they have to be placed by dragging them onto a board. Rows whose origin is
 * ambiguous (a merged stack, or a shared stash row without a valid tab) have no target either.
 *
 * @param item - Vault row with its origin fields
 * @returns The unvault target, or `undefined` when the origin cannot be restored
 */
export function resolveVaultRestoreTarget(item: VaultItemOrigin): UnvaultTargetOptions | undefined {
  const targetFilePath = item.sourceFilePath?.trim();
  if (!targetFilePath) {
    return undefined;
  }

  if (isMergedStack(item)) {
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

  if (locationContext === 'stash') {
    // The service puts a stash target without a tab into tab 0, which would be the wrong tab for
    // a row that lost its tab. Character stashes (d2s) have no tabs.
    if (isNonNegativeInteger(stashTab)) {
      target.targetStashTab = stashTab;
    } else if (sourceFileType !== 'd2s') {
      return undefined;
    }
  }

  return target;
}
