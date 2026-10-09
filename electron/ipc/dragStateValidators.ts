/**
 * Validators for the drag state messages renderer windows relay to each other through the main
 * process. Missing grid sizes default to 1x1 and unusable optional fields are dropped, so a window
 * can always show the dragged item.
 */
import type { VaultSourceFileType } from '../types/grail';
import { isVaultLocationContext, VALID_SOURCE_FILE_TYPES } from '../utils/vaultState';
import type { InventoryDragStatePayload, VaultDragStatePayload } from './contract';
import { ensure, type FieldValidator } from './validation';

function normalizeVaultDragStatePayload(payload: unknown): VaultDragStatePayload | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const rawPayload = payload as Partial<VaultDragStatePayload>;
  if (typeof rawPayload.active !== 'boolean') {
    return undefined;
  }

  if (typeof rawPayload.id !== 'string' || rawPayload.id.trim().length === 0) {
    return undefined;
  }

  const gridWidth =
    Number.isInteger(rawPayload.gridWidth) && rawPayload.gridWidth && rawPayload.gridWidth > 0
      ? rawPayload.gridWidth
      : 1;
  const gridHeight =
    Number.isInteger(rawPayload.gridHeight) && rawPayload.gridHeight && rawPayload.gridHeight > 0
      ? rawPayload.gridHeight
      : 1;

  return {
    active: rawPayload.active,
    id: rawPayload.id.trim(),
    gridWidth,
    gridHeight,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Drag-state payload validation intentionally guards every field.
function normalizeInventoryDragStatePayload(
  payload: unknown,
): InventoryDragStatePayload | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const rawPayload = payload as Partial<InventoryDragStatePayload>;
  if (typeof rawPayload.active !== 'boolean') {
    return undefined;
  }

  if (typeof rawPayload.fingerprint !== 'string' || rawPayload.fingerprint.trim().length === 0) {
    return undefined;
  }

  if (
    typeof rawPayload.sourceFilePath !== 'string' ||
    rawPayload.sourceFilePath.trim().length === 0
  ) {
    return undefined;
  }

  if (
    typeof rawPayload.sourceFileType !== 'string' ||
    !VALID_SOURCE_FILE_TYPES.has(rawPayload.sourceFileType as VaultSourceFileType)
  ) {
    return undefined;
  }

  const sourceLocationContext =
    typeof rawPayload.sourceLocationContext === 'string'
      ? rawPayload.sourceLocationContext.trim()
      : undefined;
  if (!isVaultLocationContext(sourceLocationContext)) {
    return undefined;
  }

  if (typeof rawPayload.rawItemJson !== 'string' || rawPayload.rawItemJson.trim().length === 0) {
    return undefined;
  }

  const gridWidth =
    Number.isInteger(rawPayload.gridWidth) && rawPayload.gridWidth && rawPayload.gridWidth > 0
      ? rawPayload.gridWidth
      : 1;
  const gridHeight =
    Number.isInteger(rawPayload.gridHeight) && rawPayload.gridHeight && rawPayload.gridHeight > 0
      ? rawPayload.gridHeight
      : 1;

  const parseOptionalInteger = (value: unknown): number | undefined =>
    Number.isInteger(value) ? (value as number) : undefined;

  const stackPickupCount = parseOptionalInteger(rawPayload.stackPickupCount);
  const stackPickupMaxCount = parseOptionalInteger(rawPayload.stackPickupMaxCount);

  return {
    active: rawPayload.active,
    fingerprint: rawPayload.fingerprint.trim(),
    sourceFilePath: rawPayload.sourceFilePath.trim(),
    sourceFileType: rawPayload.sourceFileType as VaultSourceFileType,
    sourceLocationContext,
    rawItemJson: rawPayload.rawItemJson,
    itemCode:
      typeof rawPayload.itemCode === 'string' && rawPayload.itemCode.trim().length > 0
        ? rawPayload.itemCode.trim()
        : undefined,
    sourceStashTab: parseOptionalInteger(rawPayload.sourceStashTab),
    sourceGridX: parseOptionalInteger(rawPayload.sourceGridX),
    sourceGridY: parseOptionalInteger(rawPayload.sourceGridY),
    sourceEquippedSlotId: parseOptionalInteger(rawPayload.sourceEquippedSlotId),
    gridWidth,
    gridHeight,
    stackPickup: rawPayload.stackPickup === true ? true : undefined,
    stackPickupCount: stackPickupCount && stackPickupCount > 0 ? stackPickupCount : undefined,
    stackPickupMaxCount:
      stackPickupMaxCount && stackPickupMaxCount > 0 ? stackPickupMaxCount : undefined,
    stackPickupItemName:
      typeof rawPayload.stackPickupItemName === 'string' &&
      rawPayload.stackPickupItemName.trim().length > 0
        ? rawPayload.stackPickupItemName.trim()
        : undefined,
    stackPickupIconFileName:
      typeof rawPayload.stackPickupIconFileName === 'string'
        ? rawPayload.stackPickupIconFileName
        : undefined,
  };
}

/** Drag state of a vault item. */
export const vaultDragStatePayload: FieldValidator<VaultDragStatePayload> = (value) => {
  const payload = normalizeVaultDragStatePayload(value);
  ensure(payload !== undefined, 'Invalid vault drag state');
  return payload;
};

/** Drag state of an inventory item or a stack pickup. */
export const inventoryDragStatePayload: FieldValidator<InventoryDragStatePayload> = (value) => {
  const payload = normalizeInventoryDragStatePayload(value);
  ensure(payload !== undefined, 'Invalid inventory drag state');
  return payload;
};
