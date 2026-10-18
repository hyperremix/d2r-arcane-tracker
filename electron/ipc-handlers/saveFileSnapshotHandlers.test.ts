import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler);
    }),
  },
}));

import { initializeSaveFileSnapshotHandlers } from './saveFileSnapshotHandlers';

const SNAPSHOT_ID = 'snapshot:0123abcd-Hero.d2s.2026-10-18T08-52-23-468Z-000022.snap';

function invoke(channel: string, ...args: unknown[]) {
  const handler = mocks.handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return handler({}, ...args);
}

describe('When the save file snapshot IPC handlers are initialized', () => {
  const snapshots = { list: vi.fn(), restore: vi.fn() };

  beforeEach(() => {
    mocks.handlers.clear();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    initializeSaveFileSnapshotHandlers(snapshots);
  });

  it('Then listing returns the groups of the snapshot service', async () => {
    // Arrange
    const groups = [{ fileName: 'Hero.d2s', fileExists: true, snapshots: [] }];
    snapshots.list.mockResolvedValue(groups);

    // Act
    const result = await invoke('saveSnapshots:list');

    // Assert
    expect(result).toBe(groups);
  });

  it('If a listed snapshot is restored, Then the service restores it and success is returned', async () => {
    // Arrange
    snapshots.restore.mockResolvedValue(undefined);

    // Act
    const result = await invoke('saveSnapshots:restore', SNAPSHOT_ID);

    // Assert
    expect(snapshots.restore).toHaveBeenCalledWith(SNAPSHOT_ID);
    expect(result).toEqual({ success: true });
  });

  it('If the renderer passes a path instead of a snapshot ID, Then nothing is restored', async () => {
    // Arrange
    const path = 'C:\\Users\\me\\Saved Games\\Diablo II Resurrected\\Hero.d2s';

    // Act
    const result = invoke('saveSnapshots:restore', path);

    // Assert
    await expect(result).rejects.toThrow('Invalid snapshot ID');
    expect(snapshots.restore).not.toHaveBeenCalled();
  });
});
