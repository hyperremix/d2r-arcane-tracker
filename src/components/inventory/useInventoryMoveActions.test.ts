import { act, renderHook } from '@testing-library/react';
import type { ParsedInventoryItem, VaultItem } from 'electron/types/grail';
import i18n from 'i18next';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveInventoryDragItem } from '@/components/inventory/dragPayloads';
import type { ResolvedStackPickupState } from '@/components/inventory/stackPickupDragState';
import { translations } from '@/i18n/translations';
import {
  type InventoryMoveActionsOptions,
  useInventoryMoveActions,
} from './useInventoryMoveActions';

const moveItem = vi.fn();
const splitStack = vi.fn();
const sendItemDragState = vi.fn();
const unvaultItem = vi.fn();
const reloadInventoryAfterSaveWrite = vi.fn();
const consumePickup = vi.fn();
const clearInventoryDrag = vi.fn();
const clearVaultDrag = vi.fn();
const fetchSynchronizedStackPickup = vi.fn();
const consumeSynchronizedStackPickup = vi.fn();
const cancelStackPickup = vi.fn();
const windowGlobals = window as unknown as { electronAPI: unknown };
let originalElectronAPI: unknown;

const DRAG_ITEM: ActiveInventoryDragItem = {
  fingerprint: 'fp-shako',
  sourceFilePath: '/saves/Hero.d2s',
  sourceFileType: 'd2s',
  sourceLocationContext: 'inventory',
  sourceGridX: 0,
  sourceGridY: 0,
  rawItemJson: '{"type":"uap"}',
  itemCode: 'uap',
  gridWidth: 2,
  gridHeight: 2,
};

const PICKUP_STATE: ResolvedStackPickupState = {
  fingerprint: 'fp-el',
  sourceFilePath: '/saves/Shared.d2i',
  sourceFileType: 'd2i',
  sourceStashTab: 7,
  sourceRawItemJson: '{"type":"r01"}',
  itemCode: 'r01',
  count: 3,
  maxCount: 10,
  itemName: 'El Rune',
  iconFileName: 'r01.png',
  gridWidth: 1,
  gridHeight: 1,
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderMoveActions(options: Partial<InventoryMoveActionsOptions> = {}) {
  return renderHook(() =>
    useInventoryMoveActions({
      vaultItems: [],
      pickupState: undefined,
      consumePickup,
      dragSync: baseDragSync(),
      reloadInventoryAfterSaveWrite,
      ...options,
    }),
  );
}

/** Moves the dragged item to inventory cell (5, 1) of the same character. */
function moveDragItem(actions: ReturnType<typeof renderMoveActions>['result']) {
  return actions.current.moveInventoryItem(
    DRAG_ITEM,
    '/saves/Hero.d2s',
    'd2s',
    'inventory',
    undefined,
    5,
    1,
  );
}

beforeEach(() => {
  originalElectronAPI = windowGlobals.electronAPI;
  moveItem.mockReset().mockResolvedValue(undefined);
  splitStack.mockReset().mockResolvedValue(undefined);
  sendItemDragState.mockReset();
  unvaultItem.mockReset().mockResolvedValue(undefined);
  reloadInventoryAfterSaveWrite.mockReset().mockResolvedValue(undefined);
  for (const spy of [
    consumePickup,
    clearInventoryDrag,
    clearVaultDrag,
    fetchSynchronizedStackPickup,
    consumeSynchronizedStackPickup,
    cancelStackPickup,
  ]) {
    spy.mockReset();
  }
  fetchSynchronizedStackPickup.mockResolvedValue(null);
  for (const method of ['success', 'info', 'warning', 'error'] as const) {
    vi.spyOn(toast, method).mockImplementation(() => 'toast-id');
  }
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  windowGlobals.electronAPI = {
    inventory: { moveItem, splitStack, sendItemDragState },
    vault: { unvaultItem },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  windowGlobals.electronAPI = originalElectronAPI;
});

describe('When an inventory item is moved', () => {
  it('Then the write carries source and target, the drag ends and the inventory reloads', async () => {
    // Arrange
    const { result } = renderMoveActions();

    // Act
    await act(async () => {
      await moveDragItem(result);
    });

    // Assert
    expect(moveItem).toHaveBeenCalledWith({
      sourceFilePath: '/saves/Hero.d2s',
      sourceFileType: 'd2s',
      rawItemJson: '{"type":"uap"}',
      sourceStashTab: undefined,
      targetFilePath: '/saves/Hero.d2s',
      targetFileType: 'd2s',
      targetLocationContext: 'inventory',
      targetStashTab: undefined,
      targetGridX: 5,
      targetGridY: 1,
      targetEquippedSlotId: undefined,
    });
    expect(sendItemDragState).toHaveBeenCalledWith({ ...DRAG_ITEM, active: false });
    expect(clearInventoryDrag).toHaveBeenCalledTimes(1);
    expect(reloadInventoryAfterSaveWrite).toHaveBeenCalledTimes(1);
  });

  it('If the target is the position the item already has, Then nothing is written', async () => {
    // Arrange
    const { result } = renderMoveActions();

    // Act
    await act(async () => {
      await result.current.moveInventoryItem(
        DRAG_ITEM,
        '/saves/Hero.d2s',
        'd2s',
        'inventory',
        undefined,
        0,
        0,
      );
    });

    // Assert
    expect(moveItem).not.toHaveBeenCalled();
  });

  it('If a write is already in flight, Then a second move is ignored until the first finishes', async () => {
    // Arrange
    const write = createDeferred<undefined>();
    moveItem.mockReturnValueOnce(write.promise);
    const { result } = renderMoveActions();
    let firstMove!: Promise<void>;
    act(() => {
      firstMove = moveDragItem(result);
    });

    // Act
    await act(async () => {
      await moveDragItem(result);
    });
    const callsWhileInFlight = moveItem.mock.calls.length;
    await act(async () => {
      write.resolve(undefined);
      await firstMove;
    });
    await act(async () => {
      await moveDragItem(result);
    });

    // Assert
    expect(callsWhileInFlight).toBe(1);
    expect(moveItem).toHaveBeenCalledTimes(2);
  });

  it('If a move is in flight, Then a vault withdrawal onto the grid is ignored', async () => {
    // Arrange
    const write = createDeferred<undefined>();
    moveItem.mockReturnValueOnce(write.promise);
    const { result } = renderMoveActions();
    let firstMove!: Promise<void>;
    act(() => {
      firstMove = moveDragItem(result);
    });

    // Act
    await act(async () => {
      await result.current.dropVaultItemOnSection(
        'v-1',
        '/saves/Hero.d2s',
        'd2s',
        'inventory',
        undefined,
        1,
        1,
      );
    });
    await act(async () => {
      write.resolve(undefined);
      await firstMove;
    });

    // Assert
    expect(unvaultItem).not.toHaveBeenCalled();
  });

  it('If the write fails, Then it shows the failure toast, reloads and allows the next write', async () => {
    // Arrange
    moveItem.mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderMoveActions();

    // Act
    await act(async () => {
      await moveDragItem(result);
    });
    await act(async () => {
      await moveDragItem(result);
    });

    // Assert
    expect(console.error).toHaveBeenCalledWith('Failed to move inventory item', expect.any(Error));
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.operationErrors.failed),
    );
    expect(moveItem).toHaveBeenCalledTimes(2);
    expect(clearInventoryDrag).toHaveBeenCalledTimes(1);
  });

  it('If the editor refuses the equip, Then it shows the equip toast without reloading', async () => {
    // Arrange
    moveItem.mockRejectedValue(new Error('EQUIP_VALIDATION:INVALID_SLOT'));
    const { result } = renderMoveActions();

    // Act
    await act(async () => {
      await result.current.moveInventoryItem(
        DRAG_ITEM,
        '/saves/Hero.d2s',
        'd2s',
        'equipped',
        undefined,
        undefined,
        undefined,
        3,
      );
    });

    // Assert
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.equipValidation.title),
      { description: i18n.t(translations.inventoryBrowser.equipValidation.reasons.invalidSlot) },
    );
    expect(reloadInventoryAfterSaveWrite).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('If the stash is read-only, Then it shows the read-only toast without reloading', async () => {
    // Arrange
    moveItem.mockRejectedValue(new Error('MODERN_STASH_READ_ONLY'));
    const { result } = renderMoveActions();

    // Act
    await act(async () => {
      await moveDragItem(result);
    });

    // Assert
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.modernStashReadOnlyError),
    );
    expect(reloadInventoryAfterSaveWrite).not.toHaveBeenCalled();
  });
});

describe('When a vault item is dropped on a grid', () => {
  const target = {
    targetFilePath: '/saves/Hero.d2s',
    targetFileType: 'd2s',
    targetLocationContext: 'inventory',
    targetStashTab: undefined,
    targetGridX: 2,
    targetGridY: 3,
  };

  function dropOnGrid(actions: ReturnType<typeof renderMoveActions>['result']) {
    return actions.current.dropVaultItemOnSection(
      'v-1',
      '/saves/Hero.d2s',
      'd2s',
      'inventory',
      undefined,
      2,
      3,
    );
  }

  it('Then the vault item is unvaulted onto the cell, the drag ends and the inventory reloads', async () => {
    // Arrange
    const vaultItem = { id: 'v-1', itemCode: 'uap', stackCount: 1 } as VaultItem;
    const { result } = renderMoveActions({ vaultItems: [vaultItem] });

    // Act
    await act(async () => {
      await dropOnGrid(result);
    });

    // Assert
    expect(unvaultItem).toHaveBeenCalledWith('v-1', target);
    expect(clearVaultDrag).toHaveBeenCalledTimes(1);
    expect(reloadInventoryAfterSaveWrite).toHaveBeenCalledTimes(1);
  });

  it('If the vault item is a resource stack, Then exactly one unit is withdrawn', async () => {
    // Arrange
    const vaultItem = { id: 'v-1', itemCode: 'r01', stackCount: 5 } as VaultItem;
    const { result } = renderMoveActions({ vaultItems: [vaultItem] });

    // Act
    await act(async () => {
      await dropOnGrid(result);
    });

    // Assert
    expect(unvaultItem).toHaveBeenCalledWith('v-1', target, 1);
  });

  it('If the unvault fails, Then it shows the failure toast and reloads the inventory', async () => {
    // Arrange
    unvaultItem.mockRejectedValue(new Error('TARGET_CELL_OCCUPIED'));
    const { result } = renderMoveActions();

    // Act
    await act(async () => {
      await dropOnGrid(result);
    });

    // Assert
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.operationErrors.targetOccupied),
    );
    expect(clearVaultDrag).not.toHaveBeenCalled();
    expect(reloadInventoryAfterSaveWrite).toHaveBeenCalledTimes(1);
  });
});

describe('When a picked-up stack is placed on a grid', () => {
  const GRID = { columns: 10, rows: 4 };

  function placeStack(
    actions: ReturnType<typeof renderMoveActions>['result'],
    gridSize = GRID,
    targetItems: ParsedInventoryItem[] = [],
  ) {
    return actions.current.placeStackPickupOnGrid(
      targetItems,
      gridSize,
      '/saves/Hero.d2s',
      'd2s',
      'inventory',
      undefined,
      2,
      1,
    );
  }

  it('Then one unit is placed per cell starting at the clicked cell and the local pickup is consumed', async () => {
    // Arrange
    const pickupState = { count: 3 } as InventoryMoveActionsOptions['pickupState'];
    const { result } = renderMoveActions({
      pickupState,
      dragSync: {
        ...baseDragSync(),
        resolvedStackPickupState: PICKUP_STATE,
      },
    });

    // Act
    await act(async () => {
      await placeStack(result);
    });

    // Assert
    const request = splitStack.mock.calls[0][0];
    expect(request).toMatchObject({
      sourceFilePath: '/saves/Shared.d2i',
      sourceFileType: 'd2i',
      sourceStashTab: 7,
      sourceItemCode: 'r01',
      splitCount: 3,
    });
    expect(request.targets).toHaveLength(3);
    expect(request.targets[0]).toMatchObject({
      targetFilePath: '/saves/Hero.d2s',
      targetGridX: 2,
      targetGridY: 1,
    });
    expect(consumePickup).toHaveBeenCalledWith(3);
    expect(toast.success).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.stackPickup.placed, { count: 3 }),
    );
    expect(reloadInventoryAfterSaveWrite).toHaveBeenCalledTimes(1);
  });

  it('If the grid has room for only some units, Then it places those and reports a partial placement', async () => {
    // Arrange
    const { result } = renderMoveActions({
      dragSync: { ...baseDragSync(), resolvedStackPickupState: PICKUP_STATE },
    });

    // Act
    await act(async () => {
      await placeStack(result, { columns: 2, rows: 1 });
    });

    // Assert
    expect(splitStack.mock.calls[0][0].splitCount).toBe(2);
    expect(toast.info).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.stackPickup.partialPlace, { placed: 2, total: 3 }),
    );
  });

  it('If the grid has no room, Then it warns and writes nothing', async () => {
    // Arrange
    const { result } = renderMoveActions({
      dragSync: { ...baseDragSync(), resolvedStackPickupState: PICKUP_STATE },
    });

    // Act
    await act(async () => {
      await placeStack(result, { columns: 0, rows: 0 });
    });

    // Assert
    expect(toast.warning).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.stackPickup.noSpace),
    );
    expect(splitStack).not.toHaveBeenCalled();
  });

  it('If no pickup is active locally or in another window, Then nothing is written', async () => {
    // Arrange
    const { result } = renderMoveActions();

    // Act
    await act(async () => {
      await placeStack(result);
    });

    // Assert
    expect(fetchSynchronizedStackPickup).toHaveBeenCalledTimes(1);
    expect(splitStack).not.toHaveBeenCalled();
  });

  it('If the pickup comes from another window, Then it is fetched and consumed there', async () => {
    // Arrange
    const synchronizedPickup: ActiveInventoryDragItem = {
      ...DRAG_ITEM,
      fingerprint: 'fp-el',
      sourceFilePath: '/saves/Shared.d2i',
      sourceFileType: 'd2i',
      sourceStashTab: 7,
      itemCode: 'r01',
      gridWidth: 1,
      gridHeight: 1,
      stackPickup: true,
      stackPickupCount: 2,
      stackPickupMaxCount: 10,
    };
    fetchSynchronizedStackPickup.mockResolvedValue(synchronizedPickup);
    const { result } = renderMoveActions();

    // Act
    await act(async () => {
      await placeStack(result);
    });

    // Assert
    expect(splitStack.mock.calls[0][0].splitCount).toBe(2);
    expect(consumeSynchronizedStackPickup).toHaveBeenCalledWith(synchronizedPickup, 2);
    expect(consumePickup).not.toHaveBeenCalled();
  });

  it('If a write is already in flight, Then placing the stack is ignored', async () => {
    // Arrange
    const write = createDeferred<undefined>();
    moveItem.mockReturnValueOnce(write.promise);
    const { result } = renderMoveActions({
      dragSync: { ...baseDragSync(), resolvedStackPickupState: PICKUP_STATE },
    });
    let firstMove!: Promise<void>;
    act(() => {
      firstMove = moveDragItem(result);
    });

    // Act
    await act(async () => {
      await placeStack(result);
    });
    await act(async () => {
      write.resolve(undefined);
      await firstMove;
    });

    // Assert
    expect(splitStack).not.toHaveBeenCalled();
  });

  it('If the stash is read-only, Then it shows the read-only toast and cancels the pickup', async () => {
    // Arrange
    splitStack.mockRejectedValue(new Error('MODERN_STASH_READ_ONLY'));
    const { result } = renderMoveActions({
      dragSync: { ...baseDragSync(), resolvedStackPickupState: PICKUP_STATE },
    });

    // Act
    await act(async () => {
      await placeStack(result);
    });

    // Assert
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.modernStashReadOnlyError),
    );
    expect(cancelStackPickup).toHaveBeenCalledTimes(1);
    expect(reloadInventoryAfterSaveWrite).not.toHaveBeenCalled();
  });

  it('If the write fails, Then it shows the failure toast and reloads', async () => {
    // Arrange
    splitStack.mockRejectedValue(new Error('disk full'));
    const { result } = renderMoveActions({
      dragSync: { ...baseDragSync(), resolvedStackPickupState: PICKUP_STATE },
    });

    // Act
    await act(async () => {
      await placeStack(result);
    });

    // Assert
    expect(console.error).toHaveBeenCalledWith('Failed to split stack', expect.any(Error));
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t(translations.inventoryBrowser.operationErrors.failed),
    );
    expect(reloadInventoryAfterSaveWrite).toHaveBeenCalledTimes(1);
    expect(consumePickup).not.toHaveBeenCalled();
  });
});

function baseDragSync(): InventoryMoveActionsOptions['dragSync'] {
  return {
    activeInventoryDragItem: null,
    crossWindowInventoryDragItem: null,
    resolvedStackPickupState: undefined,
    clearInventoryDrag,
    clearVaultDrag,
    fetchSynchronizedStackPickup,
    consumeSynchronizedStackPickup,
    cancelStackPickup,
  };
}
