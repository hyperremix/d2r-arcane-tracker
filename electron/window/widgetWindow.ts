import path from 'node:path';
import { BrowserWindow, screen } from 'electron';
import type { Settings } from '../types/grail';
import {
  calculateSnapPosition,
  getDefaultPosition,
  isPositionOnScreen,
} from '../utils/windowSnapping';

/**
 * The widget window instance.
 */
export let widgetWindow: BrowserWindow | null = null;

/**
 * Size mapping for different widget display modes.
 * These are the default sizes used when no custom size is saved.
 */
const SIZE_MAP: Record<
  'overall' | 'split' | 'all' | 'run-only',
  { width: number; height: number }
> = {
  overall: { width: 250, height: 250 }, // Single large gauge
  split: { width: 350, height: 250 }, // Two gauges side by side
  all: { width: 300, height: 350 }, // Overall on top, normal+ethereal below
  'run-only': { width: 270, height: 190 }, // Compact run counter display
};

/**
 * Gets the size for a specific display mode from settings or defaults.
 *
 * @param display - The display mode to get size for
 * @param settings - Application settings containing custom sizes
 * @returns The size { width, height } for the display mode
 */
function getWidgetSize(
  display: 'overall' | 'split' | 'all' | 'run-only',
  settings: Partial<Settings>,
): { width: number; height: number } {
  switch (display) {
    case 'overall':
      return settings.widgetSizeOverall || SIZE_MAP.overall;
    case 'split':
      return settings.widgetSizeSplit || SIZE_MAP.split;
    case 'all':
      return settings.widgetSizeAll || SIZE_MAP.all;
    case 'run-only':
      return SIZE_MAP['run-only'];
  }
}

/**
 * Creates the widget window with the specified settings.
 *
 * @param settings - Application settings containing widget configuration
 * @param __dirname - Directory name for resolving preload script path
 * @param viteDevServerUrl - Vite dev server URL (only in development)
 * @param rendererDist - Path to renderer distribution folder (production)
 * @param onPositionChange - Callback when widget position changes (for saving to settings)
 * @returns The created BrowserWindow instance
 */
export function createWidgetWindow(
  settings: Partial<Settings>,
  __dirname: string,
  viteDevServerUrl?: string,
  rendererDist?: string,
  onPositionChange?: (position: { x: number; y: number }) => void,
  onSizeChange?: (
    display: 'overall' | 'split' | 'all' | 'run-only',
    size: { width: number; height: number },
  ) => void,
): BrowserWindow {
  const displayMode = settings.widgetDisplay || 'overall';
  const size = getWidgetSize(displayMode, settings);

  // Get all displays
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  // Determine window position
  let position = getDefaultPosition(size.width, size.height, primaryDisplay);

  if (settings.widgetPosition) {
    // Validate that saved position is still on screen
    if (isPositionOnScreen(settings.widgetPosition.x, settings.widgetPosition.y, displays)) {
      position = settings.widgetPosition;
    }
  }

  widgetWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: 150,
    minHeight: 150,
    x: position.x,
    y: position.y,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  widgetWindow.setAlwaysOnTop(true, 'screen-saver');

  // Load the widget page
  if (viteDevServerUrl) {
    widgetWindow.loadURL(`${viteDevServerUrl}#/widget`);
  } else {
    widgetWindow.loadFile(path.join(rendererDist || '', 'index.html'), {
      hash: '/widget',
    });
  }

  // Handle window move with snapping
  widgetWindow.on('will-move', (event, newBounds) => {
    if (!widgetWindow) {
      return;
    }

    const display = screen.getDisplayNearestPoint({ x: newBounds.x, y: newBounds.y });
    const { workArea } = display;
    const currentBounds = widgetWindow.getBounds();

    const snappedToLeft = currentBounds.x === workArea.x;
    const snappedToRight = currentBounds.x === workArea.x + workArea.width - currentBounds.width;
    const snappedToTop = currentBounds.y === workArea.y;
    const snappedToBottom = currentBounds.y === workArea.y + workArea.height - currentBounds.height;

    const movingAwayFromLeft = snappedToLeft && newBounds.x > currentBounds.x;
    const movingAwayFromRight = snappedToRight && newBounds.x < currentBounds.x;
    const movingAwayFromTop = snappedToTop && newBounds.y > currentBounds.y;
    const movingAwayFromBottom = snappedToBottom && newBounds.y < currentBounds.y;

    // When the window is currently snapped to an edge and the user drags away from that edge,
    // allow the move without applying snapping again. This prevents the widget from feeling
    // \"stuck\" to the edge.
    if (movingAwayFromLeft || movingAwayFromRight || movingAwayFromTop || movingAwayFromBottom) {
      return;
    }

    const snappedPosition = calculateSnapPosition(
      newBounds.x,
      newBounds.y,
      { x: newBounds.x, y: newBounds.y, width: newBounds.width, height: newBounds.height },
      display,
    );

    // Apply snapped position if different
    if (snappedPosition.x !== newBounds.x || snappedPosition.y !== newBounds.y) {
      event.preventDefault();
      widgetWindow.setBounds({
        x: snappedPosition.x,
        y: snappedPosition.y,
        width: newBounds.width,
        height: newBounds.height,
      });
    }
  });

  // Save position after window is moved
  widgetWindow.on('moved', () => {
    if (widgetWindow && onPositionChange) {
      const bounds = widgetWindow.getBounds();
      onPositionChange({ x: bounds.x, y: bounds.y });
    }
  });

  // Save position before window is closed
  widgetWindow.on('close', () => {
    if (widgetWindow && onPositionChange) {
      const bounds = widgetWindow.getBounds();
      onPositionChange({ x: bounds.x, y: bounds.y });
    }
  });

  // Save size after window is resized
  widgetWindow.on('resize', () => {
    if (widgetWindow && onSizeChange) {
      const bounds = widgetWindow.getBounds();
      const currentDisplay = settings.widgetDisplay || 'overall';
      onSizeChange(currentDisplay, { width: bounds.width, height: bounds.height });
    }
  });

  // Clean up reference when window is closed
  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });

  return widgetWindow;
}

/**
 * Shows the widget window if it exists, or creates it if it doesn't.
 *
 * @param settings - Application settings containing widget configuration
 * @param __dirname - Directory name for resolving preload script path
 * @param viteDevServerUrl - Vite dev server URL (only in development)
 * @param rendererDist - Path to renderer distribution folder (production)
 * @param onPositionChange - Callback when widget position changes (for saving to settings)
 * @param onSizeChange - Callback when widget size changes (for saving to settings)
 */
export function showWidgetWindow(
  settings: Partial<Settings>,
  __dirname: string,
  viteDevServerUrl?: string,
  rendererDist?: string,
  onPositionChange?: (position: { x: number; y: number }) => void,
  onSizeChange?: (
    display: 'overall' | 'split' | 'all' | 'run-only',
    size: { width: number; height: number },
  ) => void,
): void {
  if (widgetWindow) {
    widgetWindow.show();
  } else {
    createWidgetWindow(
      settings,
      __dirname,
      viteDevServerUrl,
      rendererDist,
      onPositionChange,
      onSizeChange,
    );
  }
}

/**
 * Hides the widget window without destroying it.
 */
export function hideWidgetWindow(): void {
  if (widgetWindow) {
    widgetWindow.hide();
  }
}

/**
 * Closes and destroys the widget window.
 */
export function closeWidgetWindow(): void {
  if (widgetWindow) {
    widgetWindow.close();
    widgetWindow = null;
  }
}

/**
 * Gets the current position of the widget window.
 *
 * @returns The current position { x, y } or null if window doesn't exist
 */
export function getWidgetWindowPosition(): { x: number; y: number } | null {
  if (widgetWindow) {
    const bounds = widgetWindow.getBounds();
    return { x: bounds.x, y: bounds.y };
  }
  return null;
}

/**
 * Updates the widget window size based on new display mode.
 * Uses saved size for the mode if available, otherwise uses default SIZE_MAP.
 *
 * @param display - The new display mode ('overall', 'split', 'all', or 'run-only')
 * @param settings - Application settings containing custom sizes
 */
export function updateWidgetWindowSize(
  display: 'overall' | 'split' | 'all' | 'run-only',
  settings: Partial<Settings>,
): void {
  if (widgetWindow) {
    const newSize = getWidgetSize(display, settings);
    const currentBounds = widgetWindow.getBounds();
    widgetWindow.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: newSize.width,
      height: newSize.height,
    });
  }
}

/**
 * Resets the widget window size to default for the current display mode.
 *
 * @param display - The display mode to reset size for
 * @returns The default size for the mode, or null if window doesn't exist
 */
export function resetWidgetWindowSize(
  display: 'overall' | 'split' | 'all' | 'run-only',
): { width: number; height: number } | null {
  if (widgetWindow) {
    const defaultSize = SIZE_MAP[display];
    const currentBounds = widgetWindow.getBounds();
    widgetWindow.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: defaultSize.width,
      height: defaultSize.height,
    });
    return defaultSize;
  }
  return null;
}

/**
 * Updates the widget window opacity.
 * Note: Opacity is now controlled via CSS in the renderer, not at the window level.
 * This function is kept for API compatibility but does nothing.
 *
 * @param _opacity - The new opacity value (0.0 to 1.0) - unused, kept for API compatibility
 */
export function updateWidgetWindowOpacity(_opacity: number): void {
  // Opacity is now controlled via CSS background color, not window-level opacity
  // This prevents the gauge and content from becoming transparent
}
