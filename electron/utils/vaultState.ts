import type { VaultItem, VaultSourceFileType } from '../types/grail';

/** Save file types the vault and inventory features understand. Shared by main and renderer. */
export const VALID_SOURCE_FILE_TYPES: ReadonlySet<string> = new Set<VaultSourceFileType>([
  'd2s',
  'sss',
  'd2x',
  'd2i',
]);

/** Fingerprint prefix of the bookmark rows created from the Grail Tracker item details dialog. */
export const GRAIL_BOOKMARK_FINGERPRINT_PREFIX = 'grail:';

/** True for the bookmark rows the Grail Tracker item details dialog creates (they hold no item). */
export function isGrailBookmark(item: Pick<VaultItem, 'fingerprint'>): boolean {
  return item.fingerprint.startsWith(GRAIL_BOOKMARK_FINGERPRINT_PREFIX);
}

function toTimestampMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

/**
 * A row is currently vaulted when it has a vaulted timestamp that is newer than its (optional)
 * unvaulted timestamp. Accepts dates or ISO strings because rows cross the IPC boundary.
 */
export function isCurrentlyVaulted(item: {
  vaultedAt?: VaultItem['vaultedAt'] | string;
  unvaultedAt?: VaultItem['unvaultedAt'] | string;
}): boolean {
  if (!item.vaultedAt) {
    return false;
  }

  if (!item.unvaultedAt) {
    return true;
  }

  return toTimestampMs(item.unvaultedAt) < toTimestampMs(item.vaultedAt);
}
