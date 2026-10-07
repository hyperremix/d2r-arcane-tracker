import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { GameMode } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { SaveFileMonitor } from './SaveFileMonitor';

vi.mock('@/stores/grailStore');

const mockUseGrailStore = vi.mocked(useGrailStore);

function mockGameMode(gameMode: GameMode) {
  mockUseGrailStore.mockReturnValue({
    reloadData: vi.fn(),
    settings: { gameMode },
  } as unknown as ReturnType<typeof useGrailStore>);
}

// Other suites define a non-configurable `window.electronAPI` (vitest runs with isolate: false),
// so it is replaced by assignment rather than vi.stubGlobal, and restored after each test.
const windowGlobals = window as unknown as Record<string, unknown>;
const stubbedKeys = ['electronAPI', 'ipcRenderer'] as const;
const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();

describe('SaveFileMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of stubbedKeys) {
      originalDescriptors.set(key, Object.getOwnPropertyDescriptor(window, key));
    }
    windowGlobals.electronAPI = {
      saveFile: {
        getMonitoringStatus: vi.fn().mockResolvedValue({ isMonitoring: false, directory: null }),
        getSaveFiles: vi.fn().mockResolvedValue([]),
        stopMonitoring: vi.fn().mockResolvedValue(undefined),
      },
    };
    windowGlobals.ipcRenderer = { on: vi.fn(), off: vi.fn() };
  });

  afterEach(() => {
    for (const key of stubbedKeys) {
      const original = originalDescriptors.get(key);
      if (original && 'value' in original) {
        windowGlobals[key] = original.value;
      } else {
        delete windowGlobals[key];
      }
    }
  });

  describe('manual mode notice', () => {
    it('When game mode is manual, then the notice is a polite status and not an assertive alert', async () => {
      // Arrange
      mockGameMode(GameMode.Manual);

      // Act
      render(<SaveFileMonitor />);

      // Assert
      await waitFor(() => expect(window.electronAPI?.saveFile.getSaveFiles).toHaveBeenCalled());
      const notice = screen.getByText(/Manual Mode Active:/).closest('[data-slot="alert"]');
      expect(notice).toHaveAttribute('role', 'status');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('If game mode is not manual, then the notice is not rendered', async () => {
      // Arrange
      mockGameMode(GameMode.Both);

      // Act
      render(<SaveFileMonitor />);

      // Assert
      await waitFor(() => expect(window.electronAPI?.saveFile.getSaveFiles).toHaveBeenCalled());
      expect(screen.queryByText(/Manual Mode Active:/)).not.toBeInTheDocument();
    });
  });

  describe('latest activity', () => {
    function emitSaveFileEvent(type: string) {
      const onMock = vi.mocked(
        (windowGlobals.ipcRenderer as { on: (channel: string, listener: unknown) => void }).on,
      );
      const call = onMock.mock.calls.find(([channel]) => channel === 'save-file-event');
      const listener = call?.[1] as (event: unknown, payload: unknown) => void;
      act(() => {
        listener(
          {},
          {
            type,
            file: { name: 'Sorc', level: 90, characterClass: 'sorceress', hardcore: false },
          },
        );
      });
    }

    it.each([
      ['created', 'Created'],
      ['modified', 'Modified'],
      ['deleted', 'Deleted'],
    ])(
      'When a "%s" save file event arrives, then the event type is shown as "%s"',
      async (type, label) => {
        // Arrange
        mockGameMode(GameMode.Both);
        render(<SaveFileMonitor />);
        await waitFor(() => expect(window.electronAPI?.saveFile.getSaveFiles).toHaveBeenCalled());

        // Act
        emitSaveFileEvent(type);

        // Assert
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.queryByText(type)).not.toBeInTheDocument();
      },
    );

    it('If the event type is unrecognized, then a translated fallback is shown', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      render(<SaveFileMonitor />);
      await waitFor(() => expect(window.electronAPI?.saveFile.getSaveFiles).toHaveBeenCalled());

      // Act
      emitSaveFileEvent('renamed');

      // Assert
      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.queryByText('renamed')).not.toBeInTheDocument();
    });
  });
});
