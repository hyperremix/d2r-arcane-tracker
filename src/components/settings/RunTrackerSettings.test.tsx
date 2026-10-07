import { act, fireEvent, render, screen } from '@testing-library/react';
import type { GlobalHotkeyStatus, Settings } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { RunTrackerSettings } from './RunTrackerSettings';

vi.mock('@/stores/grailStore');

const originalElectronAPI = window.electronAPI;

function setupGrailStore(settings: Partial<Settings>) {
  const storeState = { settings, setSettings: vi.fn().mockResolvedValue(undefined) };
  vi.mocked(useGrailStore).mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as unknown as ReturnType<typeof useGrailStore>;
  });
  return storeState;
}

describe('When RunTrackerSettings is rendered on Windows with auto mode enabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.electronAPI = {
      platform: 'win32',
      runTracker: {
        getMemoryStatus: vi.fn().mockResolvedValue({ available: true, reason: null }),
      },
    } as unknown as typeof window.electronAPI;
    setupGrailStore({
      runTrackerMemoryReading: true,
      runTrackerMemoryPollingInterval: 500,
    });
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  it('Then the polling interval slider is labelled by its label', () => {
    // Arrange & Act
    render(<RunTrackerSettings />);

    // Assert (the thumb input stays visibility:hidden in jsdom until measured, which blanks its
    // computed role name, so verify the label association via getAllByLabelText instead)
    const slider = screen.getByRole('slider', { hidden: true });
    expect(screen.getAllByLabelText('Memory Polling Interval')).toContain(slider);
  });

  it('Then the shortcut edit buttons use translated text', () => {
    // Arrange & Act
    render(<RunTrackerSettings />);

    // Assert
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(4);
  });
});

describe('When RunTrackerSettings renders the global hotkeys option', () => {
  function setupElectronAPI(status: GlobalHotkeyStatus) {
    window.electronAPI = {
      platform: 'darwin',
      runTracker: {
        getMemoryStatus: vi.fn(),
        getGlobalHotkeyStatus: vi.fn().mockResolvedValue(status),
        onGlobalHotkeyStatus: vi.fn(() => vi.fn()),
      },
    } as unknown as typeof window.electronAPI;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  it('If global hotkeys are off, Then turning the switch on saves the setting', () => {
    // Arrange
    setupElectronAPI({ enabled: false, registrations: [] });
    const store = setupGrailStore({ runTrackerGlobalHotkeys: false });
    render(<RunTrackerSettings />);

    // Act
    const toggle = screen.getByRole('switch', { name: 'Global hotkeys' });
    fireEvent.click(toggle);

    // Assert
    expect(toggle).toHaveAccessibleDescription(/D2R or another app is focused/);
    expect(store.setSettings).toHaveBeenCalledWith({ runTrackerGlobalHotkeys: true });
  });

  it('If a shortcut could not be registered, Then a translated error names the shortcut', async () => {
    // Arrange
    setupElectronAPI({
      enabled: true,
      registrations: [
        { action: 'startRun', shortcut: 'Ctrl+R', state: 'registered' },
        { action: 'endRun', shortcut: 'Ctrl+E', state: 'conflict' },
        { action: 'endSession', shortcut: 'E', state: 'unsupported' },
      ],
    });
    setupGrailStore({ runTrackerGlobalHotkeys: true });

    // Act
    render(<RunTrackerSettings />);

    // Assert
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(
        'End Run: Ctrl+E is already used by another app or action. Choose a different shortcut.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/End Session: E can't be used globally/)).toBeInTheDocument();
    expect(screen.queryByText(/Start Run: Ctrl\+R/)).not.toBeInTheDocument();
  });

  it('If all shortcuts are registered, Then no error is shown', async () => {
    // Arrange
    setupElectronAPI({
      enabled: true,
      registrations: [{ action: 'startRun', shortcut: 'Ctrl+R', state: 'registered' }],
    });
    setupGrailStore({ runTrackerGlobalHotkeys: true });

    // Act
    render(<RunTrackerSettings />);
    await act(async () => {
      // Let the global hotkey status query resolve
      await Promise.resolve();
    });

    // Assert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
