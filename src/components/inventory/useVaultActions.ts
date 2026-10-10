import type { VaultItem, VaultItemUpsertInput } from 'electron/types/grail';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  isModernStashReadOnlyError,
  showInventoryOperationErrorToast,
  showModernStashReadOnlyToast,
} from '@/components/inventory/operationErrors';
import {
  isVaultedFromSaveFile,
  isVaultRowCreatedByAdd,
  resolveVaultRestoreTarget,
} from '@/components/inventory/vaultRestore';
import { translations } from '@/i18n/translations';

export interface VaultActionsOptions {
  loadInventorySearch: () => Promise<void>;
  reloadInventoryAfterSaveWrite: () => Promise<void>;
}

export interface VaultActions {
  isVaulting: boolean;
  isUnvaulting: boolean;
  /** Fingerprints being vaulted right now; their tiles already count as vaulted. */
  pendingVaultFingerprints: Set<string>;
  /**
   * Vaults an item. When it was taken out of a save file, a success toast says so and offers to
   * undo the change while the original position is known. A stack that was merged into an existing
   * vault row has no undo: that row also holds other units and the first stack's origin.
   */
  vaultItem: (itemInput: VaultItemUpsertInput) => Promise<void>;
  /**
   * Takes an item out of the vault: an item that was taken out of a save file goes back to its
   * original position (see `resolveVaultRestoreTarget`), any other row is only marked unvaulted.
   * `onUnvaulted` runs after the write succeeded and before the inventory reloads.
   */
  unvaultItem: (vaultItem: VaultItem, onUnvaulted: () => void) => Promise<void>;
}

/**
 * Vaults inventory items and unvaults vault items, with one write of each kind at a time.
 *
 * @param options - Functions that reload the search after a write
 * @returns Busy flags, pending fingerprints and the vault/unvault actions
 */
export function useVaultActions({
  loadInventorySearch,
  reloadInventoryAfterSaveWrite,
}: VaultActionsOptions): VaultActions {
  const { t } = useTranslation();
  const [isVaulting, setIsVaulting] = useState(false);
  const [isUnvaulting, setIsUnvaulting] = useState(false);
  const [pendingVaultFingerprints, setPendingVaultFingerprints] = useState<Set<string>>(new Set());
  // The undo action of a toast runs long after the render that created it, so the in-flight guard
  // must not depend on render state.
  const isUnvaultInFlightRef = useRef(false);

  const unvaultItem = useCallback(
    async (vaultItem: VaultItem, onUnvaulted: () => void): Promise<void> => {
      if (isUnvaultInFlightRef.current) {
        toast.info(t(translations.inventoryBrowser.vaultFeedback.unvaultBusy));
        return;
      }

      const fromSaveFile = isVaultedFromSaveFile(vaultItem);
      const restoreTarget = fromSaveFile ? resolveVaultRestoreTarget(vaultItem) : undefined;
      if (fromSaveFile && !restoreTarget) {
        toast.error(t(translations.inventoryBrowser.operationErrors.unvaultNeedsPosition));
        return;
      }

      isUnvaultInFlightRef.current = true;
      setIsUnvaulting(true);
      try {
        if (restoreTarget) {
          await window.electronAPI.vault.unvaultItem(vaultItem.id, restoreTarget);
          toast.success(
            t(translations.inventoryBrowser.vaultFeedback.restored, {
              itemName: vaultItem.itemName,
            }),
          );
        } else {
          await window.electronAPI.vault.unvaultItem(vaultItem.id);
        }
        onUnvaulted();
        await reloadInventoryAfterSaveWrite();
      } catch (error) {
        if (isModernStashReadOnlyError(error)) {
          showModernStashReadOnlyToast(t);
          return;
        }
        console.error('Failed to unvault item', error);
        showInventoryOperationErrorToast(error, t);
        await loadInventorySearch();
      } finally {
        isUnvaultInFlightRef.current = false;
        setIsUnvaulting(false);
      }
    },
    [loadInventorySearch, reloadInventoryAfterSaveWrite, t],
  );

  // The undo action uses the latest unvault function, so it reloads with the current filters.
  const latestUnvaultItemRef = useRef(unvaultItem);
  useEffect(() => {
    latestUnvaultItemRef.current = unvaultItem;
  }, [unvaultItem]);

  const showVaultedFromSaveFileToast = useCallback(
    (itemInput: VaultItemUpsertInput, savedItem: VaultItem | undefined): void => {
      const message = t(translations.inventoryBrowser.vaultFeedback.vaulted, {
        itemName: itemInput.itemName,
      });
      const canUndo =
        savedItem !== undefined &&
        isVaultRowCreatedByAdd(itemInput, savedItem) &&
        resolveVaultRestoreTarget(savedItem) !== undefined;

      if (!canUndo) {
        toast.success(message);
        return;
      }

      toast.success(message, {
        action: {
          label: t(translations.inventoryBrowser.vaultFeedback.undo),
          onClick: () => {
            void latestUnvaultItemRef.current(savedItem, () => undefined);
          },
        },
      });
    },
    [t],
  );

  const vaultItem = useCallback(
    async (itemInput: VaultItemUpsertInput): Promise<void> => {
      if (isVaulting) {
        return;
      }

      setIsVaulting(true);
      setPendingVaultFingerprints((previous) => {
        const next = new Set(previous);
        next.add(itemInput.fingerprint);
        return next;
      });

      try {
        const savedItem = await window.electronAPI.vault.addItem(itemInput);
        if (isVaultedFromSaveFile(itemInput)) {
          showVaultedFromSaveFileToast(itemInput, savedItem);
        }
        await loadInventorySearch();
      } catch (error) {
        if (isModernStashReadOnlyError(error)) {
          showModernStashReadOnlyToast(t);
          return;
        }
        console.error('Failed to vault inventory item', error);
        showInventoryOperationErrorToast(error, t);
        await reloadInventoryAfterSaveWrite();
      } finally {
        setPendingVaultFingerprints((previous) => {
          if (!previous.has(itemInput.fingerprint)) {
            return previous;
          }

          const next = new Set(previous);
          next.delete(itemInput.fingerprint);
          return next;
        });
        setIsVaulting(false);
      }
    },
    [
      isVaulting,
      loadInventorySearch,
      reloadInventoryAfterSaveWrite,
      showVaultedFromSaveFileToast,
      t,
    ],
  );

  return { isVaulting, isUnvaulting, pendingVaultFingerprints, vaultItem, unvaultItem };
}
