import { act, renderHook, waitFor } from '@testing-library/react';
import type { VaultItem, VaultItemUpsertInput } from 'electron/types/grail';
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
const MANUAL_VAULT_ITEM = {
  id: 'vault-1',
  itemName: 'Shako',
  sourceFileType: 'd2s',
  locationContext: 'inventory',
} as VaultItem;
const SAVE_FILE_ORIGIN = {
  sourceFilePath: '/saves/Sorc.d2s',
  sourceFileType: 'd2s',
  locationContext: 'inventory',
  gridX: 3,
  gridY: 1,
} as const;
const SAVE_FILE_VAULT_ITEM = {
  ...MANUAL_VAULT_ITEM,
  id: 'vault-save',
  ...SAVE_FILE_ORIGIN,
} as VaultItem;
const RESTORE_TARGET = {
  targetFilePath: '/saves/Sorc.d2s',
  targetFileType: 'd2s',
  targetLocationContext: 'inventory',
  targetGridX: 3,
  targetGridY: 1,
};

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

describe('When an item is vaulted out of a save file', () => {
  const SAVE_FILE_INPUT = { ...ITEM_INPUT, ...SAVE_FILE_ORIGIN } as VaultItemUpsertInput;

  function getSuccessToastOptions() {
    const call = vi.mocked(toast.success).mock.calls[0];
    return call?.[1] as { action?: { label: string; onClick: () => void } } | undefined;
  }

  it('If the vault row keeps its grid origin, Then the success toast offers an undo that puts it back', async () => {
    // Arrange
    addItem.mockResolvedValue(SAVE_FILE_VAULT_ITEM);
    const { result } = renderVaultActions();
    await act(async () => {
      await result.current.vaultItem(SAVE_FILE_INPUT);
    });
    const action = getSuccessToastOptions()?.action;

    // Act
    await act(async () => {
      action?.onClick();
    });

    // Assert
    expect(toast.success).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.vaultFeedback.vaulted, { itemName: 'Shako' }),
      expect.anything(),
    );
    expect(action?.label).toBe(i18n.t(translations.inventoryBrowser.vaultFeedback.undo));
    await waitFor(() => expect(unvaultItem).toHaveBeenCalledWith('vault-save', RESTORE_TARGET, 1));
    await waitFor(() => expect(reloadInventoryAfterSaveWrite).toHaveBeenCalledTimes(1));
  });

  it('If a stack became its own row and the row grew before the undo, Then the undo only takes out the units this vault added', async () => {
    // Arrange
    // Another stack of the same item merges into the row after this toast (the toast still holds
    // the snapshot with the original count), so a whole-row withdraw would write both stacks.
    const stackInput = { ...SAVE_FILE_INPUT, stackCount: 2 } as VaultItemUpsertInput;
    addItem.mockResolvedValue({ ...SAVE_FILE_VAULT_ITEM, stackCount: 2 });
    const { result } = renderVaultActions();
    await act(async () => {
      await result.current.vaultItem(stackInput);
    });
    const action = getSuccessToastOptions()?.action;

    // Act
    await act(async () => {
      action?.onClick();
    });

    // Assert
    await waitFor(() => expect(unvaultItem).toHaveBeenCalledWith('vault-save', RESTORE_TARGET, 2));
  });

  it('If a natively stackable item is undone, Then the undo takes out the whole stack it added', async () => {
    // Arrange
    const rawItemJson = '{"code":"key","quantity":12}';
    const keyInput = { ...SAVE_FILE_INPUT, rawItemJson } as VaultItemUpsertInput;
    addItem.mockResolvedValue({ ...SAVE_FILE_VAULT_ITEM, rawItemJson, stackCount: 12 });
    const { result } = renderVaultActions();
    await act(async () => {
      await result.current.vaultItem(keyInput);
    });
    const action = getSuccessToastOptions()?.action;

    // Act
    await act(async () => {
      action?.onClick();
    });

    // Assert
    await waitFor(() => expect(unvaultItem).toHaveBeenCalledWith('vault-save', RESTORE_TARGET, 12));
  });

  it('If the item was merged into an existing vaulted stack, Then the success toast has no undo', async () => {
    // Arrange
    const stackInput = { ...SAVE_FILE_INPUT, stackCount: 2 } as VaultItemUpsertInput;
    addItem.mockResolvedValue({ ...SAVE_FILE_VAULT_ITEM, stackCount: 5 });
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.vaultItem(stackInput);
    });

    // Assert
    expect(toast.success).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.vaultFeedback.vaulted, { itemName: 'Shako' }),
    );
    expect(getSuccessToastOptions()).toBeUndefined();
  });

  it('If a stack became its own vault row, Then the success toast still offers an undo', async () => {
    // Arrange
    const stackInput = { ...SAVE_FILE_INPUT, stackCount: 2 } as VaultItemUpsertInput;
    addItem.mockResolvedValue({ ...SAVE_FILE_VAULT_ITEM, stackCount: 2 });
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.vaultItem(stackInput);
    });

    // Assert
    expect(getSuccessToastOptions()?.action?.label).toBe(
      i18n.t(translations.inventoryBrowser.vaultFeedback.undo),
    );
  });

  it('If a natively stackable item without a sent stack count became its own row, Then the success toast offers an undo', async () => {
    // Arrange
    const rawItemJson = '{"code":"key","quantity":12}';
    const keyInput = { ...SAVE_FILE_INPUT, rawItemJson } as VaultItemUpsertInput;
    addItem.mockResolvedValue({ ...SAVE_FILE_VAULT_ITEM, rawItemJson, stackCount: 12 });
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.vaultItem(keyInput);
    });

    // Assert
    expect(getSuccessToastOptions()?.action?.label).toBe(
      i18n.t(translations.inventoryBrowser.vaultFeedback.undo),
    );
  });

  it('If the origin cannot be restored, Then the success toast has no undo', async () => {
    // Arrange
    addItem.mockResolvedValue({
      ...SAVE_FILE_VAULT_ITEM,
      locationContext: 'equipped',
      equippedSlotId: 1,
    });
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.vaultItem({ ...SAVE_FILE_INPUT, locationContext: 'equipped' });
    });

    // Assert
    expect(toast.success).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.vaultFeedback.vaulted, { itemName: 'Shako' }),
    );
    expect(getSuccessToastOptions()).toBeUndefined();
  });

  it('If the item did not come from a save file, Then no success toast is shown', async () => {
    // Arrange
    addItem.mockResolvedValue(MANUAL_VAULT_ITEM);
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.vaultItem(ITEM_INPUT);
    });

    // Assert
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('When a vault item is unvaulted', () => {
  it('Then onUnvaulted runs after the write and before the inventory reloads', async () => {
    // Arrange
    const onUnvaulted = vi.fn();
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.unvaultItem(MANUAL_VAULT_ITEM, onUnvaulted);
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
      unvaulting = result.current.unvaultItem(MANUAL_VAULT_ITEM, vi.fn());
    });

    // Act
    await act(async () => {
      await result.current.unvaultItem({ ...MANUAL_VAULT_ITEM, id: 'vault-2' }, vi.fn());
    });
    await act(async () => {
      write.resolve(undefined);
      await unvaulting;
    });

    // Assert
    expect(unvaultItem).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.vaultFeedback.unvaultBusy),
    );
  });

  it('If the stash is read-only, Then it shows the read-only toast and does not run onUnvaulted', async () => {
    // Arrange
    unvaultItem.mockRejectedValue(new Error('MODERN_STASH_READ_ONLY'));
    const onUnvaulted = vi.fn();
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.unvaultItem(MANUAL_VAULT_ITEM, onUnvaulted);
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
      await result.current.unvaultItem(MANUAL_VAULT_ITEM, onUnvaulted);
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

describe('When an item that was taken out of a save file is unvaulted', () => {
  it('If its origin is a grid position, Then it is written back there and a success toast is shown', async () => {
    // Arrange
    const onUnvaulted = vi.fn();
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.unvaultItem(SAVE_FILE_VAULT_ITEM, onUnvaulted);
    });

    // Assert
    expect(unvaultItem).toHaveBeenCalledWith('vault-save', RESTORE_TARGET);
    expect(toast.success).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.vaultFeedback.restored, { itemName: 'Shako' }),
    );
    expect(onUnvaulted).toHaveBeenCalledTimes(1);
    expect(reloadInventoryAfterSaveWrite).toHaveBeenCalledTimes(1);
  });

  it('If its origin cannot be restored, Then nothing is written and the drag hint is shown', async () => {
    // Arrange
    const onUnvaulted = vi.fn();
    const { result } = renderVaultActions();

    // Act
    await act(async () => {
      await result.current.unvaultItem(
        { ...SAVE_FILE_VAULT_ITEM, locationContext: 'mercenary' },
        onUnvaulted,
      );
    });

    // Assert
    expect(unvaultItem).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.operationErrors.unvaultNeedsPosition),
    );
    expect(onUnvaulted).not.toHaveBeenCalled();
    expect(result.current.isUnvaulting).toBe(false);
  });
});
