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
 */
const SIZE_MAP: Record<'overall' | 'split' | 'all', { width: number; height: number }> = {
  overall: { width: 250, height: 250 }, // Single large gauge
  split: { width: 350, height: 250 }, // Two gauges side by side
  all: { width: 300, height: 350 }, // Overall on top, normal+ethereal below
};

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
): BrowserWindow {
  const size = SIZE_MAP[settings.widgetDisplay || 'overall'];

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
    x: position.x,
    y: position.y,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
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
    const display = screen.getDisplayNearestPoint({ x: newBounds.x, y: newBounds.y });
    const snappedPosition = calculateSnapPosition(
      newBounds.x,
      newBounds.y,
      { x: newBounds.x, y: newBounds.y, width: newBounds.width, height: newBounds.height },
      display,
    );

    // Apply snapped position if different
    if (snappedPosition.x !== newBounds.x || snappedPosition.y !== newBounds.y) {
      event.preventDefault();
      widgetWindow?.setBounds({
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
 */
export function showWidgetWindow(
  settings: Partial<Settings>,
  __dirname: string,
  viteDevServerUrl?: string,
  rendererDist?: string,
  onPositionChange?: (position: { x: number; y: number }) => void,
): void {
  if (widgetWindow) {
    widgetWindow.show();
  } else {
    createWidgetWindow(settings, __dirname, viteDevServerUrl, rendererDist, onPositionChange);
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
 *
 * @param display - The new display mode ('overall', 'split', or 'all')
 */
export function updateWidgetWindowSize(display: 'overall' | 'split' | 'all'): void {
  if (widgetWindow) {
    const newSize = SIZE_MAP[display];
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
