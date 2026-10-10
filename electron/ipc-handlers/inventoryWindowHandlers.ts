import { BrowserWindow, ipcMain } from 'electron';
import type { AppPaths } from '../app/paths';
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
import { assertSaveFilePathAllowed } from '../utils/saveFilePathGuard';
import { openInventorySnapshotWindow } from '../window/inventorySnapshotWindow';

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

/** The drag that is active right now, so windows that open mid-drag can show it. */
interface ActiveDragState {
  updateVault(payload: VaultDragStatePayload): void;
  updateInventory(payload: InventoryDragStatePayload): void;
  snapshot(): ActiveDragStateSnapshot;
}

/**
 * Creates the store of the active drag. Only one drag can be active: starting a vault drag ends
 * an inventory drag and vice versa.
 */
function createActiveDragState(): ActiveDragState {
  let vault: VaultDragStatePayload | undefined;
  let inventory: InventoryDragStatePayload | undefined;

  return {
    updateVault(payload) {
      vault = payload.active ? payload : undefined;
      if (payload.active) {
        inventory = undefined;
      }
    },

    updateInventory(payload) {
      inventory = payload.active ? payload : undefined;
      if (payload.active) {
        vault = undefined;
      }
    },

    snapshot() {
      const snapshot: ActiveDragStateSnapshot = {};
      if (vault?.active) {
        snapshot.vault = vault;
      }
      if (inventory?.active) {
        snapshot.inventory = inventory;
      }
      return snapshot;
    },
  };
}

function sendActiveDragStateSnapshot(
  window: BrowserWindow,
  activeDragState: ActiveDragStateSnapshot,
): void {
  const { webContents } = window;
  if (webContents.isDestroyed()) {
    return;
  }

  if (activeDragState.vault) {
    sendToRenderer(webContents, VAULT_DRAG_STATE_CHANNEL, activeDragState.vault);
  }

  if (activeDragState.inventory) {
    sendToRenderer(webContents, INVENTORY_DRAG_STATE_CHANNEL, activeDragState.inventory);
  }
}

/**
 * Initializes IPC handlers for the inventory snapshot windows and the drag state they share.
 * @param paths - Locations of the preload script and the renderer
 * @param getSaveDirectory - The save directory snapshot windows may show files from
 * @returns Function that removes the handlers and the drag state listeners
 */
export function initializeInventoryWindowHandlers(
  paths: AppPaths,
  getSaveDirectory?: () => string | undefined,
): () => void {
  const { handle, onRendererMessage, dispose } = createIpcMainRegistry(ipcMain);
  const activeDragState = createActiveDragState();

  // The registry validates and normalizes the payloads before the listeners run
  onRendererMessage(VAULT_DRAG_STATE_CHANNEL, (event, payload) => {
    activeDragState.updateVault(payload);
    relayDragState(event, VAULT_DRAG_STATE_CHANNEL, payload);
  });

  onRendererMessage(INVENTORY_DRAG_STATE_CHANNEL, (event, payload) => {
    activeDragState.updateInventory(payload);
    relayDragState(event, INVENTORY_DRAG_STATE_CHANNEL, payload);
  });

  handle(
    'inventory:getActiveDragState',
    async (): Promise<ActiveDragStateSnapshot> => activeDragState.snapshot(),
  );

  handle('inventory:openSnapshotWindow', async (_, target): Promise<{ success: boolean }> => {
    assertSaveFilePathAllowed(target.sourceFilePath, getSaveDirectory?.(), 'sourceFilePath');
    const snapshotWindow = openInventorySnapshotWindow(target, paths);

    if (snapshotWindow.webContents.isLoadingMainFrame()) {
      snapshotWindow.webContents.once('did-finish-load', () => {
        sendActiveDragStateSnapshot(snapshotWindow, activeDragState.snapshot());
      });
    } else {
      sendActiveDragStateSnapshot(snapshotWindow, activeDragState.snapshot());
    }

    return { success: true };
  });

  return dispose;
}
