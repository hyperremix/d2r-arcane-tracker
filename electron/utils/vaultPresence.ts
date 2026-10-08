/**
 * Location-independent identity used to match vault rows against the items of a scanned save file.
 *
 * Item fingerprints include the item's position and character name, so an item that moves inside
 * its save gets a new fingerprint. Presence matching therefore falls back to this identity, which
 * describes the item itself (what it is) and ignores where it sits.
 */

export interface VaultPresenceIdentityFields {
  sourceFileType: string;
  itemCode?: string | null;
  quality?: string | null;
  ethereal?: boolean | null;
  socketCount?: number | null;
  itemName?: string | null;
  isSocketedItem?: boolean | null;
  /** The game's per-item id (`id` of non-simple items). Simple items such as runes have none. */
  itemUid?: number | string | null;
}

/**
 * Reads the game's per-item id from a stored raw item JSON. Returns undefined for simple items
 * (runes, gems, materials), for invalid JSON and for any other shape.
 */
export function readItemUidFromRawJson(rawItemJson: string | null | undefined): string | undefined {
  if (!rawItemJson) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(rawItemJson);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }

    return normalizeItemUid((parsed as { id?: unknown }).id);
  } catch {
    return undefined;
  }
}

function normalizeItemUid(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return undefined;
}

/**
 * Builds the identity key of an item. Two items share a key when they look identical regardless of
 * their position, character or location context; the game's item id separates items that are
 * otherwise indistinguishable (for example two magic rings with the same name).
 */
export function createVaultPresenceKey(fields: VaultPresenceIdentityFields): string {
  return [
    fields.sourceFileType,
    fields.itemCode ?? '',
    fields.quality ?? '',
    String(Boolean(fields.ethereal)),
    fields.socketCount ?? '',
    fields.itemName ?? '',
    String(Boolean(fields.isSocketedItem)),
    normalizeItemUid(fields.itemUid) ?? '',
  ].join('|');
}
