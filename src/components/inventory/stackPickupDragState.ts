import type { VaultSourceFileType } from 'electron/types/grail';
import {
  type ActiveInventoryDragItem,
  type InventoryDragStatePayload,
  toActiveInventoryDragItem,
} from '@/components/inventory/dragPayloads';
import type { StackPickupState } from '@/components/inventory/useStackPickup';

export function isStackPickupDragState(
  item: ActiveInventoryDragItem | null | undefined,
): item is ActiveInventoryDragItem & {
  stackPickup: true;
  stackPickupCount: number;
  stackPickupMaxCount: number;
  itemCode: string;
} {
  if (!item || item.stackPickup !== true) {
    return false;
  }

  return (
    Number.isInteger(item.stackPickupCount) &&
    (item.stackPickupCount ?? 0) > 0 &&
    Number.isInteger(item.stackPickupMaxCount) &&
    (item.stackPickupMaxCount ?? 0) > 0 &&
    typeof item.itemCode === 'string' &&
    item.itemCode.trim().length > 0
  );
}

export function toStackPickupDragStatePayload(
  pickupState: StackPickupState,
): InventoryDragStatePayload | undefined {
  const source = pickupState.sourceItem;
  if (
    !source?.fingerprint ||
    !source.sourceFilePath ||
    !source.sourceFileType ||
    !source.locationContext ||
    !source.rawItemJson
  ) {
    return undefined;
  }

  return {
    active: true,
    ...toActiveInventoryDragItem({
      fingerprint: source.fingerprint,
      sourceFilePath: source.sourceFilePath,
      sourceFileType: source.sourceFileType,
      sourceLocationContext: source.locationContext,
      sourceStashTab: source.stashTab,
      sourceGridX: source.gridX,
      sourceGridY: source.gridY,
      sourceEquippedSlotId: source.equippedSlotId,
      rawItemJson: source.rawItemJson,
      itemCode: pickupState.itemCode,
      gridWidth: pickupState.gridWidth,
      gridHeight: pickupState.gridHeight,
      stackPickup: true,
      stackPickupCount: pickupState.count,
      stackPickupMaxCount: pickupState.maxCount,
      stackPickupItemName: pickupState.itemName,
      stackPickupIconFileName: pickupState.iconFileName,
    }),
  };
}

export interface ResolvedStackPickupState {
  fingerprint: string;
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceStashTab: number;
  sourceRawItemJson: string;
  itemCode: string;
  count: number;
  maxCount: number;
  itemName: string;
  iconFileName: string;
  gridWidth: number;
  gridHeight: number;
}

export function resolveStackPickupState(
  localPickupState: StackPickupState | undefined,
  synchronizedDragState: ActiveInventoryDragItem | null,
): ResolvedStackPickupState | undefined {
  if (isStackPickupDragState(synchronizedDragState)) {
    return {
      fingerprint: synchronizedDragState.fingerprint,
      sourceFilePath: synchronizedDragState.sourceFilePath,
      sourceFileType: synchronizedDragState.sourceFileType,
      sourceStashTab: synchronizedDragState.sourceStashTab ?? 0,
      sourceRawItemJson: synchronizedDragState.rawItemJson,
      itemCode: synchronizedDragState.itemCode ?? '',
      count: synchronizedDragState.stackPickupCount ?? 0,
      maxCount: synchronizedDragState.stackPickupMaxCount ?? 0,
      itemName:
        synchronizedDragState.stackPickupItemName ??
        synchronizedDragState.itemCode ??
        synchronizedDragState.fingerprint,
      iconFileName: synchronizedDragState.stackPickupIconFileName ?? '',
      gridWidth: synchronizedDragState.gridWidth,
      gridHeight: synchronizedDragState.gridHeight,
    };
  }

  if (!localPickupState) {
    return undefined;
  }

  const source = localPickupState.sourceItem;
  if (
    !source?.fingerprint ||
    !source.sourceFilePath ||
    !source.sourceFileType ||
    !source.rawItemJson
  ) {
    return undefined;
  }

  return {
    fingerprint: source.fingerprint,
    sourceFilePath: source.sourceFilePath,
    sourceFileType: source.sourceFileType,
    sourceStashTab: source.stashTab ?? 0,
    sourceRawItemJson: source.rawItemJson,
    itemCode: localPickupState.itemCode,
    count: localPickupState.count,
    maxCount: localPickupState.maxCount,
    itemName: localPickupState.itemName,
    iconFileName: localPickupState.iconFileName,
    gridWidth: localPickupState.gridWidth,
    gridHeight: localPickupState.gridHeight,
  };
}
