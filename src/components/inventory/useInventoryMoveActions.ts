import type {
  ParsedInventoryItem,
  VaultItem,
  VaultLocationContext,
  VaultSourceFileType,
} from 'electron/types/grail';
import { type DragEvent, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  type ActiveInventoryDragItem,
  isSameInventoryMoveTarget,
  resolveActiveInventoryDragItem,
} from '@/components/inventory/dragPayloads';
import { showEquipValidationToastIfPresent } from '@/components/inventory/equipValidation';
import {
  isModernStashReadOnlyError,
  showInventoryOperationErrorToast,
  showModernStashReadOnlyToast,
} from '@/components/inventory/operationErrors';
import { findStackPickupSlots, type GridSize } from '@/components/inventory/spatialLayout';
import {
  isStackPickupDragState,
  type ResolvedStackPickupState,
  resolveStackPickupState,
} from '@/components/inventory/stackPickupDragState';
import {
  canDropItemCodeInModernResourceTab,
  normalizeResourceItemCode,
  resolveWithdrawCountForGridDrop,
} from '@/components/inventory/stashTabs';
import type { InventoryDragSync } from '@/components/inventory/useInventoryDragSync';
import type { StackPickupState } from '@/components/inventory/useStackPickup';
import { translations } from '@/i18n/translations';

export interface InventoryMoveActionsOptions {
  vaultItems: VaultItem[];
  pickupState: StackPickupState | undefined;
  consumePickup: (count: number) => void;
  dragSync: Pick<
    InventoryDragSync,
    | 'activeInventoryDragItem'
    | 'crossWindowInventoryDragItem'
    | 'resolvedStackPickupState'
    | 'clearInventoryDrag'
    | 'clearVaultDrag'
    | 'fetchSynchronizedStackPickup'
    | 'consumeSynchronizedStackPickup'
    | 'cancelStackPickup'
  >;
  reloadInventoryAfterSaveWrite: () => Promise<void>;
}

export interface InventoryMoveActions {
  moveInventoryItem: (
    inventoryItem: ActiveInventoryDragItem,
    targetFilePath: string,
    targetFileType: VaultSourceFileType,
    targetLocationContext: VaultLocationContext,
    targetStashTab: number | undefined,
    targetGridX: number | undefined,
    targetGridY: number | undefined,
    targetEquippedSlotId?: number,
  ) => Promise<void>;
  dropInventoryItemOnResourceTab: (
    event: DragEvent<HTMLDivElement>,
    targetFilePath: string,
    targetFileType: VaultSourceFileType,
    targetStashTab: number,
    targetGridX: number,
    targetGridY: number,
  ) => Promise<void>;
  dropVaultItemOnSection: (
    vaultItemId: string,
    targetFilePath: string,
    targetFileType: VaultSourceFileType,
    targetLocationContext: VaultLocationContext,
    targetStashTab: number | undefined,
    targetGridX: number,
    targetGridY: number,
  ) => Promise<void>;
  /** Places the picked-up stack units on a grid, starting at the clicked cell. */
  placeStackPickupOnGrid: (
    targetItems: ParsedInventoryItem[],
    gridSize: GridSize,
    targetFilePath: string,
    targetFileType: VaultSourceFileType,
    targetLocationContext: VaultLocationContext,
    targetStashTab?: number,
    preferredGridX?: number,
    preferredGridY?: number,
  ) => Promise<void>;
}

/**
 * Save file writes started from the boards: moving items, withdrawing vault items onto a grid,
 * and placing stack pickups. Only one write may be in flight: a second drop or click while the
 * first is still being written would act on stale positions and could place an item twice.
 *
 * @param options - Vault items, pickup state, drag sync and the reload after a write
 * @returns The write actions used by the boards
 */
export function useInventoryMoveActions({
  vaultItems,
  pickupState,
  consumePickup,
  dragSync,
  reloadInventoryAfterSaveWrite,
}: InventoryMoveActionsOptions): InventoryMoveActions {
  const { t } = useTranslation();
  const isWriteInFlightRef = useRef(false);
  const {
    activeInventoryDragItem,
    crossWindowInventoryDragItem,
    resolvedStackPickupState,
    clearInventoryDrag,
    clearVaultDrag,
    fetchSynchronizedStackPickup,
    consumeSynchronizedStackPickup,
    cancelStackPickup,
  } = dragSync;

  const moveInventoryItem = useCallback(
    async (
      inventoryItem: ActiveInventoryDragItem,
      targetFilePath: string,
      targetFileType: VaultSourceFileType,
      targetLocationContext: VaultLocationContext,
      targetStashTab: number | undefined,
      targetGridX: number | undefined,
      targetGridY: number | undefined,
      targetEquippedSlotId?: number,
    ): Promise<void> => {
      if (!window.electronAPI?.inventory?.moveItem) {
        return;
      }

      if (
        isSameInventoryMoveTarget(
          inventoryItem,
          targetFilePath,
          targetFileType,
          targetLocationContext,
          targetStashTab,
          targetGridX,
          targetGridY,
          targetEquippedSlotId,
        )
      ) {
        return;
      }

      if (isWriteInFlightRef.current) {
        return;
      }
      isWriteInFlightRef.current = true;

      try {
        await window.electronAPI.inventory.moveItem({
          sourceFilePath: inventoryItem.sourceFilePath,
          sourceFileType: inventoryItem.sourceFileType,
          rawItemJson: inventoryItem.rawItemJson,
          sourceStashTab: inventoryItem.sourceStashTab,
          targetFilePath,
          targetFileType,
          targetLocationContext,
          targetStashTab,
          targetGridX,
          targetGridY,
          targetEquippedSlotId,
        });
        window.electronAPI?.inventory.sendItemDragState({
          ...inventoryItem,
          active: false,
        });
        clearInventoryDrag();
        await reloadInventoryAfterSaveWrite();
      } catch (error) {
        if (isModernStashReadOnlyError(error)) {
          showModernStashReadOnlyToast(t);
          return;
        }
        if (showEquipValidationToastIfPresent(error, t)) {
          return;
        }

        console.error('Failed to move inventory item', error);
        showInventoryOperationErrorToast(error, t);
        await reloadInventoryAfterSaveWrite();
      } finally {
        isWriteInFlightRef.current = false;
      }
    },
    [clearInventoryDrag, reloadInventoryAfterSaveWrite, t],
  );

  const dropInventoryItemOnResourceTab = useCallback(
    async (
      event: DragEvent<HTMLDivElement>,
      targetFilePath: string,
      targetFileType: VaultSourceFileType,
      targetStashTab: number,
      targetGridX: number,
      targetGridY: number,
    ): Promise<void> => {
      const inventoryItem = resolveActiveInventoryDragItem(event, activeInventoryDragItem);
      if (!inventoryItem) {
        return;
      }

      const normalizedItemCode = normalizeResourceItemCode(inventoryItem.itemCode);
      if (
        !normalizedItemCode ||
        !canDropItemCodeInModernResourceTab(normalizedItemCode, targetStashTab)
      ) {
        return;
      }

      await moveInventoryItem(
        inventoryItem,
        targetFilePath,
        targetFileType,
        'stash',
        targetStashTab,
        targetGridX,
        targetGridY,
      );
    },
    [activeInventoryDragItem, moveInventoryItem],
  );

  const dropVaultItemOnSection = useCallback(
    async (
      vaultItemId: string,
      targetFilePath: string,
      targetFileType: VaultSourceFileType,
      targetLocationContext: VaultLocationContext,
      targetStashTab: number | undefined,
      targetGridX: number,
      targetGridY: number,
    ) => {
      if (isWriteInFlightRef.current) {
        return;
      }
      isWriteInFlightRef.current = true;

      try {
        const withdrawCount = resolveWithdrawCountForGridDrop(
          vaultItems.find((item) => item.id === vaultItemId),
        );
        const target = {
          targetFilePath,
          targetFileType,
          targetLocationContext,
          targetStashTab,
          targetGridX,
          targetGridY,
        };
        if (withdrawCount === undefined) {
          await window.electronAPI.vault.unvaultItem(vaultItemId, target);
        } else {
          await window.electronAPI.vault.unvaultItem(vaultItemId, target, withdrawCount);
        }
        clearVaultDrag();
        await reloadInventoryAfterSaveWrite();
      } catch (error) {
        if (isModernStashReadOnlyError(error)) {
          showModernStashReadOnlyToast(t);
          return;
        }
        console.error('Failed to unvault item to target', error);
        showInventoryOperationErrorToast(error, t);
        await reloadInventoryAfterSaveWrite();
      } finally {
        isWriteInFlightRef.current = false;
      }
    },
    [clearVaultDrag, reloadInventoryAfterSaveWrite, t, vaultItems],
  );

  const placeStackPickupOnGrid = useCallback(
    async (
      targetItems: ParsedInventoryItem[],
      gridSize: GridSize,
      targetFilePath: string,
      targetFileType: VaultSourceFileType,
      targetLocationContext: VaultLocationContext,
      targetStashTab?: number,
      preferredGridX?: number,
      preferredGridY?: number,
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this callback intentionally keeps split-target calculation, write call, and synchronized/local pickup state reconciliation in one transactional path.
    ): Promise<void> => {
      if (!window.electronAPI?.inventory?.splitStack) {
        return;
      }

      let effectivePickupState: ResolvedStackPickupState | undefined = resolvedStackPickupState;
      let synchronizedPickupItem = crossWindowInventoryDragItem;

      if (!effectivePickupState) {
        const fetchedSynchronizedPickupItem = await fetchSynchronizedStackPickup();
        if (fetchedSynchronizedPickupItem) {
          synchronizedPickupItem = fetchedSynchronizedPickupItem;
          effectivePickupState = resolveStackPickupState(undefined, fetchedSynchronizedPickupItem);
        }
      }

      if (!effectivePickupState) {
        return;
      }

      const slots = findStackPickupSlots(
        gridSize,
        targetItems,
        effectivePickupState.gridWidth,
        effectivePickupState.gridHeight,
        effectivePickupState.count,
        preferredGridX,
        preferredGridY,
      );

      if (slots.length === 0) {
        toast.warning(t(translations.inventoryBrowser.stackPickup.noSpace));
        return;
      }

      if (isWriteInFlightRef.current) {
        return;
      }
      isWriteInFlightRef.current = true;

      try {
        await window.electronAPI.inventory.splitStack({
          sourceFilePath: effectivePickupState.sourceFilePath,
          sourceFileType: effectivePickupState.sourceFileType,
          sourceStashTab: effectivePickupState.sourceStashTab,
          sourceItemCode: effectivePickupState.itemCode,
          sourceRawItemJson: effectivePickupState.sourceRawItemJson,
          splitCount: slots.length,
          targets: slots.map((slot) => ({
            targetFilePath,
            targetFileType,
            targetLocationContext,
            targetStashTab,
            targetGridX: slot.x,
            targetGridY: slot.y,
          })),
        });

        if (pickupState) {
          consumePickup(slots.length);
        } else if (isStackPickupDragState(synchronizedPickupItem)) {
          consumeSynchronizedStackPickup(synchronizedPickupItem, slots.length);
        }

        if (slots.length < effectivePickupState.count) {
          toast.info(
            t(translations.inventoryBrowser.stackPickup.partialPlace, {
              placed: slots.length,
              total: effectivePickupState.count,
            }),
          );
        } else {
          toast.success(
            t(translations.inventoryBrowser.stackPickup.placed, { count: slots.length }),
          );
        }

        await reloadInventoryAfterSaveWrite();
      } catch (error) {
        if (isModernStashReadOnlyError(error)) {
          showModernStashReadOnlyToast(t);
          cancelStackPickup();
          return;
        }
        console.error('Failed to split stack', error);
        showInventoryOperationErrorToast(error, t);
        await reloadInventoryAfterSaveWrite();
      } finally {
        isWriteInFlightRef.current = false;
      }
    },
    [
      cancelStackPickup,
      consumePickup,
      consumeSynchronizedStackPickup,
      crossWindowInventoryDragItem,
      fetchSynchronizedStackPickup,
      pickupState,
      reloadInventoryAfterSaveWrite,
      resolvedStackPickupState,
      t,
    ],
  );

  return {
    moveInventoryItem,
    dropInventoryItemOnResourceTab,
    dropVaultItemOnSection,
    placeStackPickupOnGrid,
  };
}
