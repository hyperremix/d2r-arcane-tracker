import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, session } from 'electron';
import { type RunningApp, startApp } from './app/bootstrap';
import { deferQuitUntilShutdown } from './app/lifecycle';
import { resolveAppPaths } from './app/paths';

/**
 * The directory name of the current module.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Locations of the bundled app; the main process bundle lives in `dist-electron`.
 */
const paths = resolveAppPaths(__dirname, process.env.VITE_DEV_SERVER_URL);
const VITE_DEV_SERVER_URL = paths.viteDevServerUrl;

process.env.APP_ROOT = paths.appRoot;
process.env.VITE_PUBLIC = paths.publicDir;

// Enable Chrome DevTools Protocol (CDP) remote debugging in development only
if (VITE_DEV_SERVER_URL) {
  // Default to port 9222; change if needed
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

/**
 * The running application, once the app is ready.
 */
let runningApp: RunningApp | undefined;

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    runningApp?.createMainWindow();
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

  startApp(paths).then(
    (startedApp) => {
      runningApp = startedApp;
    },
    (error: unknown) => {
      // startApp has already stopped what it started; without a window the app has nothing to show
      console.error('[main] Failed to start the app:', error);
      app.quit();
    },
  );
});

// Stop the services, close the windows and the database before the app quits. Quitting waits for
// the asynchronous shutdown, so open runs are ended and pending writes are flushed.
deferQuitUntilShutdown(app, () => runningApp?.shutdown() ?? Promise.resolve());
