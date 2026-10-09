import { BrowserWindow, nativeTheme, screen } from 'electron';
import { type AppPaths, getAppIconPath } from '../app/paths';
import type { SettingsService } from '../services/settingsService';
import type { Settings } from '../types/grail';
import { isPositionOnScreen } from '../utils/windowSnapping';
import { createAppWindow } from './appWindow';
import { getMainWindowThemeColors } from './mainWindowTheme';

/** Options for creating the main window. */
export interface MainWindowOptions {
  /** Settings storing the window bounds and the theme. */
  settings: SettingsService;
  /** Locations of the preload script, the renderer and the app icon. */
  paths: AppPaths;
}

/**
 * The main application window instance.
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Returns the main window, unless it was closed.
 */
export function getMainWindow(): BrowserWindow | undefined {
  return mainWindow ?? undefined;
}

/**
 * Saves the current main window bounds (position and size) to the settings.
 */
function saveMainWindowBounds(settingsService: SettingsService) {
  if (!mainWindow) {
    return;
  }

  try {
    settingsService.set('mainWindowBounds', mainWindow.getBounds());
  } catch (error) {
    console.error('Failed to save main window bounds:', error);
  }
}

/**
 * Creates the main application window with appropriate icon and web preferences.
 * Loads the application from the Vite dev server in development or from built files in production.
 * @param options - Settings and app locations
 * @returns The created window
 */
export function createMainWindow({
  settings: settingsService,
  paths,
}: MainWindowOptions): BrowserWindow {
  // Load saved window bounds from settings
  let windowBounds = {
    width: 1200,
    height: 856,
    x: undefined as number | undefined,
    y: undefined as number | undefined,
  };
  let storedTheme: Settings['theme'] | undefined;
  try {
    const settings = settingsService.getAll();
    storedTheme = settings.theme;

    if (settings.mainWindowBounds) {
      const { x, y, width, height } = settings.mainWindowBounds;

      // Validate that saved position is still on screen
      const displays = screen.getAllDisplays();
      if (isPositionOnScreen(x, y, displays)) {
        windowBounds = { x, y, width, height };
      } else {
        // Position is off-screen, use saved size but let OS choose position
        windowBounds = { width, height, x: undefined, y: undefined };
      }
    }
  } catch (error) {
    console.error('Failed to load main window bounds from settings:', error);
  }

  // Match the renderer's theme so the window doesn't flash the wrong color before it paints
  const themeColors = getMainWindowThemeColors(storedTheme, nativeTheme.shouldUseDarkColors);

  const window = createAppWindow(BrowserWindow, {
    paths,
    width: windowBounds.width,
    height: windowBounds.height,
    // Keep the custom title bar (navigation, notifications, platform controls) from overflowing
    minWidth: 800,
    ...(windowBounds.x !== undefined && windowBounds.y !== undefined
      ? { x: windowBounds.x, y: windowBounds.y }
      : {}),
    // ICO on packaged Windows builds for better compatibility
    icon: getAppIconPath(paths),
    backgroundColor: themeColors.backgroundColor,
    // Custom title bar configuration
    titleBarStyle: 'hidden',
    // Position macOS traffic lights to be vertically centered in 48px title bar
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 10, y: 14 } }
      : {
          // Expose window controls on Windows/Linux with custom styling
          titleBarOverlay: {
            color: themeColors.backgroundColor, // Background matching the title bar
            symbolColor: themeColors.symbolColor,
            height: 47, // Match title bar height (h-12 = 48px)
          },
        }),
  });
  mainWindow = window;

  // Enable dev tools keyboard shortcut in production
  // Cmd+Option+I (macOS) or Ctrl+Shift+I (Windows/Linux)
  window.webContents.on('before-input-event', (event, input) => {
    const isMac = process.platform === 'darwin';
    const isDevToolsShortcut = isMac
      ? input.meta && input.alt && input.key.toLowerCase() === 'i'
      : input.control && input.shift && input.key.toLowerCase() === 'i';

    if (isDevToolsShortcut) {
      window.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Save window bounds when moved
  window.on('moved', () => {
    saveMainWindowBounds(settingsService);
  });

  // Debounce timer for window resize
  let resizeTimeout: NodeJS.Timeout | null = null;

  // Save window bounds when resized (debounced)
  window.on('resize', () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    resizeTimeout = setTimeout(() => {
      saveMainWindowBounds(settingsService);
    }, 500); // Wait 500ms after resize stops before saving
  });

  // Ensure bounds are saved before window closes
  window.on('close', () => {
    // Clear any pending resize timeout
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    saveMainWindowBounds(settingsService);
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}
