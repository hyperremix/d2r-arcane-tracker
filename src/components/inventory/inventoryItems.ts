import type { ParsedInventoryItem, VaultItem, VaultItemUpsertInput } from 'electron/types/grail';
import { isCurrentlyVaulted } from 'electron/utils/vaultState';
import { getRawItemLocation, isRawBeltItem } from '@/lib/rawItemLocation';

export type TypeFilter = 'all' | 'unique' | 'set' | 'runeword' | 'rune' | 'other';

export function getTypeValue(type?: string): TypeFilter {
  if (!type) {
    return 'other';
  }

  const normalizedType = type.toLowerCase();

  if (normalizedType === 'unique' || normalizedType === 'set' || normalizedType === 'runeword') {
    return normalizedType;
  }

  if (normalizedType === 'rune') {
    return 'rune';
  }

  return 'other';
}

export function toVaultUpsertInput(item: ParsedInventoryItem): VaultItemUpsertInput {
  return {
    fingerprint: item.fingerprint,
    itemName: item.itemName,
    itemCode: item.itemCode,
    type: item.type,
    quality: item.quality,
    ethereal: item.ethereal,
    socketCount: item.socketCount,
    stackCount: item.stackCount,
    rawItemJson: item.rawItemJson,
    sourceCharacterId: item.characterId,
    sourceCharacterName: item.characterName,
    sourceFileType: item.sourceFileType,
    sourceFilePath: item.sourceFilePath,
    locationContext: item.locationContext,
    stashTab: item.stashTab,
    gridX: item.gridX,
    gridY: item.gridY,
    gridWidth: item.gridWidth,
    gridHeight: item.gridHeight,
    equippedSlotId: item.equippedSlotId,
    iconFileName: item.iconFileName,
    isSocketedItem: item.isSocketedItem,
    grailItemId: item.grailItemId,
    isPresentInLatestScan: true,
    lastSeenAt: item.seenAt,
  };
}

export function getEffectiveVaultPresent(
  item: ParsedInventoryItem,
  vaultItemsByFingerprint: Map<string, VaultItem>,
  pendingVaultFingerprints: Set<string>,
): boolean | undefined {
  const vaultItem = vaultItemsByFingerprint.get(item.fingerprint);
  if (vaultItem !== undefined) {
    return isCurrentlyVaulted(vaultItem);
  }

  return pendingVaultFingerprints.has(item.fingerprint) ? true : undefined;
}

export function partitionUnknownItems(items: ParsedInventoryItem[]): {
  belt: ParsedInventoryItem[];
  otherUnknown: ParsedInventoryItem[];
} {
  const belt: ParsedInventoryItem[] = [];
  const otherUnknown: ParsedInventoryItem[] = [];

  for (const item of items) {
    const rawLocation = getRawItemLocation(item);
    if (isRawBeltItem(rawLocation)) {
      belt.push(item);
      continue;
    }

    otherUnknown.push(item);
  }

  return { belt, otherUnknown };
}
