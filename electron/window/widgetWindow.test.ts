import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../types/grail';

interface MockWindow {
  options: { width: number; height: number };
  handlers: Map<string, (...args: unknown[]) => void>;
  setBounds: ReturnType<typeof vi.fn>;
}

const created = vi.hoisted(() => ({ windows: [] as unknown[] }));

vi.mock('electron', () => {
  class BrowserWindow {
    options: { width: number; height: number };
    handlers = new Map<string, (...args: unknown[]) => void>();
    setBounds = vi.fn();
    setAlwaysOnTop = vi.fn();
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

import { createWidgetWindow, updateWidgetWindowSize } from './widgetWindow';

const overallSize = { width: 250, height: 250 };
const splitSize = { width: 350, height: 250 };

describe('widgetWindow display mode resolution', () => {
  beforeEach(() => {
    created.windows.length = 0;
  });

  it('If split mode is stored but ethereal tracking is off, Then the window uses the overall size', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'split', grailEthereal: false };

    // Act
    createWidgetWindow(settings, '/app');

    // Assert
    const window = created.windows[0] as MockWindow;
    expect(window.options.width).toBe(overallSize.width);
    expect(window.options.height).toBe(overallSize.height);
  });

  it('If split mode is stored and ethereal tracking is on, Then the window uses the split size', () => {
    // Arrange
    const settings: Partial<Settings> = { widgetDisplay: 'split', grailEthereal: true };

    // Act
    createWidgetWindow(settings, '/app');

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
      '/app',
      undefined,
      undefined,
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
    createWidgetWindow({ widgetDisplay: 'overall', grailEthereal: false }, '/app');
    const window = created.windows[0] as MockWindow;

    // Act
    updateWidgetWindowSize('split', { grailEthereal: false });

    // Assert
    expect(window.setBounds).toHaveBeenCalledWith({ x: 10, y: 20, ...overallSize });
  });
});
