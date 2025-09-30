/// <reference types="vite-plugin-electron/electron-env" />

/**
 * Namespace declaration extending NodeJS types.
 */
declare namespace NodeJS {
  /**
   * Interface extending the ProcessEnv to include application-specific environment variables.
   */
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /**
     * Path to the public directory (/dist/ in production or /public/ in development).
     */
    VITE_PUBLIC: string
  }
}

/**
 * Interface extending the Window object to include IpcRenderer for renderer process communication.
 * This is exposed in the preload script for secure IPC communication.
 */
interface Window {
  /**
   * Electron IpcRenderer for sending messages to the main process.
   */
  ipcRenderer: import('electron').IpcRenderer
}
