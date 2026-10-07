import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown, ...args: unknown[]) => Promise<Record<string, unknown>>;

const handlers = vi.hoisted(() => new Map<string, unknown>());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: unknown) => {
      handlers.set(channel, handler);
    }),
  },
}));

vi.mock('../database/database', () => ({
  grailDatabase: { getAllSettings: vi.fn(() => ({})) },
}));

vi.mock('../window/widgetWindow', () => ({
  closeWidgetWindow: vi.fn(),
  getWidgetWindowPosition: vi.fn(),
  resetWidgetWindowSize: vi.fn(() => ({ width: 250, height: 250 })),
  setWidgetWindowLocked: vi.fn(() => true),
  showWidgetWindow: vi.fn(),
  updateWidgetWindowOpacity: vi.fn(),
  updateWidgetWindowSize: vi.fn(),
  widgetWindow: null,
}));

import { grailDatabase } from '../database/database';
import {
  resetWidgetWindowSize,
  setWidgetWindowLocked,
  showWidgetWindow,
  updateWidgetWindowSize,
} from '../window/widgetWindow';
import { initializeWidgetHandlers } from './widgetHandlers';

const invoke = (channel: string, ...args: unknown[]) =>
  (handlers.get(channel) as Handler)({}, ...args);

describe('widget IPC handlers display mode validation', () => {
  const onSizeChange = vi.fn();
  let consoleError: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(grailDatabase.getAllSettings).mockReset();
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue(
      {} as ReturnType<typeof grailDatabase.getAllSettings>,
    );
    handlers.clear();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    initializeWidgetHandlers('/app', undefined, undefined, undefined, onSizeChange);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('When widget:reset-size receives a valid display mode, Then the size is reset and reported', async () => {
    // Arrange
    const display = 'split';

    // Act
    const result = await invoke('widget:reset-size', display);

    // Assert
    expect(resetWidgetWindowSize).toHaveBeenCalledWith('split', undefined);
    expect(onSizeChange).toHaveBeenCalledWith('split', { width: 250, height: 250 });
    expect(result).toEqual({ success: true, size: { width: 250, height: 250 } });
  });

  it.each([
    ['an unknown string', 'huge'],
    ['a prototype key', 'constructor'],
    ['a non-string', 42],
    ['undefined', undefined],
  ])(
    'If widget:reset-size receives %s, Then it is rejected without touching the window',
    async (_name, display) => {
      // Arrange: the invalid display mode comes from the test table

      // Act
      const result = await invoke('widget:reset-size', display);

      // Assert
      expect(result).toMatchObject({ success: false, size: null });
      expect(resetWidgetWindowSize).not.toHaveBeenCalled();
      expect(onSizeChange).not.toHaveBeenCalled();
    },
  );

  it('If widget:update-display receives an invalid display mode, Then it is rejected', async () => {
    // Arrange
    const invalid = 'huge';

    // Act
    const result = await invoke('widget:update-display', invalid, {});

    // Assert
    expect(result).toMatchObject({ success: false });
    expect(updateWidgetWindowSize).not.toHaveBeenCalled();
  });

  it('If widget:update-size receives an invalid display mode, Then it is rejected', async () => {
    // Arrange
    const invalid = 'huge';

    // Act
    const result = await invoke('widget:update-size', invalid, { width: 1, height: 1 });

    // Assert
    expect(result).toMatchObject({ success: false });
    expect(onSizeChange).not.toHaveBeenCalled();
  });

  it('If the renderer sends stale custom sizes, Then the persisted sizes from the database are used', async () => {
    // Arrange
    const persistedSplit = { width: 400, height: 300 };
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue({
      widgetSizeSplit: persistedSplit,
      grailEthereal: true,
    } as ReturnType<typeof grailDatabase.getAllSettings>);
    const staleSettings = { grailEthereal: true, widgetSizeSplit: { width: 350, height: 250 } };

    // Act
    const result = await invoke('widget:update-display', 'split', staleSettings);

    // Assert
    expect(result).toEqual({ success: true });
    expect(updateWidgetWindowSize).toHaveBeenCalledWith(
      'split',
      expect.objectContaining({ widgetSizeSplit: persistedSplit, grailEthereal: true }),
    );
  });

  it('When the renderer reports the ethereal flag, Then it decides whether split and all can be used', async () => {
    // Arrange
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue({
      grailEthereal: true,
    } as ReturnType<typeof grailDatabase.getAllSettings>);

    // Act
    await invoke('widget:update-display', 'overall', { grailEthereal: false });

    // Assert
    expect(updateWidgetWindowSize).toHaveBeenCalledWith(
      'overall',
      expect.objectContaining({ grailEthereal: false }),
    );
  });

  it('If the database cannot be read, Then the renderer settings are used as a fallback', async () => {
    // Arrange
    vi.mocked(grailDatabase.getAllSettings).mockImplementation(() => {
      throw new Error('db unavailable');
    });
    const rendererSettings = { grailEthereal: true, widgetSizeSplit: { width: 350, height: 250 } };

    // Act
    const result = await invoke('widget:update-display', 'split', rendererSettings);

    // Assert
    expect(result).toEqual({ success: true });
    expect(updateWidgetWindowSize).toHaveBeenCalledWith('split', rendererSettings);
  });

  it('When widget:reset-size resets run-only, Then the stored item list flag picks the default size', async () => {
    // Arrange
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue({
      widgetRunOnlyShowItems: false,
    } as ReturnType<typeof grailDatabase.getAllSettings>);

    // Act
    await invoke('widget:reset-size', 'run-only');

    // Assert
    expect(resetWidgetWindowSize).toHaveBeenCalledWith('run-only', false);
  });
});

describe('widget IPC handlers lock (click-through)', () => {
  let consoleError: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(grailDatabase.getAllSettings).mockReset();
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue(
      {} as ReturnType<typeof grailDatabase.getAllSettings>,
    );
    handlers.clear();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    initializeWidgetHandlers('/app');
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it.each([true, false])(
    'When widget:set-locked receives %s, Then the lock state is applied to the window',
    async (locked) => {
      // Arrange: the lock state comes from the test table

      // Act
      const result = await invoke('widget:set-locked', locked);

      // Assert
      expect(result).toEqual({ success: true });
      expect(setWidgetWindowLocked).toHaveBeenCalledWith(locked);
    },
  );

  it.each([
    ['a string', 'true'],
    ['a number', 1],
    ['undefined', undefined],
    ['an object', { locked: true }],
  ])(
    'If widget:set-locked receives %s, Then it is rejected without touching the window',
    async (_name, locked) => {
      // Arrange: the invalid lock state comes from the test table

      // Act
      const result = await invoke('widget:set-locked', locked);

      // Assert
      expect(result).toMatchObject({ success: false });
      expect(setWidgetWindowLocked).not.toHaveBeenCalled();
    },
  );

  it('When the widget is toggled on, Then it is created with the persisted lock state and sizes', async () => {
    // Arrange
    const persistedRunOnly = { width: 280, height: 400 };
    vi.mocked(grailDatabase.getAllSettings).mockReturnValue({
      widgetLocked: true,
      widgetSizeRunOnly: persistedRunOnly,
    } as ReturnType<typeof grailDatabase.getAllSettings>);
    const staleSettings = { widgetDisplay: 'run-only' as const, widgetLocked: false };

    // Act
    const result = await invoke('widget:toggle', true, staleSettings);

    // Assert
    expect(result).toEqual({ success: true });
    expect(showWidgetWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetDisplay: 'run-only',
        widgetLocked: true,
        widgetSizeRunOnly: persistedRunOnly,
      }),
      '/app',
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });
});
