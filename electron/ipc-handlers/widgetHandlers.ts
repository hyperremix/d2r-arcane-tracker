import { ipcMain } from 'electron';
import { grailDatabase } from '../database/database';
import type { Settings } from '../types/grail';
import type { WidgetDisplayMode } from '../utils/widgetDisplay';
import { isWidgetDisplayMode } from '../utils/widgetDisplay';
import {
  closeWidgetWindow,
  getWidgetWindowPosition,
  resetWidgetWindowSize,
  showWidgetWindow,
  updateWidgetWindowOpacity,
  updateWidgetWindowSize,
  widgetWindow,
} from '../window/widgetWindow';

/**
 * Builds the settings used to size the widget window. The custom window sizes are read from the
 * database because the renderer's settings snapshot can be stale (sizes are saved without being
 * broadcast); only the ethereal flag, which decides the resolved display mode, comes from the
 * renderer. Falls back to the renderer-provided settings if the database cannot be read.
 *
 * @param rendererSettings - Settings snapshot sent by the renderer
 * @returns Settings to size the widget window with
 */
function getSettingsForWidgetSizing(rendererSettings: Partial<Settings>): Partial<Settings> {
  try {
    const persisted = grailDatabase.getAllSettings();
    return {
      ...rendererSettings,
      widgetSizeOverall: persisted.widgetSizeOverall,
      widgetSizeSplit: persisted.widgetSizeSplit,
      widgetSizeAll: persisted.widgetSizeAll,
      grailEthereal:
        typeof rendererSettings?.grailEthereal === 'boolean'
          ? rendererSettings.grailEthereal
          : persisted.grailEthereal,
    };
  } catch (error) {
    console.error('Failed to read persisted widget sizes:', error);
    return rendererSettings;
  }
}

/**
 * Initializes IPC handlers for widget window operations.
 * Sets up handlers for toggling, positioning, and updating the widget window.
 *
 * @param __dirname - Directory name for resolving preload script path
 * @param viteDevServerUrl - Vite dev server URL (only in development)
 * @param rendererDist - Path to renderer distribution folder (production)
 * @param onPositionChange - Callback when widget position changes (for saving to settings)
 * @param onSizeChange - Callback when widget size changes (for saving to settings)
 */
export function initializeWidgetHandlers(
  __dirname: string,
  viteDevServerUrl?: string,
  rendererDist?: string,
  onPositionChange?: (position: { x: number; y: number }) => void,
  onSizeChange?: (display: WidgetDisplayMode, size: { width: number; height: number }) => void,
): void {
  /**
   * Toggle widget visibility based on settings.
   */
  ipcMain.handle('widget:toggle', async (_event, enabled: boolean, settings: Partial<Settings>) => {
    try {
      if (enabled) {
        showWidgetWindow(
          settings,
          __dirname,
          viteDevServerUrl,
          rendererDist,
          onPositionChange,
          onSizeChange,
        );
      } else {
        closeWidgetWindow();
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to toggle widget:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * Get current widget position.
   */
  ipcMain.handle('widget:get-position', async () => {
    try {
      const position = getWidgetWindowPosition();
      return { success: true, position };
    } catch (error) {
      console.error('Failed to get widget position:', error);
      return { success: false, error: String(error), position: null };
    }
  });

  /**
   * Update widget position (called during drag).
   */
  ipcMain.handle('widget:update-position', async (_event, position: { x: number; y: number }) => {
    try {
      if (onPositionChange) {
        onPositionChange(position);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to update widget position:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * Update widget display mode.
   */
  ipcMain.handle(
    'widget:update-display',
    async (
      _event,
      display: unknown, // Renderer-provided: validated below
      settings: Partial<Settings>,
    ) => {
      try {
        if (!isWidgetDisplayMode(display)) {
          return { success: false, error: 'Invalid widget display mode' };
        }
        updateWidgetWindowSize(display, getSettingsForWidgetSizing(settings));
        return { success: true };
      } catch (error) {
        console.error('Failed to update widget display mode:', error);
        return { success: false, error: String(error) };
      }
    },
  );

  /**
   * Update widget opacity.
   */
  ipcMain.handle('widget:update-opacity', async (_event, opacity: number) => {
    try {
      updateWidgetWindowOpacity(opacity);
      return { success: true };
    } catch (error) {
      console.error('Failed to update widget opacity:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * Check if widget is currently open.
   */
  ipcMain.handle('widget:is-open', async () => {
    try {
      return { success: true, isOpen: widgetWindow !== null && !widgetWindow.isDestroyed() };
    } catch (error) {
      console.error('Failed to check widget status:', error);
      return { success: false, isOpen: false };
    }
  });

  /**
   * Update widget size (called manually from settings or after resize).
   */
  ipcMain.handle(
    'widget:update-size',
    async (
      _event,
      display: unknown, // Renderer-provided: validated below
      size: { width: number; height: number },
    ) => {
      try {
        if (!isWidgetDisplayMode(display)) {
          return { success: false, error: 'Invalid widget display mode' };
        }
        if (onSizeChange) {
          onSizeChange(display, size);
        }
        return { success: true };
      } catch (error) {
        console.error('Failed to update widget size:', error);
        return { success: false, error: String(error) };
      }
    },
  );

  /**
   * Reset widget size to default for current display mode.
   */
  ipcMain.handle('widget:reset-size', async (_event, display: unknown) => {
    try {
      if (!isWidgetDisplayMode(display)) {
        return { success: false, error: 'Invalid widget display mode', size: null };
      }
      const defaultSize = resetWidgetWindowSize(display);
      if (defaultSize && onSizeChange) {
        onSizeChange(display, defaultSize);
      }
      return { success: true, size: defaultSize };
    } catch (error) {
      console.error('Failed to reset widget size:', error);
      return { success: false, error: String(error), size: null };
    }
  });

  /**
   * Reset widget position to center of screen.
   */
  ipcMain.handle('widget:reset-position', async () => {
    try {
      if (widgetWindow) {
        widgetWindow.center();
        const newBounds = widgetWindow.getBounds();
        if (onPositionChange) {
          onPositionChange({ x: newBounds.x, y: newBounds.y });
        }
        return { success: true, position: { x: newBounds.x, y: newBounds.y } };
      }
      return { success: true, position: null };
    } catch (error) {
      console.error('Failed to reset widget position:', error);
      return { success: false, error: String(error), position: null };
    }
  });
}
