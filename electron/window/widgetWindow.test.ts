import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppPaths } from '../app/paths';
import type { Settings } from '../types/grail';

interface MockWindow {
  options: { width: number; height: number; focusable?: boolean; show?: boolean };
  handlers: Map<string, (...args: unknown[]) => void>;
  setBounds: ReturnType<typeof vi.fn>;
  setIgnoreMouseEvents: ReturnType<typeof vi.fn>;
  setFocusable: ReturnType<typeof vi.fn>;
  setSkipTaskbar: ReturnType<typeof vi.fn>;
  setAlwaysOnTop: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
  showInactive: ReturnType<typeof vi.fn>;
  isFocused: ReturnType<typeof vi.fn>;
  blur: ReturnType<typeof vi.fn>;
}

const created = vi.hoisted(() => ({ windows: [] as unknown[] }));

vi.mock('electron', () => {
  class BrowserWindow {
    options: { width: number; height: number };
    handlers = new Map<string, (...args: unknown[]) => void>();
    setBounds = vi.fn();
    setAlwaysOnTop = vi.fn();
    setIgnoreMouseEvents = vi.fn();
    setFocusable = vi.fn();
    setSkipTaskbar = vi.fn();
    show = vi.fn();
    showInactive = vi.fn();
    isFocused = vi.fn(() => false);
    blur = vi.fn();
    close = vi.fn();
    loadURL = vi.fn();
    loadFile = vi.fn();
    getBounds = vi.fn(() => ({ x: 10, y: 20, width: 111, height: 222 }));
    isDestroyed = vi.fn(() => false);

    constructor(options: { width: number; height: number }) {
      this.options = options;
      created.windows.push(this);
    }

    on(event: string, handler: (...args: unknown[]) => void) {
      this.handlers.set(event, handler);
    }
  }

  return {
    BrowserWindow,
    screen: {
      getAllDisplays: () => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
      getPrimaryDisplay: () => ({
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      }),
      getDisplayNearestPoint: vi.fn(),
    },
  };
});

import {
  closeWidgetWindow,
  createDebouncedWidgetSizeSaver,
  createWidgetWindow,
  resetWidgetWindowSize,
  setWidgetWindowLocked,
  showWidgetWindow,
  updateWidgetWindowSize,
} from './widgetWindow';

const testPaths: AppPaths = {
  appRoot: '/app',
  mainDist: '/app/dist-electron',
  rendererDist: '/app/dist',
  publicDir: '/app/dist',
};

const overallSize = { width: 250, height: 250 };
const splitSize = { width: 350, height: 250 };
const runOnlyWithItemsSize = { width: 270, height: 320 };
const runOnlyStatsOnlySize = { width: 270, height: 190 };

describe('widgetWindow display mode resolution', () => {
  beforeEach(() => {
    created.windows.length = 0;
  });

  it('If split mode is stored but ethereal tracking is off, Then the window uses the overall size', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'split', grailEthereal: false };

    // Act
    createWidgetWindow(settings, testPaths);

    // Assert
    const window = created.windows[0] as MockWindow;
    expect(window.options.width).toBe(overallSize.width);
    expect(window.options.height).toBe(overallSize.height);
  });

  it('If split mode is stored and ethereal tracking is on, Then the window uses the split size', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'split', grailEthereal: true };

    // Act
    createWidgetWindow(settings, testPaths);

    // Assert
    const window = created.windows[0] as MockWindow;
    expect(window.options.width).toBe(splitSize.width);
    expect(window.options.height).toBe(splitSize.height);
  });

  it('If the window is resized while split falls back to overall, Then the size is saved for overall', () => {
    // Arrange
    const onSizeChange = vi.fn();
    createWidgetWindow(
      { widgetDisplay: 'split', grailEthereal: false },
      testPaths,
      undefined,
      onSizeChange,
    );
    const window = created.windows[0] as MockWindow;

    // Act
    window.handlers.get('resize')?.();

    // Assert
    expect(onSizeChange).toHaveBeenCalledWith('overall', { width: 111, height: 222 });
  });

  it('When the display mode is updated to split without ethereal tracking, Then the overall size is applied', () => {
    // Arrange
    createWidgetWindow({ widgetDisplay: 'overall', grailEthereal: false }, testPaths);
    const window = created.windows[0] as MockWindow;

    // Act
    updateWidgetWindowSize('split', { grailEthereal: false });

    // Assert
    expect(window.setBounds).toHaveBeenCalledWith({ x: 10, y: 20, ...overallSize });
  });

  it('When the size is reset for a known mode, Then the default size of that mode is applied', () => {
    // Arrange
    createWidgetWindow({ widgetDisplay: 'overall' }, testPaths);
    const window = created.windows[0] as MockWindow;

    // Act
    const size = resetWidgetWindowSize('split');

    // Assert
    expect(size).toEqual(splitSize);
    expect(window.setBounds).toHaveBeenCalledWith({ x: 10, y: 20, ...splitSize });
  });

  it('If the size is reset for an unknown mode, Then nothing is applied', () => {
    // Arrange
    createWidgetWindow({ widgetDisplay: 'overall' }, testPaths);
    const window = created.windows[0] as MockWindow;
    const unknownMode = 'constructor' as unknown as Parameters<typeof resetWidgetWindowSize>[0];

    // Act
    const size = resetWidgetWindowSize(unknownMode);

    // Assert
    expect(size).toBeNull();
    expect(window.setBounds).not.toHaveBeenCalled();
  });

  it('When the display mode is switched after creation, Then a resize is saved under the new mode', () => {
    // Arrange
    const onSizeChange = vi.fn();
    createWidgetWindow(
      { widgetDisplay: 'overall', grailEthereal: true },
      testPaths,
      undefined,
      onSizeChange,
    );
    const window = created.windows[0] as MockWindow;
    updateWidgetWindowSize('split', { widgetDisplay: 'split', grailEthereal: true });

    // Act
    window.handlers.get('resize')?.();

    // Assert
    expect(onSizeChange).toHaveBeenLastCalledWith('split', { width: 111, height: 222 });
  });

  it('If ethereal tracking is toggled off after creation, Then a resize is saved under overall', () => {
    // Arrange
    const onSizeChange = vi.fn();
    const stored: Partial<Settings> = { widgetDisplay: 'split', grailEthereal: true };
    createWidgetWindow(stored, testPaths, undefined, onSizeChange);
    const window = created.windows[0] as MockWindow;
    updateWidgetWindowSize('overall', { ...stored, grailEthereal: false });

    // Act
    window.handlers.get('resize')?.();

    // Assert
    expect(onSizeChange).toHaveBeenLastCalledWith('overall', { width: 111, height: 222 });
  });

  it('If ethereal tracking is toggled back on, Then a resize is saved under split again', () => {
    // Arrange
    const onSizeChange = vi.fn();
    const stored: Partial<Settings> = { widgetDisplay: 'split', grailEthereal: true };
    createWidgetWindow(stored, testPaths, undefined, onSizeChange);
    const window = created.windows[0] as MockWindow;
    updateWidgetWindowSize('overall', { ...stored, grailEthereal: false });
    updateWidgetWindowSize('split', { ...stored, grailEthereal: true });

    // Act
    window.handlers.get('resize')?.();

    // Assert
    expect(onSizeChange).toHaveBeenLastCalledWith('split', { width: 111, height: 222 });
  });

  it('If resizing the window synchronously emits a resize event, Then the size is saved under the new mode', () => {
    // Arrange
    const onSizeChange = vi.fn();
    createWidgetWindow(
      { widgetDisplay: 'overall', grailEthereal: true },
      testPaths,
      undefined,
      onSizeChange,
    );
    const window = created.windows[0] as MockWindow;
    window.setBounds.mockImplementation(() => window.handlers.get('resize')?.());

    // Act
    updateWidgetWindowSize('split', { widgetDisplay: 'split', grailEthereal: true });

    // Assert
    expect(onSizeChange).toHaveBeenCalledTimes(1);
    expect(onSizeChange).toHaveBeenCalledWith('split', { width: 111, height: 222 });
  });

  it('When the size is reset for a mode, Then a following resize is saved under that mode', () => {
    // Arrange
    const onSizeChange = vi.fn();
    createWidgetWindow(
      { widgetDisplay: 'overall', grailEthereal: true },
      testPaths,
      undefined,
      onSizeChange,
    );
    const window = created.windows[0] as MockWindow;

    // Act
    resetWidgetWindowSize('all');
    window.handlers.get('resize')?.();

    // Assert
    expect(onSizeChange).toHaveBeenLastCalledWith('all', { width: 111, height: 222 });
  });
});

describe('widgetWindow run-only sizing', () => {
  beforeEach(() => {
    created.windows.length = 0;
  });

  it('If run-only mode shows the item list and no size is saved, Then the taller default is used', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'run-only' };

    // Act
    createWidgetWindow(settings, testPaths);

    // Assert
    const window = created.windows[0] as MockWindow;
    expect(window.options.width).toBe(runOnlyWithItemsSize.width);
    expect(window.options.height).toBe(runOnlyWithItemsSize.height);
  });

  it('If run-only mode hides the item list and no size is saved, Then the compact default is used', () => {
    // Arrange
    const settings: Partial<Settings> = {
      widgetDisplay: 'run-only',
      widgetRunOnlyShowItems: false,
    };

    // Act
    createWidgetWindow(settings, testPaths);

    // Assert
    const window = created.windows[0] as MockWindow;
    expect(window.options.width).toBe(runOnlyStatsOnlySize.width);
    expect(window.options.height).toBe(runOnlyStatsOnlySize.height);
  });

  it('If a run-only size is saved, Then the window uses it', () => {
    // Arrange
    const settings: Partial<Settings> = {
      widgetDisplay: 'run-only',
      widgetSizeRunOnly: { width: 300, height: 410 },
    };

    // Act
    createWidgetWindow(settings, testPaths);

    // Assert
    const window = created.windows[0] as MockWindow;
    expect(window.options.width).toBe(300);
    expect(window.options.height).toBe(410);
  });

  it('When the run-only window is resized, Then the size is saved under run-only', () => {
    // Arrange
    const onSizeChange = vi.fn();
    createWidgetWindow({ widgetDisplay: 'run-only' }, testPaths, undefined, onSizeChange);
    const window = created.windows[0] as MockWindow;

    // Act
    window.handlers.get('resize')?.();

    // Assert
    expect(onSizeChange).toHaveBeenCalledWith('run-only', { width: 111, height: 222 });
  });

  it('When the run-only size is reset without the item list, Then the compact default is applied', () => {
    // Arrange
    createWidgetWindow({ widgetDisplay: 'run-only' }, testPaths);
    const window = created.windows[0] as MockWindow;

    // Act
    const size = resetWidgetWindowSize('run-only', false);

    // Assert
    expect(size).toEqual(runOnlyStatsOnlySize);
    expect(window.setBounds).toHaveBeenCalledWith({ x: 10, y: 20, ...runOnlyStatsOnlySize });
  });
});

describe('widgetWindow lock (click-through)', () => {
  beforeEach(() => {
    created.windows.length = 0;
    closeWidgetWindow();
  });

  it('If the widget is stored as locked, Then it is created click-through, unfocusable and shown inactive', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'overall', widgetLocked: true };

    // Act
    createWidgetWindow(settings, testPaths);

    // Assert
    const window = created.windows[0] as MockWindow;
    expect(window.options.focusable).toBe(false);
    expect(window.options.show).toBe(false);
    expect(window.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
    expect(window.setFocusable).toHaveBeenCalledWith(false);
    expect(window.showInactive).toHaveBeenCalledTimes(1);
  });

  it('If the widget is not locked, Then it is created focusable and receives mouse events', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'overall' };

    // Act
    createWidgetWindow(settings, testPaths);

    // Assert
    const window = created.windows[0] as MockWindow;
    expect(window.options.focusable).toBe(true);
    expect(window.options.show).toBe(true);
    expect(window.setIgnoreMouseEvents).not.toHaveBeenCalled();
    expect(window.showInactive).not.toHaveBeenCalled();
  });

  it('When the widget is locked while open, Then clicks pass through and it gives up focus', () => {
    // Arrange
    createWidgetWindow({ widgetDisplay: 'overall' }, testPaths);
    const window = created.windows[0] as MockWindow;
    window.isFocused.mockReturnValue(true);

    // Act
    const applied = setWidgetWindowLocked(true);

    // Assert
    expect(applied).toBe(true);
    expect(window.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
    expect(window.setFocusable).toHaveBeenCalledWith(false);
    expect(window.blur).toHaveBeenCalledTimes(1);
    expect(window.setSkipTaskbar).toHaveBeenCalledWith(true);
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(true, 'screen-saver');
  });

  it('When the widget is unlocked, Then mouse events and focus are restored', () => {
    // Arrange
    createWidgetWindow({ widgetDisplay: 'overall', widgetLocked: true }, testPaths);
    const window = created.windows[0] as MockWindow;
    window.setIgnoreMouseEvents.mockClear();
    window.setFocusable.mockClear();

    // Act
    const applied = setWidgetWindowLocked(false);

    // Assert
    expect(applied).toBe(true);
    expect(window.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    expect(window.setFocusable).toHaveBeenCalledWith(true);
  });

  it('If an existing locked widget is shown again, Then it is shown without taking focus', () => {
    // Arrange
    createWidgetWindow({ widgetDisplay: 'overall', widgetLocked: true }, testPaths);
    const window = created.windows[0] as MockWindow;
    window.showInactive.mockClear();

    // Act
    showWidgetWindow({ widgetDisplay: 'overall', widgetLocked: true }, testPaths);

    // Assert
    expect(window.showInactive).toHaveBeenCalledTimes(1);
    expect(window.show).not.toHaveBeenCalled();
  });

  it('If no widget window is open, Then locking reports that nothing was applied', () => {
    // Arrange: the window was closed in beforeEach

    // Act
    const applied = setWidgetWindowLocked(true);

    // Assert
    expect(applied).toBe(false);
  });
});

describe('When widget size changes are saved with the debounced saver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Then only the last size of a resize is saved once resizing stops', () => {
    // Arrange
    const persist = vi.fn();
    const saver = createDebouncedWidgetSizeSaver(persist, 500);

    // Act
    saver.save('overall', { width: 260, height: 260 });
    vi.advanceTimersByTime(300);
    saver.save('overall', { width: 280, height: 270 });
    vi.advanceTimersByTime(499);
    const savedBeforeDelay = persist.mock.calls.length;
    vi.advanceTimersByTime(1);

    // Assert
    expect(savedBeforeDelay).toBe(0);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('overall', { width: 280, height: 270 });
  });

  it('If flush is called while a save is pending, Then it is saved right away and only once', () => {
    // Arrange
    const persist = vi.fn();
    const saver = createDebouncedWidgetSizeSaver(persist, 500);
    saver.save('split', { width: 350, height: 260 });

    // Act
    saver.flush();
    vi.advanceTimersByTime(1000);
    saver.flush();

    // Assert
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('split', { width: 350, height: 260 });
  });

  it('If saving fails, Then the error is logged instead of thrown', () => {
    // Arrange
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const saver = createDebouncedWidgetSizeSaver(() => {
      throw new Error('database closed');
    }, 500);
    saver.save('overall', { width: 260, height: 260 });

    // Act
    const flush = () => saver.flush();

    // Assert
    expect(flush).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith('Failed to save widget size:', expect.any(Error));
    consoleError.mockRestore();
  });
});
