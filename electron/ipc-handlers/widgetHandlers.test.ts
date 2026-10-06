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

vi.mock('../window/widgetWindow', () => ({
  closeWidgetWindow: vi.fn(),
  getWidgetWindowPosition: vi.fn(),
  resetWidgetWindowSize: vi.fn(() => ({ width: 250, height: 250 })),
  showWidgetWindow: vi.fn(),
  updateWidgetWindowOpacity: vi.fn(),
  updateWidgetWindowSize: vi.fn(),
  widgetWindow: null,
}));

import { resetWidgetWindowSize, updateWidgetWindowSize } from '../window/widgetWindow';
import { initializeWidgetHandlers } from './widgetHandlers';

const invoke = (channel: string, ...args: unknown[]) =>
  (handlers.get(channel) as Handler)({}, ...args);

describe('widget IPC handlers display mode validation', () => {
  const onSizeChange = vi.fn();
  let consoleError: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(resetWidgetWindowSize).toHaveBeenCalledWith('split');
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
});
