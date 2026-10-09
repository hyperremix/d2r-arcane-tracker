import { act, renderHook, waitFor } from '@testing-library/react';
import type { VaultItemUpsertInput } from 'electron/types/grail';
import i18n from 'i18next';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translations } from '@/i18n/translations';
import { useVaultActions } from './useVaultActions';

const addItem = vi.fn();
const unvaultItem = vi.fn();
const loadInventorySearch = vi.fn();
const reloadInventoryAfterSaveWrite = vi.fn();
const windowGlobals = window as unknown as { electronAPI: unknown };
let originalElectronAPI: unknown;

const ITEM_INPUT = { fingerprint: 'fp-shako', itemName: 'Shako' } as VaultItemUpsertInput;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderVaultActions() {
  return renderHook(() => useVaultActions({ loadInventorySearch, reloadInventoryAfterSaveWrite }));
}

beforeEach(() => {
  originalElectronAPI = windowGlobals.electronAPI;
  addItem.mockReset().mockResolvedValue(undefined);
  unvaultItem.mockReset().mockResolvedValue(undefined);
  loadInventorySearch.mockReset().mockResolvedValue(undefined);
  reloadInventoryAfterSaveWrite.mockReset().mockResolvedValue(undefined);
  for (const method of ['success', 'info', 'warning', 'error'] as const) {
    vi.spyOn(toast, method).mockImplementation(() => 'toast-id');
  }
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  windowGlobals.electronAPI = { vault: { addItem, unvaultItem } };
});

afterEach(() => {
  vi.restoreAllMocks();
  windowGlobals.electronAPI = originalElectronAPI;
});

describe('When an inventory item is vaulted', () => {
  it('Then its fingerprint is pending until the write finishes and the search reloads', async () => {
    // Arrange
    const write = createDeferred<undefined>();
    addItem.mockReturnValue(write.promise);
    const { result } = renderVaultActions();

    // Act
    let vaulting!: Promise<void>;
    act(() => {
      vaulting = result.current.vaultItem(ITEM_INPUT);
    });
    const duringWrite = {
      pending: [...result.current.pendingVaultFingerprints],
      isVaulting: result.current.isVaulting,
    };
    await act(async () => {
      write.resolve(undefined);
      await vaulting;
    });

    // Assert
    expect(duringWrite).toEqual({ pending: ['fp-shako'], isVaulting: true });
    expect(addItem).toHaveBeenCalledWith(ITEM_INPUT);
    expect(loadInventorySearch).toHaveBeenCalledTimes(1);
    expect(reloadInventoryAfterSaveWrite).not.toHaveBeenCalled();
    expect(result.current.pendingVaultFingerprints.size).toBe(0);
    expect(result.current.isVaulting).toBe(false);
  });

  it('If another vault starts while one is running, Then it is ignored', async () => {
    // Arrange
    const write = createDeferred<undefined>();
    addItem.mockReturnValue(write.promise);
    const { result } = renderVaultActions();
    let vaulting!: Promise<void>;
    act(() => {
      vaulting = result.current.vaultItem(ITEM_INPUT);
    });

    // Act
    await act(async () => {
      await result.current.vaultItem({ ...ITEM_INPUT, fingerprint: 'fp-other' });
    });
    await act(async () => {
      write.resolve(undefined);
      await vaulting;
    });

    // Assert
    expect(addItem).toHaveBeenCalledTimes(1);
  });

  it('If the stash is read-only, Then it shows the read-only toast without logging or reloading', async () => {
    // Arrange
    addItem.mockRejectedValue(new Error('MODERN_STASH_READ_ONLY'));
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.vaultItem(ITEM_INPUT);
    });

    // Assert
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.modernStashReadOnlyError),
    );
    expect(console.error).not.toHaveBeenCalled();
    expect(loadInventorySearch).not.toHaveBeenCalled();
    expect(reloadInventoryAfterSaveWrite).not.toHaveBeenCalled();
    expect(result.current.pendingVaultFingerprints.size).toBe(0);
    expect(result.current.isVaulting).toBe(false);
  });

  it('If the write fails, Then it shows the failure toast, rescans and clears the pending fingerprint', async () => {
    // Arrange
    addItem.mockRejectedValue(new Error('disk full'));
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.vaultItem(ITEM_INPUT);
    });

    // Assert
    expect(console.error).toHaveBeenCalledWith('Failed to vault inventory item', expect.any(Error));
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.operationErrors.failed),
    );
    expect(reloadInventoryAfterSaveWrite).toHaveBeenCalledTimes(1);
    expect(result.current.pendingVaultFingerprints.size).toBe(0);
    expect(result.current.isVaulting).toBe(false);
  });
});

describe('When a vault item is unvaulted', () => {
  it('Then onUnvaulted runs after the write and before the inventory reloads', async () => {
    // Arrange
    const onUnvaulted = vi.fn();
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.unvaultItem('vault-1', onUnvaulted);
    });

    // Assert
    expect(unvaultItem).toHaveBeenCalledWith('vault-1');
    expect(onUnvaulted).toHaveBeenCalledTimes(1);
    expect(unvaultItem.mock.invocationCallOrder[0]).toBeLessThan(
      onUnvaulted.mock.invocationCallOrder[0],
    );
    expect(onUnvaulted.mock.invocationCallOrder[0]).toBeLessThan(
      reloadInventoryAfterSaveWrite.mock.invocationCallOrder[0],
    );
    await waitFor(() => expect(result.current.isUnvaulting).toBe(false));
  });

  it('If another unvault starts while one is running, Then it is ignored', async () => {
    // Arrange
    const write = createDeferred<undefined>();
    unvaultItem.mockReturnValue(write.promise);
    const { result } = renderVaultActions();
    let unvaulting!: Promise<void>;
    act(() => {
      unvaulting = result.current.unvaultItem('vault-1', vi.fn());
    });

    // Act
    await act(async () => {
      await result.current.unvaultItem('vault-2', vi.fn());
    });
    await act(async () => {
      write.resolve(undefined);
      await unvaulting;
    });

    // Assert
    expect(unvaultItem).toHaveBeenCalledTimes(1);
  });

  it('If the stash is read-only, Then it shows the read-only toast and does not run onUnvaulted', async () => {
    // Arrange
    unvaultItem.mockRejectedValue(new Error('MODERN_STASH_READ_ONLY'));
    const onUnvaulted = vi.fn();
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.unvaultItem('vault-1', onUnvaulted);
    });

    // Assert
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.modernStashReadOnlyError),
    );
    expect(onUnvaulted).not.toHaveBeenCalled();
    expect(loadInventorySearch).not.toHaveBeenCalled();
    expect(result.current.isUnvaulting).toBe(false);
  });

  it('If the write fails, Then it shows the failure toast and reloads the search', async () => {
    // Arrange
    unvaultItem.mockRejectedValue(new Error('Vault item not found'));
    const onUnvaulted = vi.fn();
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.unvaultItem('vault-1', onUnvaulted);
    });

    // Assert
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.operationErrors.itemChanged),
    );
    expect(onUnvaulted).not.toHaveBeenCalled();
    expect(loadInventorySearch).toHaveBeenCalledTimes(1);
    expect(result.current.isUnvaulting).toBe(false);
  });
});
