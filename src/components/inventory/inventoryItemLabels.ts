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

export function formatSourceFileTypeLabel(
  sourceFileType: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!sourceFileType?.trim()) {
    return t(translations.inventoryBrowser.unknownSourceFileType);
  }

  return sourceFileType.toUpperCase();
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
