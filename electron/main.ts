import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, type IpcMainEvent } from 'electron';
import { initializeDialogHandlers } from './ipc-handlers/dialogHandlers';
import { closeGrailDatabase, initializeGrailHandlers } from './ipc-handlers/grailHandlers';
import { closeSaveFileMonitor, initializeSaveFileHandlers } from './ipc-handlers/saveFileHandlers';

createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

export let mainWindow: BrowserWindow | null;

function createWindow() {
  // Set the icon path based on platform and environment
  let iconPath: string;

  if (VITE_DEV_SERVER_URL) {
    // Development mode - use PNG from public folder
    iconPath = path.join(process.env.VITE_PUBLIC, 'icon-256.png');
  } else {
    // Production mode - use platform-specific icons
    iconPath =
      process.platform === 'win32'
        ? path.join(process.env.APP_ROOT, 'build/icon-win.png')
        : path.join(process.env.APP_ROOT, 'build/icon.icns');
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
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

app.whenReady().then(() => {
  // Initialize grail database and IPC handlers
  initializeGrailHandlers();
  initializeSaveFileHandlers();
  initializeDialogHandlers();

  // Create main window
  createWindow();
});

// Clean up database connection when app is about to quit
app.on('before-quit', () => {
  closeGrailDatabase();
  closeSaveFileMonitor();
});

export let eventToReply: IpcMainEvent | null;
export function setEventToReply(e: IpcMainEvent) {
  eventToReply = e;
}
