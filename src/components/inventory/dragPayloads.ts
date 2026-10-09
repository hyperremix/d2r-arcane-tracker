import type {
  VaultItemUpsertInput,
  VaultLocationContext,
  VaultSourceFileType,
} from 'electron/types/grail';
import type { DragEvent } from 'react';

export const INVENTORY_DRAG_MIME = 'application/x-d2r-arcane-tracker-inventory-item';
export const VAULT_DRAG_MIME = 'application/x-d2r-arcane-tracker-vault-item';

const INVENTORY_TEXT_PREFIX = 'd2r-arcane-tracker:inventory-item:';
const VAULT_TEXT_PREFIX = 'd2r-arcane-tracker:vault-item:';

export interface VaultDragTextPayload {
  id: string;
  gridWidth: number;
  gridHeight: number;
}

interface InventoryDragPayload
  extends Omit<VaultItemUpsertInput, 'lastSeenAt' | 'vaultedAt' | 'unvaultedAt'> {
  lastSeenAt?: Date | string;
  vaultedAt?: Date | string;
  unvaultedAt?: Date | string;
}

function normalizeOptionalDate(value: Date | string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeVaultGridDimension(value: unknown): number {
  return Number.isInteger(value) && value && (value as number) > 0 ? (value as number) : 1;
}

function toVaultDragTextPayload(
  parsed: Partial<VaultDragTextPayload>,
): VaultDragTextPayload | undefined {
  if (typeof parsed.id !== 'string' || parsed.id.trim().length === 0) {
    return undefined;
  }

  return {
    id: parsed.id.trim(),
    gridWidth: normalizeVaultGridDimension(parsed.gridWidth),
    gridHeight: normalizeVaultGridDimension(parsed.gridHeight),
  };
}

export function serializeInventoryTextPayload(itemInput: VaultItemUpsertInput): string {
  return `${INVENTORY_TEXT_PREFIX}${JSON.stringify(itemInput)}`;
}

export function parseInventoryTextPayload(rawValue: string): VaultItemUpsertInput | undefined {
  if (!rawValue.startsWith(INVENTORY_TEXT_PREFIX)) {
    return undefined;
  }

  const payload = rawValue.slice(INVENTORY_TEXT_PREFIX.length);

  try {
    const parsed = JSON.parse(payload) as InventoryDragPayload;

    if (
      typeof parsed.fingerprint !== 'string' ||
      parsed.fingerprint.length === 0 ||
      typeof parsed.itemName !== 'string' ||
      parsed.itemName.length === 0 ||
      typeof parsed.rawItemJson !== 'string' ||
      parsed.rawItemJson.length === 0 ||
      typeof parsed.sourceFileType !== 'string' ||
      typeof parsed.locationContext !== 'string'
    ) {
      return undefined;
    }

    const normalizedLastSeenAt = normalizeOptionalDate(parsed.lastSeenAt);
    if (parsed.lastSeenAt !== undefined && !normalizedLastSeenAt) {
      return undefined;
    }

    const normalizedVaultedAt = normalizeOptionalDate(parsed.vaultedAt);
    if (parsed.vaultedAt !== undefined && !normalizedVaultedAt) {
      return undefined;
    }

    const normalizedUnvaultedAt = normalizeOptionalDate(parsed.unvaultedAt);
    if (parsed.unvaultedAt !== undefined && !normalizedUnvaultedAt) {
      return undefined;
    }

    return {
      ...parsed,
      lastSeenAt: normalizedLastSeenAt,
      vaultedAt: normalizedVaultedAt,
      unvaultedAt: normalizedUnvaultedAt,
    };
  } catch {
    return undefined;
  }
}

export function serializeVaultTextPayload(payload: {
  id: string;
  gridWidth?: number;
  gridHeight?: number;
}): string {
  return `${VAULT_TEXT_PREFIX}${JSON.stringify({
    id: payload.id,
    gridWidth: payload.gridWidth ?? 1,
    gridHeight: payload.gridHeight ?? 1,
  })}`;
}

export function parseVaultTextPayload(rawValue: string): VaultDragTextPayload | undefined {
  const trimmedValue = rawValue.trim();
  if (trimmedValue.length === 0 || trimmedValue.startsWith(INVENTORY_TEXT_PREFIX)) {
    return undefined;
  }

  if (!trimmedValue.startsWith(VAULT_TEXT_PREFIX)) {
    if (trimmedValue.startsWith('{')) {
      try {
        return toVaultDragTextPayload(JSON.parse(trimmedValue) as Partial<VaultDragTextPayload>);
      } catch {
        return undefined;
      }
    }

    if (trimmedValue.includes(':')) {
      return undefined;
    }

    return {
      id: trimmedValue,
      gridWidth: 1,
      gridHeight: 1,
    };
  }

  const payload = trimmedValue.slice(VAULT_TEXT_PREFIX.length);

  try {
    return toVaultDragTextPayload(JSON.parse(payload) as Partial<VaultDragTextPayload>);
  } catch {
    return undefined;
  }
}

export interface ActiveVaultDragItem {
  id: string;
  gridWidth: number;
  gridHeight: number;
}

export interface ActiveInventoryDragItem {
  fingerprint: string;
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceLocationContext: VaultLocationContext;
  sourceStashTab?: number;
  sourceGridX?: number;
  sourceGridY?: number;
  sourceEquippedSlotId?: number;
  rawItemJson: string;
  itemCode?: string;
  gridWidth: number;
  gridHeight: number;
  stackPickup?: boolean;
  stackPickupCount?: number;
  stackPickupMaxCount?: number;
  stackPickupItemName?: string;
  stackPickupIconFileName?: string;
}

export function isSameInventoryMoveTarget(
  inventoryItem: ActiveInventoryDragItem,
  targetFilePath: string,
  targetFileType: VaultSourceFileType,
  targetLocationContext: VaultLocationContext,
  targetStashTab: number | undefined,
  targetGridX: number | undefined,
  targetGridY: number | undefined,
  targetEquippedSlotId: number | undefined,
): boolean {
  const isSameFile =
    inventoryItem.sourceFilePath === targetFilePath &&
    inventoryItem.sourceFileType === targetFileType;
  const isSameLocation = inventoryItem.sourceLocationContext === targetLocationContext;
  const isSameStashTab =
    targetLocationContext !== 'stash' ||
    (inventoryItem.sourceStashTab ?? 0) === (targetStashTab ?? 0);
  const isSameGridPosition =
    targetLocationContext === 'equipped'
      ? inventoryItem.sourceEquippedSlotId === targetEquippedSlotId
      : inventoryItem.sourceGridX === targetGridX && inventoryItem.sourceGridY === targetGridY;

  return isSameFile && isSameLocation && isSameStashTab && isSameGridPosition;
}

export type VaultDragStatePayload = ActiveVaultDragItem & {
  active: boolean;
};

export type InventoryDragStatePayload = ActiveInventoryDragItem & {
  active: boolean;
};

export function toActiveVaultDragItem(input: {
  id: string;
  gridWidth?: number;
  gridHeight?: number;
}): ActiveVaultDragItem {
  return {
    id: input.id,
    gridWidth:
      Number.isInteger(input.gridWidth) && input.gridWidth && input.gridWidth > 0
        ? input.gridWidth
        : 1,
    gridHeight:
      Number.isInteger(input.gridHeight) && input.gridHeight && input.gridHeight > 0
        ? input.gridHeight
        : 1,
  };
}

export function normalizePositiveGridDimension(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

export function toActiveInventoryDragItem(input: {
  fingerprint: string;
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceLocationContext: VaultLocationContext;
  sourceStashTab?: number;
  sourceGridX?: number;
  sourceGridY?: number;
  sourceEquippedSlotId?: number;
  rawItemJson: string;
  itemCode?: string;
  gridWidth?: number;
  gridHeight?: number;
  stackPickup?: boolean;
  stackPickupCount?: number;
  stackPickupMaxCount?: number;
  stackPickupItemName?: string;
  stackPickupIconFileName?: string;
}): ActiveInventoryDragItem {
  const stackPickupCount =
    Number.isInteger(input.stackPickupCount) && (input.stackPickupCount ?? 0) > 0
      ? input.stackPickupCount
      : undefined;
  const stackPickupMaxCount =
    Number.isInteger(input.stackPickupMaxCount) && (input.stackPickupMaxCount ?? 0) > 0
      ? input.stackPickupMaxCount
      : undefined;

  return {
    fingerprint: input.fingerprint,
    sourceFilePath: input.sourceFilePath,
    sourceFileType: input.sourceFileType,
    sourceLocationContext: input.sourceLocationContext,
    sourceStashTab: input.sourceStashTab,
    sourceGridX: input.sourceGridX,
    sourceGridY: input.sourceGridY,
    sourceEquippedSlotId: input.sourceEquippedSlotId,
    rawItemJson: input.rawItemJson,
    itemCode: input.itemCode,
    gridWidth: normalizePositiveGridDimension(input.gridWidth),
    gridHeight: normalizePositiveGridDimension(input.gridHeight),
    stackPickup: input.stackPickup === true ? true : undefined,
    stackPickupCount,
    stackPickupMaxCount,
    stackPickupItemName: input.stackPickupItemName,
    stackPickupIconFileName: input.stackPickupIconFileName,
  };
}

export function toInventoryDragStatePayload(
  itemInput: VaultItemUpsertInput,
): InventoryDragStatePayload | undefined {
  const fingerprint = itemInput.fingerprint?.trim();
  const sourceFilePath = itemInput.sourceFilePath?.trim();
  const rawItemJson = itemInput.rawItemJson?.trim();

  if (
    !fingerprint ||
    !sourceFilePath ||
    !rawItemJson ||
    !itemInput.sourceFileType ||
    !itemInput.locationContext
  ) {
    return undefined;
  }

  return {
    active: true,
    ...toActiveInventoryDragItem({
      fingerprint,
      sourceFilePath,
      sourceFileType: itemInput.sourceFileType,
      sourceLocationContext: itemInput.locationContext,
      sourceStashTab: itemInput.stashTab,
      sourceGridX: itemInput.gridX,
      sourceGridY: itemInput.gridY,
      sourceEquippedSlotId: itemInput.equippedSlotId,
      rawItemJson,
      itemCode: itemInput.itemCode,
      gridWidth: itemInput.gridWidth,
      gridHeight: itemInput.gridHeight,
      stackPickup: false,
    }),
  };
}

export function parseInventoryDragStatePayload(
  payload: unknown,
): InventoryDragStatePayload | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const rawPayload = payload as Partial<InventoryDragStatePayload>;
  if (
    typeof rawPayload.active !== 'boolean' ||
    typeof rawPayload.fingerprint !== 'string' ||
    rawPayload.fingerprint.trim().length === 0 ||
    typeof rawPayload.sourceFilePath !== 'string' ||
    rawPayload.sourceFilePath.trim().length === 0 ||
    typeof rawPayload.sourceFileType !== 'string' ||
    typeof rawPayload.sourceLocationContext !== 'string' ||
    rawPayload.sourceLocationContext.trim().length === 0 ||
    typeof rawPayload.rawItemJson !== 'string' ||
    rawPayload.rawItemJson.trim().length === 0
  ) {
    return undefined;
  }

  return {
    active: rawPayload.active,
    ...toActiveInventoryDragItem({
      fingerprint: rawPayload.fingerprint.trim(),
      sourceFilePath: rawPayload.sourceFilePath.trim(),
      sourceFileType: rawPayload.sourceFileType as VaultSourceFileType,
      sourceLocationContext: rawPayload.sourceLocationContext as VaultLocationContext,
      sourceStashTab: Number.isInteger(rawPayload.sourceStashTab)
        ? rawPayload.sourceStashTab
        : undefined,
      sourceGridX: Number.isInteger(rawPayload.sourceGridX) ? rawPayload.sourceGridX : undefined,
      sourceGridY: Number.isInteger(rawPayload.sourceGridY) ? rawPayload.sourceGridY : undefined,
      sourceEquippedSlotId: Number.isInteger(rawPayload.sourceEquippedSlotId)
        ? rawPayload.sourceEquippedSlotId
        : undefined,
      rawItemJson: rawPayload.rawItemJson,
      itemCode:
        typeof rawPayload.itemCode === 'string' && rawPayload.itemCode.trim().length > 0
          ? rawPayload.itemCode.trim()
          : undefined,
      gridWidth: rawPayload.gridWidth,
      gridHeight: rawPayload.gridHeight,
      stackPickup: rawPayload.stackPickup === true,
      stackPickupCount: Number.isInteger(rawPayload.stackPickupCount)
        ? rawPayload.stackPickupCount
        : undefined,
      stackPickupMaxCount: Number.isInteger(rawPayload.stackPickupMaxCount)
        ? rawPayload.stackPickupMaxCount
        : undefined,
      stackPickupItemName:
        typeof rawPayload.stackPickupItemName === 'string' &&
        rawPayload.stackPickupItemName.trim().length > 0
          ? rawPayload.stackPickupItemName.trim()
          : undefined,
      stackPickupIconFileName:
        typeof rawPayload.stackPickupIconFileName === 'string'
          ? rawPayload.stackPickupIconFileName
          : undefined,
    }),
  };
}

export function parseVaultDragStatePayload(payload: unknown): VaultDragStatePayload | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const rawPayload = payload as Partial<VaultDragStatePayload>;
  if (
    typeof rawPayload.active !== 'boolean' ||
    typeof rawPayload.id !== 'string' ||
    rawPayload.id.trim().length === 0
  ) {
    return undefined;
  }

  return {
    active: rawPayload.active,
    ...toActiveVaultDragItem({
      id: rawPayload.id.trim(),
      gridWidth: rawPayload.gridWidth,
      gridHeight: rawPayload.gridHeight,
    }),
  };
}

/**
 * Reads drag data of one format. Some platforms throw while the data is protected (during
 * dragover), which is treated as no data.
 */
export function readDragData(event: DragEvent<HTMLElement>, format: string): string {
  try {
    return event.dataTransfer.getData(format) ?? '';
  } catch {
    return '';
  }
}

/** Reads the plain-text drag data, trying each name platforms use for that format. */
export function readDragText(event: DragEvent<HTMLElement>): string {
  return (
    readDragData(event, 'text/plain') || readDragData(event, 'text') || readDragData(event, 'Text')
  );
}

export function resolveActiveVaultDragItem(
  event: DragEvent<HTMLElement>,
  draggingVaultItem?: ActiveVaultDragItem | null,
): ActiveVaultDragItem | undefined {
  const getDragData = (format: string): string => {
    try {
      return event.dataTransfer.getData(format) ?? '';
    } catch {
      return '';
    }
  };

  const mimeItemId = getDragData(VAULT_DRAG_MIME).trim();
  const textPayload = parseVaultTextPayload(
    getDragData('text/plain') || getDragData('text') || getDragData('Text'),
  );

  if (textPayload) {
    return {
      id: textPayload.id,
      gridWidth: textPayload.gridWidth,
      gridHeight: textPayload.gridHeight,
    };
  }

  const fallbackItem = draggingVaultItem;
  const resolvedId = mimeItemId || fallbackItem?.id;
  if (!resolvedId) {
    return undefined;
  }

  return {
    id: resolvedId,
    gridWidth: fallbackItem?.gridWidth ?? 1,
    gridHeight: fallbackItem?.gridHeight ?? 1,
  };
}

export function resolveActiveInventoryDragItem(
  event: DragEvent<HTMLElement>,
  draggingInventoryItem?: ActiveInventoryDragItem | null,
): ActiveInventoryDragItem | undefined {
  const getDragData = (format: string): string => {
    try {
      return event.dataTransfer.getData(format) ?? '';
    } catch {
      return '';
    }
  };

  const parsedPayload = parseInventoryTextPayload(
    getDragData('text/plain') || getDragData('text') || getDragData('Text'),
  );
  if (parsedPayload) {
    const normalizedPayload = toInventoryDragStatePayload(parsedPayload);
    if (normalizedPayload) {
      return normalizedPayload;
    }
  }

  const mimeFingerprint = getDragData(INVENTORY_DRAG_MIME).trim();
  const fallbackItem = draggingInventoryItem ?? undefined;
  if (!mimeFingerprint && !fallbackItem) {
    return undefined;
  }

  if (
    mimeFingerprint &&
    fallbackItem?.fingerprint &&
    fallbackItem.fingerprint !== mimeFingerprint
  ) {
    return undefined;
  }

  return fallbackItem;
}
