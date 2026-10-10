import type { VaultItem, VaultLocationContext } from '../types/grail';
import { SAVE_FILE_TYPES } from './d2rFormat';

/** Save file types the vault and inventory features understand. Shared by main and renderer. */
export const VALID_SOURCE_FILE_TYPES: ReadonlySet<string> = new Set<string>(SAVE_FILE_TYPES);

/** Keyed by the union so adding a {@link VaultLocationContext} member without listing it fails to compile. */
const VAULT_LOCATION_CONTEXT_LOOKUP: Record<VaultLocationContext, true> = {
  equipped: true,
  inventory: true,
  stash: true,
  mercenary: true,
  corpse: true,
  unknown: true,
};

const VALID_LOCATION_CONTEXTS: ReadonlySet<string> = new Set(
  Object.keys(VAULT_LOCATION_CONTEXT_LOOKUP),
);

/** Narrows an untrusted value to a {@link VaultLocationContext}. Shared by main and renderer. */
export function isVaultLocationContext(value: unknown): value is VaultLocationContext {
  return typeof value === 'string' && VALID_LOCATION_CONTEXTS.has(value);
}

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
