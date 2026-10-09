import { act, render, waitFor } from '@testing-library/react';
import type { GrailProgress, Item, Settings } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { useGrailStore } from '@/stores/grailStore';
import { initRunTrackerSync } from '@/stores/runTrackerStore';
import WidgetApp from '@/WidgetApp';

const widgetProps = vi.hoisted(() => ({
  last: undefined as { statistics: { foundItems: number; totalItems: number } | null } | undefined,
}));

vi.mock('./Widget', () => ({
  Widget: (props: { statistics: { foundItems: number; totalItems: number } | null }) => {
    widgetProps.last = props;
    return <div>WidgetStub</div>;
  },
}));

const runTrackerSync = vi.hoisted(() => ({ stop: vi.fn() }));

// The theme is applied by the real widget root, but is not under test here
vi.mock('@/hooks/useTheme', () => ({ useTheme: vi.fn() }));

vi.mock('@/stores/runTrackerStore', () => {
  const state = {
    refreshActiveRun: vi.fn().mockResolvedValue(undefined),
    loadSessionRuns: vi.fn().mockResolvedValue(undefined),
    activeSession: undefined,
  };
  const useRunTrackerStore = Object.assign(() => state, { getState: () => state });
  const initRunTrackerSync = vi.fn(() => runTrackerSync.stop);
  return { useRunTrackerStore, initRunTrackerSync };
});

type IpcHandler = (payload: unknown) => Promise<void> | void;

/**
 * Renders the container through the widget window root, which loads the grail data and follows
 * the settings saved in the main window.
 */
describe('WidgetContainer native window sizing', () => {
  const originalElectronAPI = window.electronAPI;
  const initialGrailState = useGrailStore.getInitialState();
  const handlers = new Map<string, IpcHandler>();
  let persistedSettings: Partial<Settings> = {};
  const updateDisplay = vi.fn().mockResolvedValue({ success: true });
  const updateOpacity = vi.fn().mockResolvedValue({ success: true });

  /**
   * Renders the container with the given stored settings and waits until they are loaded.
   */
  async function renderWithSettings(
    stored: Partial<Settings>,
    { items = [] as Item[], progress = [] as GrailProgress[] } = {},
  ) {
    persistedSettings = { ...stored };
    Object.defineProperty(window, 'electronAPI', {
      value: {
        grail: {
          getSettings: vi.fn(async () => ({ ...persistedSettings })),
          getCharacters: vi.fn().mockResolvedValue([]),
          getItems: vi.fn().mockResolvedValue(items),
          getProgress: vi.fn().mockResolvedValue(progress),
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
    const result = render(<WidgetApp />);
    await waitFor(() => {
      expect(handlers.has('settings-updated')).toBe(true);
      expect(useGrailStore.getState().settingsHydrated).toBe(true);
      expect(useGrailStore.getState().loading).toBe(false);
    });
    return result;
  }

  /**
   * Simulates the main process saving a settings update and broadcasting it.
   */
  async function emitSettings(update: Partial<Settings>) {
    persistedSettings = { ...persistedSettings, ...update };
    await act(async () => {
      await handlers.get('settings-updated')?.(update);
    });
  }

  beforeEach(() => {
    handlers.clear();
    widgetProps.last = undefined;
    useGrailStore.setState(initialGrailState, true);
    updateDisplay.mockClear();
    updateOpacity.mockClear();
  });

  afterEach(() => {
    useGrailStore.setState(initialGrailState, true);
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
  });

  it('When the widget mounts, Then the run tracker sync is started', async () => {
    // Arrange
    vi.mocked(initRunTrackerSync).mockClear();

    // Act
    await renderWithSettings({ widgetDisplay: 'overall' });

    // Assert
    expect(initRunTrackerSync).toHaveBeenCalledTimes(1);
  });

  it('When the widget unmounts, Then its main-process event listeners are removed', async () => {
    // Arrange
    const { unmount } = await renderWithSettings({ widgetDisplay: 'overall' });
    runTrackerSync.stop.mockClear();

    // Act
    unmount();

    // Assert
    expect(handlers.size).toBe(0);
    expect(runTrackerSync.stop).toHaveBeenCalledTimes(1);
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

  it('When the stored grail data is loaded, Then the widget receives the shared grail statistics', async () => {
    // Arrange
    const items = [
      HolyGrailItemBuilder.new().withId('shako').build(),
      HolyGrailItemBuilder.new().withId('soj').build(),
    ];
    const progress = [
      GrailProgressBuilder.new()
        .withId('p1')
        .withCharacterId('c1')
        .withItemId('shako')
        .withFoundDate(new Date('2024-01-01'))
        .build(),
    ];

    // Act
    await renderWithSettings(
      { widgetDisplay: 'overall', grailNormal: true, grailEthereal: false },
      { items, progress },
    );

    // Assert
    await waitFor(() =>
      expect(widgetProps.last?.statistics).toMatchObject({ foundItems: 1, totalItems: 2 }),
    );
  });

  it('If a tracked item type setting changes, Then the grail data is reloaded', async () => {
    // Arrange
    await renderWithSettings({ widgetDisplay: 'overall', grailRunes: false });
    const { getItems } = (
      window.electronAPI as unknown as { grail: { getItems: ReturnType<typeof vi.fn> } }
    ).grail;
    getItems.mockClear();

    // Act
    await emitSettings({ grailRunes: true });

    // Assert
    await waitFor(() => expect(getItems).toHaveBeenCalledTimes(1));
    expect(useGrailStore.getState().settings.grailRunes).toBe(true);
  });
});
