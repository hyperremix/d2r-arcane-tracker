import { ipcMain } from 'electron';
import type { AppPaths } from '../app/paths';
import { createIpcMainRegistry } from '../ipc/handle';
import type { SettingsService } from '../services/settingsService';
import type { Settings } from '../types/grail';
import type { WidgetDisplayMode, WidgetSize } from '../utils/widgetDisplay';
import { isWidgetDisplayMode } from '../utils/widgetDisplay';
import {
  closeWidgetWindow,
  resetWidgetWindowSize,
  setWidgetWindowLocked,
  showWidgetWindow,
  updateWidgetWindowOpacity,
  updateWidgetWindowSize,
  widgetWindow,
} from '../window/widgetWindow';

/**
 * Builds the settings used to create, size and lock the widget window. The custom window sizes, the
 * run-only item list flag (which decides the run-only default size) and the lock state are read
 * from the database because the renderer's settings snapshot can be stale (sizes are saved without
 * being broadcast); only the ethereal flag, which decides the resolved display mode, comes from the
 * renderer. Falls back to the renderer-provided settings if the database cannot be read.
 *
 * @param rendererSettings - Settings snapshot sent by the renderer
 * @returns Settings to create or size the widget window with
 */
function getSettingsForWidgetWindow(
  settingsService: SettingsService,
  rendererSettings: Partial<Settings>,
): Partial<Settings> {
  try {
    const persisted = settingsService.getAll();
    return {
      ...rendererSettings,
      widgetSizeOverall: persisted.widgetSizeOverall,
      widgetSizeSplit: persisted.widgetSizeSplit,
      widgetSizeAll: persisted.widgetSizeAll,
      widgetSizeRunOnly: persisted.widgetSizeRunOnly,
      widgetRunOnlyShowItems: persisted.widgetRunOnlyShowItems,
      widgetLocked: persisted.widgetLocked,
      grailEthereal:
        typeof rendererSettings?.grailEthereal === 'boolean'
          ? rendererSettings.grailEthereal
          : persisted.grailEthereal,
    };
  } catch (error) {
    console.error('Failed to read persisted widget window settings:', error);
    return rendererSettings;
  }
}

/**
 * Initializes IPC handlers for widget window operations.
 * Sets up handlers for toggling, positioning, and updating the widget window.
 *
 * @param settingsService - Settings service storing the widget settings
 * @param paths - Locations of the preload script and the renderer
 * @param onPositionChange - Callback when widget position changes (for saving to settings)
 * @param onSizeChange - Callback when widget size changes (for saving to settings)
 * @returns Function that removes the handlers
 */
export function initializeWidgetHandlers(
  settingsService: SettingsService,
  paths: AppPaths,
  onPositionChange?: (position: { x: number; y: number }) => void,
  onSizeChange?: (display: WidgetDisplayMode, size: WidgetSize) => void,
): () => void {
  const { handle, dispose } = createIpcMainRegistry(ipcMain);
  /**
   * Toggle widget visibility based on settings.
   */
  handle('widget:toggle', async (_event, enabled, settings) => {
    try {
      if (enabled) {
        showWidgetWindow(
          getSettingsForWidgetWindow(settingsService, settings),
          paths,
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
   * Update widget display mode.
   */
  handle(
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
        updateWidgetWindowSize(display, getSettingsForWidgetWindow(settingsService, settings));
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
  handle('widget:update-opacity', async (_event, opacity) => {
    try {
      updateWidgetWindowOpacity(opacity);
      return { success: true };
    } catch (error) {
      console.error('Failed to update widget opacity:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * Lock or unlock the widget (click-through mode).
   */
  handle(
    'widget:set-locked',
    async (
      _event,
      locked: unknown, // Renderer-provided: validated below
    ) => {
      try {
        if (typeof locked !== 'boolean') {
          return { success: false, error: 'Invalid widget lock state' };
        }
        setWidgetWindowLocked(locked);
        return { success: true };
      } catch (error) {
        console.error('Failed to update widget lock state:', error);
        return { success: false, error: String(error) };
      }
    },
  );

  /**
   * Reset widget size to default for current display mode.
   */
  handle('widget:reset-size', async (_event, display: unknown) => {
    try {
      if (!isWidgetDisplayMode(display)) {
        return { success: false, error: 'Invalid widget display mode', size: null };
      }
      const defaultSize = resetWidgetWindowSize(
        display,
        getSettingsForWidgetWindow(settingsService, {}).widgetRunOnlyShowItems,
      );
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
  handle('widget:reset-position', async () => {
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

  return dispose;
}
