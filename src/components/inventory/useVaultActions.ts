import type { VaultItemUpsertInput } from 'electron/types/grail';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isModernStashReadOnlyError,
  showInventoryOperationErrorToast,
  showModernStashReadOnlyToast,
} from '@/components/inventory/operationErrors';

export interface VaultActionsOptions {
  loadInventorySearch: () => Promise<void>;
  reloadInventoryAfterSaveWrite: () => Promise<void>;
}

export interface VaultActions {
  isVaulting: boolean;
  isUnvaulting: boolean;
  /** Fingerprints being vaulted right now; their tiles already count as vaulted. */
  pendingVaultFingerprints: Set<string>;
  vaultItem: (itemInput: VaultItemUpsertInput) => Promise<void>;
  /**
   * Moves a vaulted item back to its original save file position. `onUnvaulted` runs after the
   * write succeeded and before the inventory reloads.
   */
  unvaultItem: (vaultItemId: string, onUnvaulted: () => void) => Promise<void>;
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
        await window.electronAPI.vault.addItem(itemInput);
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
    [isVaulting, loadInventorySearch, reloadInventoryAfterSaveWrite, t],
  );

  const unvaultItem = useCallback(
    async (vaultItemId: string, onUnvaulted: () => void): Promise<void> => {
      if (isUnvaulting) {
        return;
      }

      setIsUnvaulting(true);
      try {
        await window.electronAPI.vault.unvaultItem(vaultItemId);
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
        setIsUnvaulting(false);
      }
    },
    [isUnvaulting, loadInventorySearch, reloadInventoryAfterSaveWrite, t],
  );

  return { isVaulting, isUnvaulting, pendingVaultFingerprints, vaultItem, unvaultItem };
}
