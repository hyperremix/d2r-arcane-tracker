import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { useDatabaseBackup } from './useDatabaseBackup';

vi.mock('sonner', () => import('@/test/sonnerMock'));

interface MockElectronAPI {
  dialog: { showSaveDialog: ReturnType<typeof vi.fn> };
  grail: { backup: ReturnType<typeof vi.fn> };
}

// Tests share one window (isolate: false), so electronAPI is replaced by assignment and restored.
const windowGlobals = window as unknown as Record<string, unknown>;
let originalDescriptor: PropertyDescriptor | undefined;

function api(): MockElectronAPI {
  return windowGlobals.electronAPI as MockElectronAPI;
}

describe('useDatabaseBackup', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    originalDescriptor = Object.getOwnPropertyDescriptor(window, 'electronAPI');
    windowGlobals.electronAPI = {
      dialog: {
        showSaveDialog: vi
          .fn()
          .mockResolvedValue({ canceled: false, filePath: '/backups/grail-backup.db' }),
      },
      grail: { backup: vi.fn().mockResolvedValue({ success: true }) },
    } satisfies MockElectronAPI;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalDescriptor && 'value' in originalDescriptor) {
      windowGlobals.electronAPI = originalDescriptor.value;
    } else {
      delete windowGlobals.electronAPI;
    }
  });

  it('When the backup succeeds, then it returns true, records the path and shows a success toast', async () => {
    // Arrange
    const { result } = renderHook(() => useDatabaseBackup());

    // Act
    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.backup();
    });

    // Assert
    expect(succeeded).toBe(true);
    expect(api().grail.backup).toHaveBeenCalledWith('/backups/grail-backup.db');
    expect(result.current.lastBackupPath).toBe('/backups/grail-backup.db');
    expect(result.current.isBackingUp).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Database backed up', {
      description: 'Saved to grail-backup.db',
    });
  });

  it('If the save dialog is canceled, then it returns false without backing up or showing a toast', async () => {
    // Arrange
    api().dialog.showSaveDialog.mockResolvedValue({ canceled: true });
    const { result } = renderHook(() => useDatabaseBackup());

    // Act
    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.backup();
    });

    // Assert
    expect(succeeded).toBe(false);
    expect(api().grail.backup).not.toHaveBeenCalled();
    expect(result.current.lastBackupPath).toBeUndefined();
    expect(result.current.isBackingUp).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('If the backup reports failure, then it returns false and shows an error toast', async () => {
    // Arrange
    api().grail.backup.mockResolvedValue({ success: false });
    const { result } = renderHook(() => useDatabaseBackup());

    // Act
    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.backup();
    });

    // Assert
    expect(succeeded).toBe(false);
    expect(result.current.lastBackupPath).toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith('Failed to back up database');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('If the backup throws, then it returns false and shows an error toast with the message', async () => {
    // Arrange
    api().grail.backup.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useDatabaseBackup());

    // Act
    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.backup();
    });

    // Assert
    expect(succeeded).toBe(false);
    expect(result.current.isBackingUp).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Failed to back up database', {
      description: 'disk full',
    });
  });
});
