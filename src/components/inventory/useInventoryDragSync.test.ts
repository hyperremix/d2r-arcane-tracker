import { act, renderHook, waitFor } from '@testing-library/react';
import { INVENTORY_DRAG_STATE_CHANNEL, VAULT_DRAG_STATE_CHANNEL } from 'electron/ipc/contract';
import type { ParsedInventoryItem } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMainEventsMock } from '@/test/mainEventsMock';
import { type InventoryDragSyncOptions, useInventoryDragSync } from './useInventoryDragSync';
import type { StackPickupState } from './useStackPickup';

const mainEvents = createMainEventsMock();
const sendItemDragState = vi.fn();
const sendVaultDragState = vi.fn();
const getActiveDragState = vi.fn();
const windowGlobals = window as unknown as { electronAPI: unknown };
let originalElectronAPI: unknown;

const pickupState: StackPickupState = {
  itemCode: 'r01',
  sourceItem: {
    fingerprint: 'fp-el',
    sourceFilePath: '/saves/Shared.d2i',
    sourceFileType: 'd2i',
    locationContext: 'stash',
    stashTab: 7,
    rawItemJson: '{"type":"r01"}',
  } as ParsedInventoryItem,
  count: 4,
  maxCount: 10,
  iconFileName: 'r01.png',
  itemName: 'El Rune',
  gridWidth: 1,
  gridHeight: 1,
};

function renderDragSync(options: Partial<InventoryDragSyncOptions> = {}) {
  const cancelPickup = vi.fn();
  const consumePickup = vi.fn();
  const hook = renderHook((props: InventoryDragSyncOptions) => useInventoryDragSync(props), {
    initialProps: { pickupState: undefined, cancelPickup, consumePickup, ...options },
  });

  return { ...hook, cancelPickup, consumePickup };
}

beforeEach(() => {
  originalElectronAPI = windowGlobals.electronAPI;
  mainEvents.reset();
  sendItemDragState.mockReset();
  sendVaultDragState.mockReset();
  getActiveDragState.mockReset().mockResolvedValue({});
  windowGlobals.electronAPI = {
    on: mainEvents.on,
    inventory: { sendItemDragState, sendVaultDragState, getActiveDragState },
  };
});

afterEach(() => {
  windowGlobals.electronAPI = originalElectronAPI;
});

describe('When another window reports a drag', () => {
  it('Then the vault item it drags is active until it reports the drag ended', async () => {
    // Arrange
    const { result } = renderDragSync();
    await waitFor(() => expect(getActiveDragState).toHaveBeenCalled());

    // Act
    act(() => {
      mainEvents.emit(VAULT_DRAG_STATE_CHANNEL, { active: true, id: 'v-1', gridWidth: 2 });
    });
    const duringDrag = result.current.activeVaultDragItem;
    act(() => {
      mainEvents.emit(VAULT_DRAG_STATE_CHANNEL, { active: false, id: 'v-1' });
    });

    // Assert
    expect(duringDrag).toEqual({ active: true, id: 'v-1', gridWidth: 2, gridHeight: 1 });
    expect(result.current.activeVaultDragItem).toBeNull();
  });

  it('Then a drag that was already running when the window opened is picked up', async () => {
    // Arrange
    getActiveDragState.mockResolvedValue({
      vault: { active: true, id: 'v-2', gridWidth: 1, gridHeight: 3 },
    });

    // Act
    const { result } = renderDragSync();

    // Assert
    await waitFor(() => {
      expect(result.current.activeVaultDragItem).toMatchObject({ id: 'v-2', gridHeight: 3 });
    });
  });

  it('If the remote pickup count drops below the local one, Then the local pickup is consumed', async () => {
    // Arrange
    const { consumePickup } = renderDragSync({ pickupState });
    await waitFor(() => expect(sendItemDragState).toHaveBeenCalled());

    // Act
    act(() => {
      mainEvents.emit(INVENTORY_DRAG_STATE_CHANNEL, {
        ...sendItemDragState.mock.calls[0][0],
        stackPickupCount: 1,
      });
    });

    // Assert
    expect(consumePickup).toHaveBeenCalledWith(3);
  });
});

describe('When a local stack pickup starts and ends', () => {
  it('Then other windows are told about the pickup and about its end', async () => {
    // Arrange
    const { rerender, cancelPickup, consumePickup } = renderDragSync({ pickupState });

    // Act
    rerender({ pickupState: undefined, cancelPickup, consumePickup });

    // Assert
    expect(sendItemDragState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ active: true, fingerprint: 'fp-el', stackPickupCount: 4 }),
    );
    expect(sendItemDragState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ active: false, fingerprint: 'fp-el' }),
    );
  });
});

describe('When the hook unmounts', () => {
  it('Then it stops listening to drag-state events', () => {
    // Arrange
    const { unmount } = renderDragSync();

    // Act
    unmount();

    // Assert
    expect(mainEvents.listenerCount(VAULT_DRAG_STATE_CHANNEL)).toBe(0);
    expect(mainEvents.listenerCount(INVENTORY_DRAG_STATE_CHANNEL)).toBe(0);
  });
});
