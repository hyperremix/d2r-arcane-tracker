import type { VaultItem, VaultSourceFileType } from '../types/grail';

/** Save file types the vault and inventory features understand. Shared by main and renderer. */
export const VALID_SOURCE_FILE_TYPES: ReadonlySet<string> = new Set<VaultSourceFileType>([
  'd2s',
  'sss',
  'd2x',
  'd2i',
]);

type VaultStateTimestamp = Date | string | undefined | null;

function toTimestampMs(value: Exclude<VaultStateTimestamp, undefined | null>): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

/**
 * A row is currently vaulted when it has a vaulted timestamp that is newer than its (optional)
 * unvaulted timestamp. Accepts dates or ISO strings because rows cross the IPC boundary.
 */
export function isCurrentlyVaulted(item: {
  vaultedAt?: VaultItem['vaultedAt'] | string | null;
  unvaultedAt?: VaultItem['unvaultedAt'] | string | null;
}): boolean {
  if (!item.vaultedAt) {
    return false;
  }

  if (!item.unvaultedAt) {
    return true;
  }

  return toTimestampMs(item.unvaultedAt) < toTimestampMs(item.vaultedAt);
}
