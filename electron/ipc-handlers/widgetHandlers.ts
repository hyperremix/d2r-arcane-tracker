import { ipcMain } from 'electron';
import type { Settings } from '../types/grail';
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
  onSizeChange?: (
    display: 'overall' | 'split' | 'all' | 'run-only',
    size: { width: number; height: number },
  ) => void,
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
      display: 'overall' | 'split' | 'all' | 'run-only',
      settings: Partial<Settings>,
    ) => {
      try {
        updateWidgetWindowSize(display, settings);
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
      display: 'overall' | 'split' | 'all' | 'run-only',
      size: { width: number; height: number },
    ) => {
      try {
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
  ipcMain.handle(
    'widget:reset-size',
    async (_event, display: 'overall' | 'split' | 'all' | 'run-only') => {
      try {
        const defaultSize = resetWidgetWindowSize(display);
        if (defaultSize && onSizeChange) {
          onSizeChange(display, defaultSize);
        }
        return { success: true, size: defaultSize };
      } catch (error) {
        console.error('Failed to reset widget size:', error);
        return { success: false, error: String(error), size: null };
      }
    },
  );

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
