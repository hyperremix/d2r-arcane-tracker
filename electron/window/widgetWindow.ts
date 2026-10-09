import path from 'node:path';
import { BrowserWindow, screen } from 'electron';
import type { Settings } from '../types/grail';
import type { WidgetDisplayMode, WidgetSize } from '../utils/widgetDisplay';
import {
  getDefaultWidgetSize,
  getWidgetSizeSettingKey,
  isWidgetDisplayMode,
  resolveWidgetDisplayMode,
} from '../utils/widgetDisplay';
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
 * The display mode the widget window is currently sized for. Kept up to date whenever the window
 * is created or resized by mode, so resize events are saved under the live mode rather than the
 * settings captured at creation.
 */
let currentDisplayMode: WidgetDisplayMode = 'overall';

/**
 * Whether the widget is locked (click-through). Kept in sync with the setting so re-showing an
 * existing window keeps it inactive while locked.
 */
let widgetLocked = false;

/**
 * Gets the size for a specific display mode from settings or defaults.
 *
 * @param display - The display mode to get size for
 * @param settings - Application settings containing custom sizes
 * @returns The size { width, height } for the display mode
 */
function getWidgetSize(display: WidgetDisplayMode, settings: Partial<Settings>): WidgetSize {
  return (
    settings[getWidgetSizeSettingKey(display)] ||
    getDefaultWidgetSize(display, settings.widgetRunOnlyShowItems)
  );
}

/**
 * Applies the lock (click-through) state to a widget window. A locked widget ignores the mouse
 * (forwarding mouse moves so hover styles keep working) and cannot take focus from the game, so it
 * can't be dragged or resized either. Unlocking restores normal interaction.
 *
 * @param window - The widget window
 * @param locked - Whether the widget should be locked
 */
function applyWidgetLock(window: BrowserWindow, locked: boolean): void {
  if (locked) {
    window.setIgnoreMouseEvents(true, { forward: true });
  } else {
    window.setIgnoreMouseEvents(false);
  }
  window.setFocusable(!locked);
  // Changing focusability can reset these on Windows, so re-assert the overlay behavior
  window.setSkipTaskbar(true);
  window.setAlwaysOnTop(true, 'screen-saver');
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
  onSizeChange?: (display: WidgetDisplayMode, size: WidgetSize) => void,
): BrowserWindow {
  const displayMode = resolveWidgetDisplayMode(settings.widgetDisplay, settings.grailEthereal);
  const size = getWidgetSize(displayMode, settings);
  currentDisplayMode = displayMode;
  widgetLocked = settings.widgetLocked === true;

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
    // A locked widget must never take focus from the game, so it is shown inactive below
    focusable: !widgetLocked,
    show: !widgetLocked,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  widgetWindow.setAlwaysOnTop(true, 'screen-saver');
  if (widgetLocked) {
    applyWidgetLock(widgetWindow, true);
    widgetWindow.showInactive();
  }

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
      onSizeChange(currentDisplayMode, { width: bounds.width, height: bounds.height });
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
  onSizeChange?: (display: WidgetDisplayMode, size: WidgetSize) => void,
): void {
  if (widgetWindow) {
    if (widgetLocked) {
      widgetWindow.showInactive();
    } else {
      widgetWindow.show();
    }
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
 * Updates the widget window size based on new display mode.
 * Uses saved size for the mode if available, otherwise uses default SIZE_MAP.
 *
 * @param display - The new display mode ('overall', 'split', 'all', or 'run-only')
 * @param settings - Application settings containing custom sizes
 */
export function updateWidgetWindowSize(
  display: WidgetDisplayMode,
  settings: Partial<Settings>,
): void {
  if (widgetWindow) {
    const resolvedDisplay = resolveWidgetDisplayMode(display, settings.grailEthereal);
    const newSize = getWidgetSize(resolvedDisplay, settings);
    // Set before resizing: setBounds emits a resize event that is saved under the current mode
    currentDisplayMode = resolvedDisplay;
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
 * Resets the widget window size to the default for the given display mode and makes that mode the
 * one resize events are saved under. Unknown modes are ignored.
 *
 * @param display - The display mode to reset size for
 * @param runOnlyShowItems - Whether the run-only item list is shown (decides the run-only default)
 * @returns The default size for the mode, or null if window doesn't exist
 */
export function resetWidgetWindowSize(
  display: WidgetDisplayMode,
  runOnlyShowItems?: boolean,
): WidgetSize | null {
  if (widgetWindow && isWidgetDisplayMode(display)) {
    const defaultSize = getDefaultWidgetSize(display, runOnlyShowItems);
    currentDisplayMode = display;
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
 * Locks or unlocks the widget window. While locked, clicks pass through the widget to the game
 * and the widget cannot be focused, dragged or resized. The state is also remembered for the next
 * time an existing window is shown.
 *
 * @param locked - Whether the widget should be locked
 * @returns True if the state was applied to an open widget window
 */
export function setWidgetWindowLocked(locked: boolean): boolean {
  widgetLocked = locked;
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    return false;
  }
  applyWidgetLock(widgetWindow, locked);
  if (locked && widgetWindow.isFocused()) {
    widgetWindow.blur();
  }
  return true;
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
