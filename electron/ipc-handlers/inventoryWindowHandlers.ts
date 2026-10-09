import { BrowserWindow, ipcMain } from 'electron';
import { type EventArgs, sendToRenderer } from '../ipc/broadcast';
import {
  type ActiveDragStateSnapshot,
  type EventPayload,
  INVENTORY_DRAG_STATE_CHANNEL,
  type InventoryDragStatePayload,
  VAULT_DRAG_STATE_CHANNEL,
  type VaultDragStatePayload,
} from '../ipc/contract';
import { createIpcMainRegistry } from '../ipc/handle';
import type { InventorySnapshotWindowTarget, VaultSourceFileType } from '../types/grail';
import { assert } from '../utils/assert';
import { assertSaveFilePathAllowed } from '../utils/saveFilePathGuard';
import { VALID_SOURCE_FILE_TYPES } from '../utils/vaultState';
import { openInventorySnapshotWindow } from '../window/inventorySnapshotWindow';

let activeVaultDragState: VaultDragStatePayload | undefined;
let activeInventoryDragState: InventoryDragStatePayload | undefined;

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

  if (
    typeof rawPayload.sourceLocationContext !== 'string' ||
    rawPayload.sourceLocationContext.trim().length === 0
  ) {
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
    sourceLocationContext: rawPayload.sourceLocationContext.trim(),
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

type DragStateChannel = typeof VAULT_DRAG_STATE_CHANNEL | typeof INVENTORY_DRAG_STATE_CHANNEL;

function relayDragState<C extends DragStateChannel>(
  event: { sender: { id: number } },
  channel: C,
  payload: EventPayload<C>,
): void {
  for (const window of BrowserWindow.getAllWindows()) {
    const { webContents } = window;
    if (webContents.id === event.sender.id) {
      continue;
    }

    sendToRenderer(webContents, channel, ...([payload] as EventArgs<C>));
  }
}

function updateActiveVaultDragState(payload: VaultDragStatePayload): void {
  activeVaultDragState = payload.active ? payload : undefined;
  if (payload.active) {
    activeInventoryDragState = undefined;
  }
}

function updateActiveInventoryDragState(payload: InventoryDragStatePayload): void {
  activeInventoryDragState = payload.active ? payload : undefined;
  if (payload.active) {
    activeVaultDragState = undefined;
  }
}

function getActiveDragStateSnapshot(): ActiveDragStateSnapshot {
  const snapshot: ActiveDragStateSnapshot = {};

  if (activeVaultDragState?.active) {
    snapshot.vault = activeVaultDragState;
  }

  if (activeInventoryDragState?.active) {
    snapshot.inventory = activeInventoryDragState;
  }

  return snapshot;
}

function sendActiveDragStateSnapshot(window: BrowserWindow): void {
  const { webContents } = window;
  if (webContents.isDestroyed()) {
    return;
  }

  const activeDragState = getActiveDragStateSnapshot();
  if (activeDragState.vault) {
    sendToRenderer(webContents, VAULT_DRAG_STATE_CHANNEL, activeDragState.vault);
  }

  if (activeDragState.inventory) {
    sendToRenderer(webContents, INVENTORY_DRAG_STATE_CHANNEL, activeDragState.inventory);
  }
}

function validateSnapshotTarget(
  target: InventorySnapshotWindowTarget,
  saveDirectory: string | undefined,
): InventorySnapshotWindowTarget {
  assert(target !== undefined && target !== null, 'Snapshot target is required');

  const sourceFilePath = target.sourceFilePath?.trim();
  const sourceFileType = target.sourceFileType;
  const characterName = target.characterName?.trim();

  assert(
    typeof sourceFilePath === 'string' && sourceFilePath.length > 0,
    'sourceFilePath is required',
  );
  assert(
    typeof sourceFileType === 'string' && VALID_SOURCE_FILE_TYPES.has(sourceFileType),
    'sourceFileType must be one of: d2s, sss, d2x, d2i',
  );
  assert(
    typeof characterName === 'string' && characterName.length > 0,
    'characterName is required',
  );
  assertSaveFilePathAllowed(sourceFilePath, saveDirectory, 'sourceFilePath');

  return {
    sourceFilePath,
    sourceFileType,
    characterName,
  };
}

export function initializeInventoryWindowHandlers(
  __dirname: string,
  viteDevServerUrl?: string,
  rendererDist?: string,
  getSaveDirectory?: () => string | undefined,
): void {
  const { handle, onRendererMessage } = createIpcMainRegistry(ipcMain);
  activeVaultDragState = undefined;
  activeInventoryDragState = undefined;

  onRendererMessage(VAULT_DRAG_STATE_CHANNEL, (event, payload) => {
    const normalizedPayload = normalizeVaultDragStatePayload(payload);
    if (!normalizedPayload) {
      return;
    }

    updateActiveVaultDragState(normalizedPayload);
    relayDragState(event, VAULT_DRAG_STATE_CHANNEL, normalizedPayload);
  });

  onRendererMessage(INVENTORY_DRAG_STATE_CHANNEL, (event, payload) => {
    const normalizedPayload = normalizeInventoryDragStatePayload(payload);
    if (!normalizedPayload) {
      return;
    }

    updateActiveInventoryDragState(normalizedPayload);
    relayDragState(event, INVENTORY_DRAG_STATE_CHANNEL, normalizedPayload);
  });

  handle(
    'inventory:getActiveDragState',
    async (): Promise<ActiveDragStateSnapshot> => getActiveDragStateSnapshot(),
  );

  handle('inventory:openSnapshotWindow', async (_, target): Promise<{ success: boolean }> => {
    const validatedTarget = validateSnapshotTarget(target, getSaveDirectory?.());
    const snapshotWindow = openInventorySnapshotWindow(
      validatedTarget,
      __dirname,
      viteDevServerUrl,
      rendererDist,
    );

    if (snapshotWindow.webContents.isLoadingMainFrame()) {
      snapshotWindow.webContents.once('did-finish-load', () => {
        sendActiveDragStateSnapshot(snapshotWindow);
      });
    } else {
      sendActiveDragStateSnapshot(snapshotWindow);
    }

    return { success: true };
  });
}
