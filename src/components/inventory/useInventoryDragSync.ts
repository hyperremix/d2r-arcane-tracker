import { INVENTORY_DRAG_STATE_CHANNEL, VAULT_DRAG_STATE_CHANNEL } from 'electron/ipc/contract';
import type { ParsedInventoryItem, VaultItem, VaultItemUpsertInput } from 'electron/types/grail';
import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  type ActiveInventoryDragItem,
  type ActiveVaultDragItem,
  INVENTORY_DRAG_MIME,
  type InventoryDragStatePayload,
  parseInventoryDragStatePayload,
  parseInventoryTextPayload,
  parseVaultDragStatePayload,
  readDragText,
  serializeInventoryTextPayload,
  toActiveVaultDragItem,
  toInventoryDragStatePayload,
} from '@/components/inventory/dragPayloads';
import { toVaultUpsertInput } from '@/components/inventory/inventoryItems';
import type { StackPickupCursorState } from '@/components/inventory/StackPickupCursor';
import {
  isStackPickupDragState,
  type ResolvedStackPickupState,
  resolveStackPickupState,
  toStackPickupDragStatePayload,
} from '@/components/inventory/stackPickupDragState';
import type { StackPickupState } from '@/components/inventory/useStackPickup';
import { combineUnsubscribers, onMainEvent } from '@/lib/ipcEvents';

export interface InventoryDragSyncOptions {
  pickupState: StackPickupState | undefined;
  cancelPickup: () => void;
  consumePickup: (count: number) => void;
}

export interface InventoryDragSync {
  /** Vault item dragged in this window, or else the one another window reported. */
  activeVaultDragItem: ActiveVaultDragItem | null;
  /** Inventory item dragged in this window, or else the one another window reported. */
  activeInventoryDragItem: ActiveInventoryDragItem | null;
  /** Drag state another window reported (also holds stack pickups relayed from this window). */
  crossWindowInventoryDragItem: ActiveInventoryDragItem | null;
  /** Stack pickup in this window or another window, if any. */
  resolvedStackPickupState: ResolvedStackPickupState | undefined;
  cursorPickupState: StackPickupCursorState | undefined;
  isStackPickupMode: boolean;
  handleItemDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
  handleItemDragEnd: () => void;
  handleVaultItemDragStart: (item: VaultItem) => void;
  handleVaultItemDragEnd: () => void;
  /** Forgets the inventory drag of this window and the one reported by other windows. */
  clearInventoryDrag: () => void;
  /** Forgets the vault drag of this window and the one reported by other windows. */
  clearVaultDrag: () => void;
  /** Resolves the item dropped on the vault dropzone from the drag data or the local drag. */
  resolveVaultDropInput: (
    event: DragEvent<HTMLElement>,
    visibleItems: ParsedInventoryItem[],
  ) => VaultItemUpsertInput | undefined;
  /** Clears the local drag after the item was dropped on the vault dropzone. */
  finishVaultDrop: () => void;
  /** Reads a stack pickup that another window started but this window has not seen yet. */
  fetchSynchronizedStackPickup: () => Promise<ActiveInventoryDragItem | undefined>;
  /** Tells all windows that `placedCount` units of a relayed stack pickup were placed. */
  consumeSynchronizedStackPickup: (
    pickupItem: ActiveInventoryDragItem,
    placedCount: number,
  ) => void;
  /** Cancels the local stack pickup, or the relayed one if this window did not start it. */
  cancelStackPickup: () => void;
}

/**
 * Keeps the drag state of vault items, inventory items and stack pickups in sync between the
 * main window and snapshot windows. Local drags are relayed to main, and drags reported by other
 * windows are tracked so that drop targets here can preview and accept them.
 *
 * @param options - Local stack pickup state and its controls
 * @returns Active drag items and the handlers that start, end and clear drags
 */
export function useInventoryDragSync({
  pickupState,
  cancelPickup,
  consumePickup,
}: InventoryDragSyncOptions): InventoryDragSync {
  const [draggingVaultItem, setDraggingVaultItem] = useState<ActiveVaultDragItem | null>(null);
  const [crossWindowVaultDragItem, setCrossWindowVaultDragItem] =
    useState<ActiveVaultDragItem | null>(null);
  const [draggingInventoryItem, setDraggingInventoryItem] =
    useState<ActiveInventoryDragItem | null>(null);
  const [crossWindowInventoryDragItem, setCrossWindowInventoryDragItem] =
    useState<ActiveInventoryDragItem | null>(null);
  const draggingFingerprintRef = useRef<string | undefined>(undefined);
  const draggingVaultInputRef = useRef<VaultItemUpsertInput | undefined>(undefined);
  const pickupStateRef = useRef<StackPickupState | undefined>(undefined);
  pickupStateRef.current = pickupState;
  const lastSyncedStackPickupPayloadRef = useRef<InventoryDragStatePayload | undefined>(undefined);

  useEffect(() => {
    let isDisposed = false;

    const handleVaultDragState = (payload: unknown) => {
      const parsedPayload = parseVaultDragStatePayload(payload);
      if (!parsedPayload) {
        return;
      }

      if (parsedPayload.active) {
        setCrossWindowVaultDragItem(parsedPayload);
        return;
      }

      setCrossWindowVaultDragItem((current) => (current?.id === parsedPayload.id ? null : current));
    };

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: inventory drag-state synchronization intentionally handles local/remote pickup reconciliation and cancellation in one guarded callback.
    const handleInventoryDragState = (payload: unknown) => {
      const parsedPayload = parseInventoryDragStatePayload(payload);
      if (!parsedPayload) {
        return;
      }

      if (parsedPayload.active) {
        if (
          isStackPickupDragState(parsedPayload) &&
          pickupStateRef.current?.sourceItem?.fingerprint === parsedPayload.fingerprint
        ) {
          const localCount = pickupStateRef.current.count;
          const remoteCount = parsedPayload.stackPickupCount ?? localCount;
          if (remoteCount <= 0) {
            cancelPickup();
          } else if (remoteCount < localCount) {
            consumePickup(localCount - remoteCount);
          }
        }

        setCrossWindowInventoryDragItem(parsedPayload);
        return;
      }

      if (
        parsedPayload.stackPickup === true &&
        pickupStateRef.current?.sourceItem?.fingerprint === parsedPayload.fingerprint
      ) {
        cancelPickup();
      }

      setCrossWindowInventoryDragItem((current) =>
        current?.fingerprint === parsedPayload.fingerprint ? null : current,
      );
    };

    const unsubscribe = combineUnsubscribers([
      onMainEvent(VAULT_DRAG_STATE_CHANNEL, handleVaultDragState),
      onMainEvent(INVENTORY_DRAG_STATE_CHANNEL, handleInventoryDragState),
    ]);

    const getActiveDragState = window.electronAPI?.inventory?.getActiveDragState;
    if (typeof getActiveDragState === 'function') {
      void getActiveDragState()
        .then((payload) => {
          if (isDisposed || !payload || typeof payload !== 'object') {
            return;
          }

          const rawPayload: { vault?: unknown; inventory?: unknown } = payload;
          const parsedVaultPayload = parseVaultDragStatePayload(rawPayload.vault);
          if (parsedVaultPayload?.active) {
            setCrossWindowVaultDragItem(parsedVaultPayload);
          }

          const parsedInventoryPayload = parseInventoryDragStatePayload(rawPayload.inventory);
          if (parsedInventoryPayload?.active) {
            setCrossWindowInventoryDragItem(parsedInventoryPayload);
          }
        })
        .catch((error) => {
          if (!isDisposed) {
            console.warn('Failed to get active inventory drag state', error);
          }
        });
    }

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [cancelPickup, consumePickup]);

  // Relays the local stack pickup to other windows, and its end once it is placed or cancelled.
  useEffect(() => {
    const payload = pickupState ? toStackPickupDragStatePayload(pickupState) : undefined;
    if (payload) {
      lastSyncedStackPickupPayloadRef.current = payload;
      setCrossWindowInventoryDragItem(payload);
      window.electronAPI?.inventory.sendItemDragState(payload);
      return;
    }

    const lastPayload = lastSyncedStackPickupPayloadRef.current;
    if (!lastPayload) {
      return;
    }

    lastSyncedStackPickupPayloadRef.current = undefined;
    setCrossWindowInventoryDragItem((current) =>
      current?.fingerprint === lastPayload.fingerprint && isStackPickupDragState(current)
        ? null
        : current,
    );
    window.electronAPI?.inventory.sendItemDragState({
      ...lastPayload,
      active: false,
    });
  }, [pickupState]);

  const handleItemDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => {
      draggingFingerprintRef.current = item.fingerprint;
      const itemInput = toVaultUpsertInput(item);
      draggingVaultInputRef.current = itemInput;
      const dragStatePayload = toInventoryDragStatePayload(itemInput);
      if (dragStatePayload) {
        setDraggingInventoryItem(dragStatePayload);
        window.electronAPI?.inventory.sendItemDragState(dragStatePayload);
      }

      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(INVENTORY_DRAG_MIME, item.fingerprint);
      event.dataTransfer.setData('text/plain', serializeInventoryTextPayload(itemInput));
      event.dataTransfer.setData('text', serializeInventoryTextPayload(itemInput));
    },
    [],
  );

  const handleItemDragEnd = useCallback(() => {
    draggingFingerprintRef.current = undefined;
    draggingVaultInputRef.current = undefined;
    setDraggingInventoryItem((current) => {
      if (current) {
        window.electronAPI?.inventory.sendItemDragState({
          ...current,
          active: false,
        });
      }

      return null;
    });
  }, []);

  const handleVaultItemDragStart = useCallback((item: VaultItem) => {
    const dragItem = toActiveVaultDragItem(item);
    setDraggingVaultItem(dragItem);
    window.electronAPI?.inventory.sendVaultDragState({
      active: true,
      ...dragItem,
    });
  }, []);

  const handleVaultItemDragEnd = useCallback(() => {
    setDraggingVaultItem((current) => {
      if (current) {
        window.electronAPI?.inventory.sendVaultDragState({
          active: false,
          ...current,
        });
      }

      return null;
    });
  }, []);

  const clearInventoryDrag = useCallback(() => {
    setDraggingInventoryItem(null);
    setCrossWindowInventoryDragItem(null);
  }, []);

  const clearVaultDrag = useCallback(() => {
    setDraggingVaultItem(null);
    setCrossWindowVaultDragItem(null);
  }, []);

  const resolveVaultDropInput = useCallback(
    (
      event: DragEvent<HTMLElement>,
      visibleItems: ParsedInventoryItem[],
    ): VaultItemUpsertInput | undefined => {
      const textPayload = readDragText(event);
      const payloadItemInput = parseInventoryTextPayload(textPayload);
      if (payloadItemInput) {
        return payloadItemInput;
      }

      const fingerprint = event.dataTransfer.getData(INVENTORY_DRAG_MIME) || textPayload;
      const normalizedFingerprint = fingerprint.trim() || draggingFingerprintRef.current;
      const droppedItem = normalizedFingerprint
        ? visibleItems.find((item) => item.fingerprint === normalizedFingerprint)
        : undefined;

      return droppedItem ? toVaultUpsertInput(droppedItem) : draggingVaultInputRef.current;
    },
    [],
  );

  const finishVaultDrop = useCallback(() => {
    draggingFingerprintRef.current = undefined;
    draggingVaultInputRef.current = undefined;
    clearInventoryDrag();
  }, [clearInventoryDrag]);

  const fetchSynchronizedStackPickup = useCallback(async (): Promise<
    ActiveInventoryDragItem | undefined
  > => {
    const getActiveDragState = window.electronAPI?.inventory?.getActiveDragState;
    if (typeof getActiveDragState !== 'function') {
      return undefined;
    }

    try {
      const payload = await getActiveDragState();
      if (!payload || typeof payload !== 'object') {
        return undefined;
      }

      const rawPayload: { inventory?: unknown } = payload;
      const parsedInventoryPayload = parseInventoryDragStatePayload(rawPayload.inventory);
      if (!parsedInventoryPayload?.active || !isStackPickupDragState(parsedInventoryPayload)) {
        return undefined;
      }

      setCrossWindowInventoryDragItem(parsedInventoryPayload);
      return parsedInventoryPayload;
    } catch (error) {
      console.warn('Failed to get active inventory drag state', error);
      return undefined;
    }
  }, []);

  const clearSynchronizedStackPickup = useCallback((pickupItem: ActiveInventoryDragItem): void => {
    const inactivePayload: InventoryDragStatePayload = {
      ...pickupItem,
      active: false,
    };
    lastSyncedStackPickupPayloadRef.current = undefined;
    setCrossWindowInventoryDragItem((current) =>
      current?.fingerprint === pickupItem.fingerprint && isStackPickupDragState(current)
        ? null
        : current,
    );
    window.electronAPI?.inventory.sendItemDragState(inactivePayload);
  }, []);

  const consumeSynchronizedStackPickup = useCallback(
    (pickupItem: ActiveInventoryDragItem, placedCount: number): void => {
      const remaining = (pickupItem.stackPickupCount ?? 0) - placedCount;
      if (remaining > 0) {
        const nextPayload: InventoryDragStatePayload = {
          ...pickupItem,
          active: true,
          stackPickupCount: remaining,
        };
        lastSyncedStackPickupPayloadRef.current = nextPayload;
        setCrossWindowInventoryDragItem(nextPayload);
        window.electronAPI?.inventory.sendItemDragState(nextPayload);
        return;
      }

      clearSynchronizedStackPickup(pickupItem);
    },
    [clearSynchronizedStackPickup],
  );

  const cancelStackPickup = useCallback(() => {
    if (pickupState) {
      cancelPickup();
    } else if (isStackPickupDragState(crossWindowInventoryDragItem)) {
      clearSynchronizedStackPickup(crossWindowInventoryDragItem);
    }
  }, [cancelPickup, clearSynchronizedStackPickup, crossWindowInventoryDragItem, pickupState]);

  const resolvedStackPickupState = resolveStackPickupState(
    pickupState,
    crossWindowInventoryDragItem,
  );

  return {
    activeVaultDragItem: draggingVaultItem ?? crossWindowVaultDragItem,
    activeInventoryDragItem: draggingInventoryItem ?? crossWindowInventoryDragItem,
    crossWindowInventoryDragItem,
    resolvedStackPickupState,
    cursorPickupState: pickupState ?? resolvedStackPickupState,
    isStackPickupMode: resolvedStackPickupState !== undefined,
    handleItemDragStart,
    handleItemDragEnd,
    handleVaultItemDragStart,
    handleVaultItemDragEnd,
    clearInventoryDrag,
    clearVaultDrag,
    resolveVaultDropInput,
    finishVaultDrop,
    fetchSynchronizedStackPickup,
    consumeSynchronizedStackPickup,
    cancelStackPickup,
  };
}
