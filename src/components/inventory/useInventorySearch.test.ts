import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InventorySearchAllResponse } from '@/components/inventory/inventorySearch';
import { createMainEventsMock } from '@/test/mainEventsMock';
import { type InventorySearchParams, useInventorySearch } from './useInventorySearch';

const mainEvents = createMainEventsMock();
const searchAll = vi.fn();
const refreshSaveFiles = vi.fn();
const windowGlobals = window as unknown as { electronAPI: unknown };
let originalElectronAPI: unknown;

const DEFAULT_PARAMS: InventorySearchParams = {
  searchText: '',
  characterId: 'all',
  locationContext: 'all',
};

function makeResponse(totalItems: number): InventorySearchAllResponse {
  return {
    inventory: { snapshots: [], totalSnapshots: 0, totalItems },
    vault: { items: [], total: 0, page: 1, pageSize: 200 },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  originalElectronAPI = windowGlobals.electronAPI;
  mainEvents.reset();
  searchAll.mockReset().mockResolvedValue(makeResponse(0));
  refreshSaveFiles.mockReset().mockResolvedValue(undefined);
  windowGlobals.electronAPI = {
    on: mainEvents.on,
    inventory: { searchAll },
    vault: { search: vi.fn() },
    saveFile: { refreshSaveFiles },
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  windowGlobals.electronAPI = originalElectronAPI;
});

describe('When the inventory search loads', () => {
  it('Then the response is applied and loading ends', async () => {
    // Arrange
    searchAll.mockResolvedValue(makeResponse(3));

    // Act
    const { result } = renderHook(() => useInventorySearch(DEFAULT_PARAMS));

    // Assert
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.inventoryResponse?.inventory.totalItems).toBe(3);
  });

  it('If the filter changes while an older request is pending, Then the stale response is ignored', async () => {
    // Arrange
    const first = createDeferred<InventorySearchAllResponse>();
    const second = createDeferred<InventorySearchAllResponse>();
    searchAll.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      (props: InventorySearchParams) => useInventorySearch(props),
      {
        initialProps: DEFAULT_PARAMS,
      },
    );
    rerender({ ...DEFAULT_PARAMS, searchText: 'shako' });
    await waitFor(() => expect(searchAll).toHaveBeenCalledTimes(2));

    // Act: the newer request answers first, then the older one answers late.
    await act(async () => {
      second.resolve(makeResponse(2));
      await second.promise;
    });
    await act(async () => {
      first.resolve(makeResponse(1));
      await first.promise;
    });

    // Assert
    expect(result.current.inventoryResponse?.inventory.totalItems).toBe(2);
    expect(result.current.isLoading).toBe(false);
  });

  it('If a stale request fails, Then its error is not logged and loading stays on for the latest request', async () => {
    // Arrange
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const first = createDeferred<InventorySearchAllResponse>();
    const second = createDeferred<InventorySearchAllResponse>();
    searchAll.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      (props: InventorySearchParams) => useInventorySearch(props),
      {
        initialProps: DEFAULT_PARAMS,
      },
    );
    rerender({ ...DEFAULT_PARAMS, searchText: 'shako' });
    await waitFor(() => expect(searchAll).toHaveBeenCalledTimes(2));

    // Act
    await act(async () => {
      first.reject(new Error('stale failure'));
      await first.promise.catch(() => undefined);
    });

    // Assert
    expect(consoleError).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
  });

  it('If the latest request fails, Then the error is logged and loading ends', async () => {
    // Arrange
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    searchAll.mockRejectedValue(new Error('db down'));

    // Act
    const { result } = renderHook(() => useInventorySearch(DEFAULT_PARAMS));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load inventory search results',
      expect.any(Error),
    );
    expect(result.current.inventoryResponse).toBeNull();
  });
});

describe('When the main process reports a save file event', () => {
  it('Then a burst of events reloads the search once after the delay', async () => {
    // Arrange
    vi.useFakeTimers();
    renderHook(() => useInventorySearch(DEFAULT_PARAMS));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(searchAll).toHaveBeenCalledTimes(1);

    // Act
    act(() => {
      mainEvents.emit('save-file-event');
      mainEvents.emit('save-file-event');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(249);
    });
    const callsBeforeDelay = searchAll.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Assert
    expect(callsBeforeDelay).toBe(1);
    expect(searchAll).toHaveBeenCalledTimes(2);
  });

  it('If the hook unmounts with a reload pending, Then the listener is removed and the reload never runs', async () => {
    // Arrange
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useInventorySearch(DEFAULT_PARAMS));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => {
      mainEvents.emit('save-file-event');
    });

    // Act
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Assert
    expect(mainEvents.listenerCount('save-file-event')).toBe(0);
    expect(searchAll).toHaveBeenCalledTimes(1);
  });
});

describe('When the inventory reloads after a save file write', () => {
  it('Then the save files are rescanned before the search reloads', async () => {
    // Arrange
    const { result } = renderHook(() => useInventorySearch(DEFAULT_PARAMS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    searchAll.mockClear();

    // Act
    await act(async () => {
      await result.current.reloadInventoryAfterSaveWrite();
    });

    // Assert
    expect(refreshSaveFiles).toHaveBeenCalledTimes(1);
    expect(searchAll).toHaveBeenCalledTimes(1);
    expect(refreshSaveFiles.mock.invocationCallOrder[0]).toBeLessThan(
      searchAll.mock.invocationCallOrder[0],
    );
  });

  it('If the rescan fails, Then the failure is logged and the search still reloads', async () => {
    // Arrange
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useInventorySearch(DEFAULT_PARAMS));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    searchAll.mockClear();
    refreshSaveFiles.mockRejectedValue(new Error('scan failed'));

    // Act
    await act(async () => {
      await result.current.reloadInventoryAfterSaveWrite();
    });

    // Assert
    expect(consoleWarn).toHaveBeenCalledWith(
      'Failed to refresh save files after write',
      expect.any(Error),
    );
    expect(searchAll).toHaveBeenCalledTimes(1);
  });
});
