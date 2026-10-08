import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import {
  normalizeDirectoryForComparison,
  type SaveDirectoryChangeRequest,
  useSaveDirectoryChange,
} from './useSaveDirectoryChange';

const CURRENT = '/saves/current';
const OTHER = '/saves/other';
const DEFAULT_DIRECTORY = '/saves/default';

interface MockElectronAPI {
  platform: string;
  grail: {
    getCharacters: ReturnType<typeof vi.fn>;
    getProgress: ReturnType<typeof vi.fn>;
    getSettings: ReturnType<typeof vi.fn>;
  };
  saveFile: {
    getDefaultDirectory: ReturnType<typeof vi.fn>;
    updateSaveDirectory: ReturnType<typeof vi.fn>;
    restoreDefaultDirectory: ReturnType<typeof vi.fn>;
  };
}

// Tests share one window (isolate: false), so electronAPI is replaced by assignment and restored.
const windowGlobals = window as unknown as Record<string, unknown>;
let originalDescriptor: PropertyDescriptor | undefined;

function api(): MockElectronAPI {
  return windowGlobals.electronAPI as MockElectronAPI;
}

function stashElectronAPI() {
  originalDescriptor = Object.getOwnPropertyDescriptor(window, 'electronAPI');
}

function restoreElectronAPI() {
  if (originalDescriptor && 'value' in originalDescriptor) {
    windowGlobals.electronAPI = originalDescriptor.value;
  } else {
    delete windowGlobals.electronAPI;
  }
}

function changeTo(directory: string): SaveDirectoryChangeRequest {
  return { action: 'change', directory };
}

describe('normalizeDirectoryForComparison', () => {
  beforeEach(stashElectronAPI);
  afterEach(restoreElectronAPI);

  it('When the path has surrounding whitespace and trailing separators, then they are removed', () => {
    // Arrange
    windowGlobals.electronAPI = { platform: 'linux' };

    // Act
    const result = normalizeDirectoryForComparison('  /saves/current//  ');

    // Assert
    expect(result).toBe('/saves/current');
  });

  it('If the platform is win32, then the path is compared case-insensitively', () => {
    // Arrange
    windowGlobals.electronAPI = { platform: 'win32' };

    // Act
    const result = normalizeDirectoryForComparison('C:\\Users\\Me\\Saves\\');

    // Assert
    expect(result).toBe('c:\\users\\me\\saves');
  });

  it('If the platform is not win32, then the path keeps its case', () => {
    // Arrange
    windowGlobals.electronAPI = { platform: 'darwin' };

    // Act
    const result = normalizeDirectoryForComparison('/Saves/Current');

    // Assert
    expect(result).toBe('/Saves/Current');
  });
});

describe('useSaveDirectoryChange', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stashElectronAPI();
    windowGlobals.electronAPI = {
      platform: 'linux',
      grail: {
        getCharacters: vi.fn().mockResolvedValue([]),
        getProgress: vi.fn().mockResolvedValue([]),
        getSettings: vi.fn().mockResolvedValue({ saveDir: '' }),
      },
      saveFile: {
        getDefaultDirectory: vi.fn().mockResolvedValue(DEFAULT_DIRECTORY),
        updateSaveDirectory: vi.fn().mockResolvedValue({ success: true }),
        restoreDefaultDirectory: vi.fn().mockResolvedValue({ success: true }),
      },
    } satisfies MockElectronAPI;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    restoreElectronAPI();
  });

  describe('When the requested directory is the current one', () => {
    it('Then the change is unchanged and nothing is applied, even if data exists', async () => {
      // Arrange
      api().grail.getCharacters.mockResolvedValue([{ id: 'char-1' }]);
      const { result } = renderHook(() => useSaveDirectoryChange({ currentDirectory: CURRENT }));

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.requestChange(changeTo(`${CURRENT}/`));
      });

      // Assert
      expect(outcome).toBe('unchanged');
      expect(result.current.pendingChange).toBeUndefined();
      expect(api().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });
  });

  describe('If the current directory is unknown', () => {
    it('Then the saved saveDir setting is used for the comparison', async () => {
      // Arrange
      api().grail.getSettings.mockResolvedValue({ saveDir: CURRENT });
      api().grail.getCharacters.mockResolvedValue([{ id: 'char-1' }]);
      const { result } = renderHook(() => useSaveDirectoryChange({ currentDirectory: undefined }));

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.requestChange(changeTo(CURRENT));
      });

      // Assert
      expect(outcome).toBe('unchanged');
      expect(result.current.pendingChange).toBeUndefined();
    });

    it('Then the platform default is used when the current directory is empty and no saveDir setting exists', async () => {
      // Arrange
      api().grail.getCharacters.mockResolvedValue([{ id: 'char-1' }]);
      const { result } = renderHook(() => useSaveDirectoryChange({ currentDirectory: '' }));

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.requestChange({
          action: 'restore',
          directory: DEFAULT_DIRECTORY,
        });
      });

      // Assert
      expect(outcome).toBe('unchanged');
      expect(api().saveFile.restoreDefaultDirectory).not.toHaveBeenCalled();
    });

    it('Then a different directory with existing data asks for confirmation and records the resolved current directory', async () => {
      // Arrange
      api().grail.getSettings.mockResolvedValue({ saveDir: CURRENT });
      api().grail.getCharacters.mockResolvedValue([{ id: 'char-1' }]);
      const { result } = renderHook(() => useSaveDirectoryChange({ currentDirectory: undefined }));

      // Act
      await act(async () => {
        await result.current.requestChange(changeTo(OTHER));
      });

      // Assert
      expect(result.current.pendingChange).toEqual({
        action: 'change',
        directory: OTHER,
        currentDirectory: CURRENT,
      });
    });

    it('Then a failure to resolve it falls back to asking for confirmation when data exists', async () => {
      // Arrange
      api().grail.getSettings.mockRejectedValue(new Error('settings unavailable'));
      api().grail.getCharacters.mockResolvedValue([{ id: 'char-1' }]);
      const { result } = renderHook(() => useSaveDirectoryChange({ currentDirectory: undefined }));

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.requestChange(changeTo(OTHER));
      });

      // Assert
      expect(outcome).toBe('confirmationRequired');
      expect(result.current.pendingChange?.currentDirectory).toBeUndefined();
    });
  });

  describe('If a different directory is requested', () => {
    it('Then it is applied immediately when no characters or progress exist', async () => {
      // Arrange
      const onApplied = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useSaveDirectoryChange({ currentDirectory: CURRENT, onApplied }),
      );

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.requestChange(changeTo(OTHER));
      });

      // Assert
      expect(outcome).toBe('applied');
      expect(api().saveFile.updateSaveDirectory).toHaveBeenCalledWith(OTHER);
      expect(onApplied).toHaveBeenCalledWith(changeTo(OTHER));
      expect(result.current.isApplying).toBe(false);
    });

    it('Then progress alone also requires confirmation', async () => {
      // Arrange
      api().grail.getProgress.mockResolvedValue([{ id: 'progress-1' }]);
      const { result } = renderHook(() => useSaveDirectoryChange({ currentDirectory: CURRENT }));

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.requestChange(changeTo(OTHER));
      });

      // Assert
      expect(outcome).toBe('confirmationRequired');
      expect(api().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('Then it requires confirmation when the existing data check fails', async () => {
      // Arrange
      api().grail.getCharacters.mockRejectedValue(new Error('db locked'));
      const { result } = renderHook(() => useSaveDirectoryChange({ currentDirectory: CURRENT }));

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.requestChange(changeTo(OTHER));
      });

      // Assert
      expect(outcome).toBe('confirmationRequired');
      expect(result.current.pendingChange?.directory).toBe(OTHER);
      expect(api().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('Then applying a restore request uses the restore IPC', async () => {
      // Arrange
      const { result } = renderHook(() => useSaveDirectoryChange({ currentDirectory: CURRENT }));

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.requestChange({
          action: 'restore',
          directory: DEFAULT_DIRECTORY,
        });
      });

      // Assert
      expect(outcome).toBe('applied');
      expect(api().saveFile.restoreDefaultDirectory).toHaveBeenCalledTimes(1);
      expect(api().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('Then a failing apply reports failed and does not refresh', async () => {
      // Arrange
      api().saveFile.updateSaveDirectory.mockRejectedValue(new Error('boom'));
      const onApplied = vi.fn();
      const { result } = renderHook(() =>
        useSaveDirectoryChange({ currentDirectory: CURRENT, onApplied }),
      );

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.requestChange(changeTo(OTHER));
      });

      // Assert
      expect(outcome).toBe('failed');
      expect(onApplied).not.toHaveBeenCalled();
      expect(result.current.isApplying).toBe(false);
    });

    it('Then a failing onApplied refresh is swallowed and the change still counts as applied', async () => {
      // Arrange
      const onApplied = vi.fn().mockRejectedValue(new Error('reload failed'));
      const { result } = renderHook(() =>
        useSaveDirectoryChange({ currentDirectory: CURRENT, onApplied }),
      );

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.requestChange(changeTo(OTHER));
      });

      // Assert
      expect(outcome).toBe('applied');
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.current.isApplying).toBe(false);
    });
  });

  describe('When a pending change is confirmed', () => {
    async function arrangePending() {
      api().grail.getCharacters.mockResolvedValue([{ id: 'char-1' }]);
      const hook = renderHook(() => useSaveDirectoryChange({ currentDirectory: CURRENT }));
      await act(async () => {
        await hook.result.current.requestChange(changeTo(OTHER));
      });
      return hook;
    }

    it('Then the change is applied and the pending change is cleared', async () => {
      // Arrange
      const { result } = await arrangePending();

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.confirmPendingChange();
      });

      // Assert
      expect(outcome).toBe('applied');
      expect(api().saveFile.updateSaveDirectory).toHaveBeenCalledWith(OTHER);
      expect(result.current.pendingChange).toBeUndefined();
    });

    it('If applying fails, then it reports failed and still clears the pending change', async () => {
      // Arrange
      const { result } = await arrangePending();
      api().saveFile.updateSaveDirectory.mockRejectedValue(new Error('boom'));

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.confirmPendingChange();
      });

      // Assert
      expect(outcome).toBe('failed');
      expect(result.current.pendingChange).toBeUndefined();
      expect(result.current.isApplying).toBe(false);
    });
  });

  describe('If there is no pending change', () => {
    it('Then confirming reports failed without calling IPC', async () => {
      // Arrange
      const { result } = renderHook(() => useSaveDirectoryChange({ currentDirectory: CURRENT }));

      // Act
      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.confirmPendingChange();
      });

      // Assert
      expect(outcome).toBe('failed');
      expect(api().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });
  });

  describe('When a pending change is canceled', () => {
    it('Then it is discarded and nothing is applied', async () => {
      // Arrange
      api().grail.getCharacters.mockResolvedValue([{ id: 'char-1' }]);
      const { result } = renderHook(() => useSaveDirectoryChange({ currentDirectory: CURRENT }));
      await act(async () => {
        await result.current.requestChange(changeTo(OTHER));
      });

      // Act
      act(() => {
        result.current.cancelPendingChange();
      });

      // Assert
      expect(result.current.pendingChange).toBeUndefined();
      expect(api().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });
  });
});
