import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, type IpcMainEvent, ipcMain, session } from 'electron';
import { GrailDatabase, grailDatabase } from './database/database';
import { initializeDialogHandlers } from './ipc-handlers/dialogHandlers';
import { closeGrailDatabase, initializeGrailHandlers } from './ipc-handlers/grailHandlers';
import { initializeIconHandlers } from './ipc-handlers/iconHandlers';
import { closeSaveFileMonitor, initializeSaveFileHandlers } from './ipc-handlers/saveFileHandlers';
import { initializeShellHandlers } from './ipc-handlers/shellHandlers';
import { initializeTerrorZoneHandlers } from './ipc-handlers/terrorZoneHandlers';
import { initializeUpdateHandlers } from './ipc-handlers/updateHandlers';
import { initializeWidgetHandlers } from './ipc-handlers/widgetHandlers';
import { closeWidgetWindow, showWidgetWindow } from './window/widgetWindow';

createRequire(import.meta.url);
/**
 * The directory name of the current module.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The built directory structure:
 *
 * ```
 * ├─┬─┬ dist
 * │ │ └── index.html
 * │ │
 * │ ├─┬ dist-electron
 * │ │ ├── main.js
 * │ │ └── preload.mjs
 * ```
 */
process.env.APP_ROOT = path.join(__dirname, '..');

/**
 * Vite development server URL (only available in development mode).
 */
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
/**
 * Path to the main process distribution folder.
 */
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
/**
 * Path to the renderer process distribution folder.
 */
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

/**
 * The main application window instance.
 */
export let mainWindow: BrowserWindow | null;

/**
 * Creates the main application window with appropriate icon and web preferences.
 * Loads the application from the Vite dev server in development or from built files in production.
 */
function createWindow() {
  // Set icon path - use ICO on Windows for better compatibility
  // In production, the ICO file is unpacked from ASAR for Windows to read
  const iconPath =
    process.platform === 'win32' && !VITE_DEV_SERVER_URL
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'logo.ico')
      : path.join(process.env.VITE_PUBLIC, 'logo.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 856,
    icon: iconPath,
    // Custom title bar configuration
    titleBarStyle: 'hidden',
    // Position macOS traffic lights to be vertically centered in 48px title bar
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 10, y: 14 } }
      : {
          // Expose window controls on Windows/Linux with custom styling
          titleBarOverlay: {
            color: '#1f2937', // Dark background matching title bar
            symbolColor: '#e5e7eb', // Light gray symbols
            height: 48, // Match title bar height (h-12 = 48px)
          },
        }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Test active push message to Renderer-process.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  // Enable dev tools keyboard shortcut in production
  // Cmd+Option+I (macOS) or Ctrl+Shift+I (Windows/Linux)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isMac = process.platform === 'darwin';
    const isDevToolsShortcut = isMac
      ? input.meta && input.alt && input.key.toLowerCase() === 'i'
      : input.control && input.shift && input.key.toLowerCase() === 'i';

    if (isDevToolsShortcut) {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    mainWindow = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Set the app name to ensure native notifications display correctly
app.setName('D2R Arcane Tracker');

app.whenReady().then(() => {
  const isDev = !!VITE_DEV_SERVER_URL;

  // Set up Content Security Policy
  const prodCsp =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'";
  const devCsp =
    "default-src 'self' http://localhost:5173; script-src 'self' 'unsafe-inline' http://localhost:5173; style-src 'self' 'unsafe-inline' http://localhost:5173; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://localhost:5173 http://localhost:5173; frame-src 'none'; object-src 'none'; base-uri 'self'";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders ?? {};
    headers['Content-Security-Policy'] = [isDev ? devCsp : prodCsp];
    callback({ responseHeaders: headers });
  });

  // Initialize grail database and IPC handlers
  initializeGrailHandlers();
  initializeSaveFileHandlers();
  initializeDialogHandlers();
  initializeShellHandlers();
  initializeIconHandlers();
  initializeTerrorZoneHandlers();
  initializeUpdateHandlers();

  // Initialize widget handlers with callbacks for position and size updates
  const onWidgetPositionChange = (position: { x: number; y: number }) => {
    // Save widget position to database
    try {
      grailDatabase.setSetting('widgetPosition', JSON.stringify(position));
    } catch (error) {
      console.error('Failed to save widget position:', error);
    }
  };

  // Debounce timer for widget size changes
  let widgetSizeChangeTimeout: NodeJS.Timeout | null = null;

  const onWidgetSizeChange = (
    display: 'overall' | 'split' | 'all',
    size: { width: number; height: number },
  ) => {
    // Debounce widget size changes to avoid excessive database writes during resize
    if (widgetSizeChangeTimeout) {
      clearTimeout(widgetSizeChangeTimeout);
    }

    widgetSizeChangeTimeout = setTimeout(() => {
      try {
        const settingKey = `widgetSize${display.charAt(0).toUpperCase()}${display.slice(1)}` as
          | 'widgetSizeOverall'
          | 'widgetSizeSplit'
          | 'widgetSizeAll';
        grailDatabase.setSetting(settingKey, JSON.stringify(size));
      } catch (error) {
        console.error('Failed to save widget size:', error);
      }
    }, 500); // Wait 500ms after resize stops before saving
  };

  initializeWidgetHandlers(
    __dirname,
    VITE_DEV_SERVER_URL,
    RENDERER_DIST,
    onWidgetPositionChange,
    onWidgetSizeChange,
  );

  // Handle titlebar overlay updates (Windows/Linux only)
  ipcMain.handle(
    'update-titlebar-overlay',
    (_event, colors: { backgroundColor: string; symbolColor: string }) => {
      if (mainWindow && process.platform !== 'darwin') {
        mainWindow.setTitleBarOverlay({
          color: colors.backgroundColor,
          symbolColor: colors.symbolColor,
          height: 48,
        });
      }
      return { success: true };
    },
  );

  // Handle app icon path requests for native notifications
  ipcMain.handle('app:getIconPath', () => {
    // In development mode, return relative URL for Vite dev server
    if (VITE_DEV_SERVER_URL) {
      return '/logo.png';
    }

    // In production, return absolute file path for native notifications
    const iconPath =
      process.platform === 'win32'
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'logo.ico')
        : path.join(process.env.VITE_PUBLIC, 'logo.png');
    return iconPath;
  });

  // Create main window
  createWindow();

  // Initialize widget window if enabled in settings
  try {
    const db = new GrailDatabase();
    const settings = db.getAllSettings();
    if (settings.widgetEnabled) {
      showWidgetWindow(
        settings,
        __dirname,
        VITE_DEV_SERVER_URL,
        RENDERER_DIST,
        onWidgetPositionChange,
        onWidgetSizeChange,
      );
    }
  } catch (error) {
    console.error('Failed to initialize widget window:', error);
  }
});

// Clean up database connection when app is about to quit
app.on('before-quit', () => {
  closeGrailDatabase();
  closeSaveFileMonitor();
  closeWidgetWindow();
});

/**
 * Event object for IPC communication replies.
 */
export let eventToReply: IpcMainEvent | null;
/**
 * Sets the event object for IPC communication replies.
 * @param {IpcMainEvent} e - The IPC event to set for replies.
 */
export function setEventToReply(e: IpcMainEvent) {
  eventToReply = e;
}
