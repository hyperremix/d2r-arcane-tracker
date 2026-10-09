import { act, render, waitFor } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { WidgetContainer } from './WidgetContainer';

vi.mock('./Widget', () => ({ Widget: () => <div>WidgetStub</div> }));

vi.mock('@/stores/runTrackerStore', () => {
  const state = {
    handleSessionStarted: vi.fn(),
    handleSessionEnded: vi.fn(),
    handleRunStarted: vi.fn(),
    handleRunEnded: vi.fn(),
    refreshActiveRun: vi.fn().mockResolvedValue(undefined),
    loadSessionRuns: vi.fn().mockResolvedValue(undefined),
    loadRunItems: vi.fn().mockResolvedValue(undefined),
    activeSession: undefined,
  };
  const useRunTrackerStore = Object.assign(() => state, { getState: () => state });
  return { useRunTrackerStore };
});

type IpcHandler = (payload: unknown) => Promise<void> | void;

describe('WidgetContainer native window sizing', () => {
  const originalElectronAPI = window.electronAPI;
  const originalSettings = useGrailStore.getState().settings;
  const handlers = new Map<string, IpcHandler>();
  const updateDisplay = vi.fn().mockResolvedValue({ success: true });
  const updateOpacity = vi.fn().mockResolvedValue({ success: true });

  /**
   * Renders the container with the given stored settings and waits until they are loaded.
   */
  async function renderWithSettings(stored: Partial<Settings>) {
    Object.defineProperty(window, 'electronAPI', {
      value: {
        grail: {
          getSettings: vi.fn().mockResolvedValue(stored),
          getItems: vi.fn().mockResolvedValue([]),
          getProgress: vi.fn().mockResolvedValue([]),
        },
        widget: { updateDisplay, updateOpacity },
        on: vi.fn((channel: string, handler: IpcHandler) => {
          handlers.set(channel, handler);
          return () => {
            handlers.delete(channel);
          };
        }),
      },
      configurable: true,
      writable: true,
    });
    const result = render(<WidgetContainer />);
    await waitFor(() => {
      expect(handlers.has('settings-updated')).toBe(true);
    });
    await act(async () => {
      await Promise.resolve();
    });
    return result;
  }

  /**
   * Simulates the main process broadcasting a settings update.
   */
  async function emitSettings(update: Partial<Settings>) {
    await act(async () => {
      await handlers.get('settings-updated')?.(update);
    });
  }

  beforeEach(() => {
    handlers.clear();
    updateDisplay.mockClear();
    updateOpacity.mockClear();
  });

  afterEach(() => {
    useGrailStore.setState({ settings: originalSettings });
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
  });

  it('When the main process reports a started session, Then the session from the payload is stored', async () => {
    // Arrange
    await renderWithSettings({ widgetDisplay: 'overall' });
    const session = { id: 'session-1' };
    const { handleSessionStarted } = useRunTrackerStore.getState();

    // Act
    await act(async () => {
      await handlers.get('run-tracker:session-started')?.({ session });
    });

    // Assert
    expect(handleSessionStarted).toHaveBeenCalledWith(session);
  });

  it('When the widget unmounts, Then its main-process event listeners are removed', async () => {
    // Arrange
    const { unmount } = await renderWithSettings({ widgetDisplay: 'overall' });

    // Act
    unmount();

    // Assert
    expect(handlers.size).toBe(0);
  });

  it('When the widget loads its stored settings, Then the window is not resized again', async () => {
    // Arrange
    const stored: Partial<Settings> = { widgetDisplay: 'split', grailEthereal: true };

    // Act
    await renderWithSettings(stored);

    // Assert
    expect(updateDisplay).not.toHaveBeenCalled();
  });

  it('If ethereal tracking is turned off while split is stored, Then the window is resized to overall', async () => {
    // Arrange
    await renderWithSettings({ widgetDisplay: 'split', grailEthereal: true });

    // Act
    await emitSettings({ grailEthereal: false });

    // Assert
    expect(updateDisplay).toHaveBeenCalledTimes(1);
    expect(updateDisplay).toHaveBeenCalledWith(
      'overall',
      expect.objectContaining({ widgetDisplay: 'split', grailEthereal: false }),
    );
  });

  it('If ethereal tracking is turned back on, Then the window is resized to the stored split mode', async () => {
    // Arrange
    await renderWithSettings({ widgetDisplay: 'split', grailEthereal: false });

    // Act
    await emitSettings({ grailEthereal: true });

    // Assert
    expect(updateDisplay).toHaveBeenCalledTimes(1);
    expect(updateDisplay).toHaveBeenCalledWith('split', expect.anything());
  });

  it('When the stored display mode changes to run-only, Then the window is resized to run-only', async () => {
    // Arrange
    await renderWithSettings({ widgetDisplay: 'overall', grailEthereal: false });

    // Act
    await emitSettings({ widgetDisplay: 'run-only' });

    // Assert
    expect(updateDisplay).toHaveBeenCalledTimes(1);
    expect(updateDisplay).toHaveBeenCalledWith('run-only', expect.anything());
  });

  it('If a display change does not alter the resolved mode, Then the window is not resized', async () => {
    // Arrange
    await renderWithSettings({ widgetDisplay: 'overall', grailEthereal: false });

    // Act
    await emitSettings({ widgetDisplay: 'split' });

    // Assert
    expect(updateDisplay).not.toHaveBeenCalled();
  });

  it('If a settings update changes the opacity, Then the widget does not send it back to the main process', async () => {
    // Arrange
    await renderWithSettings({ widgetDisplay: 'overall', grailEthereal: false });

    // Act
    await emitSettings({ widgetOpacity: 0.5 });

    // Assert
    expect(updateOpacity).not.toHaveBeenCalled();
  });
});
