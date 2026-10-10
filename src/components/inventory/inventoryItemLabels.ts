import type { ParsedInventoryItem } from 'electron/types/grail';
import {
  getGridHeight,
  getGridWidth,
  resolvePaperDollSlotKey,
  type UnplacedReason,
} from '@/components/inventory/spatialLayout';
import { translations } from '@/i18n/translations';
import { getRawItemLocation, isRawBeltItem } from '@/lib/rawItemLocation';

export type EquipmentUnplacedReason = UnplacedReason | 'unknownEquippedSlot';

const SHARED_STASH_FILE_TYPES: ReadonlySet<string> = new Set(['d2i', 'sss', 'd2x']);

const KNOWN_QUALITIES = ['normal', 'magic', 'rare', 'set', 'unique', 'crafted'] as const;
type KnownQuality = (typeof KNOWN_QUALITIES)[number];

function isKnownQuality(quality: string): quality is KnownQuality {
  return (KNOWN_QUALITIES as readonly string[]).includes(quality);
}

export function formatLocation(
  item: ParsedInventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const rawLocation = getRawItemLocation(item);

  if (item.locationContext === 'unknown' && isRawBeltItem(rawLocation)) {
    return t(translations.inventoryBrowser.location.belt);
  }

  if (item.locationContext === 'stash' && item.stashTab !== undefined) {
    return t(translations.inventoryBrowser.location.stashTab, { tab: item.stashTab + 1 });
  }

  return t(translations.inventoryBrowser.location[item.locationContext]);
}

/**
 * Plain-language kind of save file an item or snapshot comes from: a character save (`.d2s`) or a
 * shared stash (`.d2i`, `.sss`, `.d2x`).
 */
export function formatSourceFileTypeLabel(
  sourceFileType: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const normalizedType = sourceFileType?.trim().toLowerCase();
  if (normalizedType === 'd2s') {
    return t(translations.inventoryBrowser.sourceFileTypes.character);
  }

  if (normalizedType && SHARED_STASH_FILE_TYPES.has(normalizedType)) {
    return t(translations.inventoryBrowser.sourceFileTypes.sharedStash);
  }

  return t(translations.inventoryBrowser.unknownSourceFileType);
}

/** Translated item quality; qualities the app does not know are shown as they are. */
export function formatQuality(
  quality: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const normalizedQuality = quality.trim().toLowerCase();
  if (isKnownQuality(normalizedQuality)) {
    return t(translations.inventoryBrowser.qualities[normalizedQuality]);
  }

  return quality;
}

/** Accessible name of an inventory tile: item name, quality and location. */
export function formatInventoryTileLabel(
  item: ParsedInventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return t(translations.inventoryBrowser.tileAriaLabel, {
    itemName: item.itemName,
    quality: formatQuality(item.quality, t),
    location: formatLocation(item, t),
  });
}

export function getCoordinatesLabel(
  item: ParsedInventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (item.gridX === undefined || item.gridY === undefined) {
    return t(translations.inventoryBrowser.tooltip.noCoordinates);
  }

  return t(translations.inventoryBrowser.tooltip.coordinatesValue, {
    x: item.gridX,
    y: item.gridY,
  });
}

export function getDimensionsLabel(
  item: ParsedInventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const width = getGridWidth(item);
  const height = getGridHeight(item);
  return t(translations.inventoryBrowser.tooltip.dimensionsValue, {
    width,
    height,
  });
}

export function getPresenceLabel(
  isVaultPresent: boolean | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (isVaultPresent === undefined) {
    return t(translations.inventoryBrowser.vaultUntracked);
  }

  return isVaultPresent
    ? t(translations.inventoryBrowser.vaultPresent)
    : t(translations.inventoryBrowser.vaultMissing);
}

export function getSlotLabel(
  item: ParsedInventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const slotKey = resolvePaperDollSlotKey(item.equippedSlotId);
  if (slotKey) {
    return t(translations.inventoryBrowser.equippedSlots[slotKey]);
  }

  if (item.equippedSlotId !== undefined) {
    return t(translations.inventoryBrowser.equippedSlots.unknown, {
      slotId: item.equippedSlotId,
    });
  }

  return t(translations.inventoryBrowser.details.notEquipped);
}

export function getUnplacedReasonLabel(
  reason: EquipmentUnplacedReason,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (reason === 'unknownEquippedSlot') {
    return t(translations.inventoryBrowser.unplacedReasons.unknownEquippedSlot);
  }

  return t(translations.inventoryBrowser.unplacedReasons[reason]);
}
