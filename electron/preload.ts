import { contextBridge, ipcRenderer } from 'electron';
import type {
  Character,
  D2SaveFile,
  FileReaderResponse,
  GrailProgress,
  Item,
  MonitoringStatus,
  Run,
  RunItem,
  Session,
  Settings,
  TerrorZone,
  UpdateStatus,
} from './types/grail';

/**
 * Exposes a secure IPC renderer API to the renderer process.
 * This provides controlled access to IPC communication methods.
 */
contextBridge.exposeInMainWorld('ipcRenderer', {
  /**
   * Registers a listener for IPC messages from the main process.
   * @param {...Parameters<typeof ipcRenderer.on>} args - Channel name and listener function.
   * @returns {Electron.IpcRenderer} The IpcRenderer instance for chaining.
   */
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
  },
  /**
   * Removes a listener for IPC messages from the main process.
   * @param {...Parameters<typeof ipcRenderer.off>} args - Channel name and listener function.
   * @returns {Electron.IpcRenderer} The IpcRenderer instance for chaining.
   */
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  /**
   * Sends an asynchronous message to the main process.
   * @param {...Parameters<typeof ipcRenderer.send>} args - Channel name and message arguments.
   */
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  /**
   * Invokes a handler in the main process and returns a promise with the result.
   * @param {...Parameters<typeof ipcRenderer.invoke>} args - Channel name and invocation arguments.
   * @returns {Promise<unknown>} A promise that resolves with the handler's return value.
   */
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },
});

/**
 * Exposes the main Electron API to the renderer process.
 * This provides type-safe access to all Holy Grail functionality from the renderer.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Platform information from Node.js process.
   */
  platform: process.platform,

  /**
   * Grail-related API methods for managing Holy Grail data.
   */
  grail: {
    /**
     * Retrieves all characters from the database.
     * @returns {Promise<Character[]>} A promise that resolves with an array of characters.
     */
    getCharacters: (): Promise<Character[]> => ipcRenderer.invoke('grail:getCharacters'),

    /**
     * Retrieves all Holy Grail items from the database.
     * @returns {Promise<Item[]>} A promise that resolves with an array of Holy Grail items.
     */
    getItems: (): Promise<Item[]> => ipcRenderer.invoke('grail:getItems'),
    /**
     * Retrieves all runewords from the database, regardless of grailRunewords setting.
     * @returns {Promise<Item[]>} A promise that resolves with an array of runeword items.
     */
    getAllRunewords: (): Promise<Item[]> => ipcRenderer.invoke('grail:getAllRunewords'),
    /**
     * Seeds the database with Holy Grail items.
     * @param {Item[]} items - The items to seed the database with.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    seedItems: (items: Item[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:seedItems', items),
    /**
     * Automatically seeds the database with default Holy Grail data if needed.
     * @returns {Promise<{ success: boolean; seeded: boolean }>} A promise that resolves with success and seeded status.
     */
    autoSeed: (): Promise<{ success: boolean; seeded: boolean }> =>
      ipcRenderer.invoke('grail:autoSeed'),
    /**
     * Checks if the database needs seeding.
     * @returns {Promise<{ needsSeeding: boolean }>} A promise that resolves with seeding requirement status.
     */
    needsSeeding: (): Promise<{ needsSeeding: boolean }> =>
      ipcRenderer.invoke('grail:needsSeeding'),

    /**
     * Retrieves grail progress for a specific character or all characters.
     * @param {string} [characterId] - Optional character ID to filter progress by.
     * @returns {Promise<GrailProgress[]>} A promise that resolves with an array of grail progress records.
     */
    getProgress: (characterId?: string): Promise<GrailProgress[]> =>
      ipcRenderer.invoke('grail:getProgress', characterId),
    /**
     * Updates grail progress for an item.
     * @param {GrailProgress} progress - The progress data to update.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    updateProgress: (progress: GrailProgress): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:updateProgress', progress),

    /**
     * Retrieves current application settings.
     * @returns {Promise<Partial<Settings>>} A promise that resolves with the current settings.
     */
    getSettings: (): Promise<Partial<Settings>> => ipcRenderer.invoke('grail:getSettings'),
    /**
     * Updates application settings.
     * @param {Partial<Settings>} settings - The settings to update.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    updateSettings: (settings: Partial<Settings>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:updateSettings', settings),

    /**
     * Retrieves Holy Grail statistics for a specific character or overall progress.
     * @param {string} [characterId] - Optional character ID to get statistics for.
     * @returns {Promise<Object>} A promise that resolves with statistics object.
     */
    getStatistics: (
      characterId?: string,
    ): Promise<{
      totalItems: number;
      foundItems: number;
      uniqueItems: number;
      setItems: number;
      runes: number;
      foundUnique: number;
      foundSet: number;
      foundRunes: number;
    }> => ipcRenderer.invoke('grail:getStatistics', characterId),

    /**
     * Creates a backup of the database to the specified path.
     * @param {string} backupPath - The file path where the backup should be saved.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    backup: (backupPath: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:backup', backupPath),
    /**
     * Restores the database from a backup file.
     * @param {string} backupPath - The file path of the backup to restore from.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    restore: (backupPath: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:restore', backupPath),
    /**
     * Restores the database from a backup buffer.
     * @param {Uint8Array} backupBuffer - The backup data as a buffer.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    restoreFromBuffer: (backupBuffer: Uint8Array): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:restoreFromBuffer', backupBuffer),
    /**
     * Truncates all user data from the database (keeps only seed data).
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    truncateUserData: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('grail:truncateUserData'),
  },

  /**
   * Save file monitoring API methods.
   */
  saveFile: {
    /**
     * Starts monitoring the save file directory for changes.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    startMonitoring: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('saveFile:startMonitoring'),
    /**
     * Stops monitoring the save file directory.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    stopMonitoring: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('saveFile:stopMonitoring'),
    /**
     * Retrieves all detected save files.
     * @returns {Promise<D2SaveFile[]>} A promise that resolves with an array of save files.
     */
    getSaveFiles: (): Promise<D2SaveFile[]> => ipcRenderer.invoke('saveFile:getSaveFiles'),
    /**
     * Gets the current monitoring status and directory.
     * @returns {Promise<MonitoringStatus>} A promise that resolves with the monitoring status.
     */
    getMonitoringStatus: (): Promise<MonitoringStatus> =>
      ipcRenderer.invoke('saveFile:getMonitoringStatus'),
    /**
     * Updates the save directory being monitored.
     * @param {string} saveDir - The new save directory path.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    updateSaveDirectory: (saveDir: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('saveFile:updateSaveDirectory', saveDir),
    /**
     * Restores the default save directory for the current platform.
     * @returns {Promise<{ success: boolean; defaultDirectory: string }>} A promise that resolves with success and default directory.
     */
    restoreDefaultDirectory: (): Promise<{ success: boolean; defaultDirectory: string }> =>
      ipcRenderer.invoke('saveFile:restoreDefaultDirectory'),
    /**
     * Retrieves the count of each available rune from the most recent save file scan.
     * @returns {Promise<Record<string, number>>} A promise that resolves with a record mapping rune IDs to counts.
     */
    getAvailableRunes: (): Promise<Record<string, number>> =>
      ipcRenderer.invoke('saveFile:getAvailableRunes'),
    /**
     * Triggers a manual refresh/rescan of all save files.
     * @returns {Promise<{ success: boolean }>} A promise that resolves when the refresh is complete.
     */
    refreshSaveFiles: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('saveFile:refreshSaveFiles'),
  },

  /**
   * Native dialog API methods for showing system file dialogs.
   */
  dialog: {
    /**
     * Shows a native save file dialog.
     * @param {Object} options - Dialog options.
     * @param {string} [options.title] - Dialog title.
     * @param {string} [options.defaultPath] - Default file path.
     * @param {Array<{ name: string; extensions: string[] }>} [options.filters] - File type filters.
     * @param {string[]} [options.properties] - Dialog properties.
     * @returns {Promise<{ canceled: boolean; filePath?: string }>} A promise that resolves with the dialog result.
     */
    showSaveDialog: (options: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      properties?: string[];
    }): Promise<{ canceled: boolean; filePath?: string }> =>
      ipcRenderer.invoke('dialog:showSaveDialog', options),
    /**
     * Shows a native open file dialog.
     * @param {Object} options - Dialog options.
     * @param {string} [options.title] - Dialog title.
     * @param {string} [options.defaultPath] - Default file path.
     * @param {Array<{ name: string; extensions: string[] }>} [options.filters] - File type filters.
     * @param {string[]} [options.properties] - Dialog properties.
     * @returns {Promise<{ canceled: boolean; filePaths?: string[] }>} A promise that resolves with the dialog result.
     */
    showOpenDialog: (options: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      properties?: string[];
    }): Promise<{ canceled: boolean; filePaths?: string[] }> =>
      ipcRenderer.invoke('dialog:showOpenDialog', options),

    /**
     * Writes content to a file at the specified path.
     * @param {string} filePath - The file path to write to.
     * @param {string} content - The content to write.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with success status.
     */
    writeFile: (filePath: string, content: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('dialog:writeFile', filePath, content),
  },

  /**
   * Data update API methods for receiving data updates from the main process.
   */
  data: {
    /**
     * Registers a callback for data update events from the main process.
     * @param {(data: FileReaderResponse) => void} callback - Function to call when data updates are received.
     * @returns {Electron.IpcRenderer} The IpcRenderer instance for chaining.
     */
    onUpdate: (callback: (data: FileReaderResponse) => void) =>
      ipcRenderer.on('data:onUpdate', (_event, value) => callback(value)),

    /**
     * Registers a callback for service error events from the main process.
     * @param callback - Function to call when service errors are received.
     * @returns Cleanup function to remove the listener.
     */
    onServiceError: (
      callback: (payload: {
        service: string;
        operation: string;
        severity: 'error' | 'warn';
        message: string;
        timestamp: number;
      }) => void,
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        value: {
          service: string;
          operation: string;
          severity: 'error' | 'warn';
          message: string;
          timestamp: number;
        },
      ) => callback(value);
      ipcRenderer.on('service-error', listener);
      return () => ipcRenderer.removeListener('service-error', listener);
    },
  },

  /**
   * Icon API methods for managing item icons.
   */
  icon: {
    /**
     * Sets the D2R installation path.
     * @param {string} path - Path to D2R installation.
     * @returns {Promise<void>}
     */
    setD2RPath: (path: string): Promise<void> => ipcRenderer.invoke('icon:setD2RPath', path),

    /**
     * Gets the current D2R installation path.
     * @returns {Promise<string | null>} D2R path or null if not set.
     */
    getD2RPath: (): Promise<string | null> => ipcRenderer.invoke('icon:getD2RPath'),

    /**
     * Converts all sprite files from D2R installation to PNGs.
     * @returns {Promise<ConversionResult>} Conversion result.
     */
    convertSprites: (): Promise<{
      success: boolean;
      totalFiles: number;
      convertedFiles: number;
      skippedFiles: number;
      errors: Array<{ file: string; error: string }>;
    }> => ipcRenderer.invoke('icon:convertSprites'),

    /**
     * Gets the current conversion status.
     * @returns {Promise<ConversionStatus>} Conversion status.
     */
    getConversionStatus: (): Promise<{
      status: 'not_started' | 'in_progress' | 'completed' | 'failed';
      progress?: { current: number; total: number };
      lastResult?: {
        success: boolean;
        totalFiles: number;
        convertedFiles: number;
        skippedFiles: number;
        errors: Array<{ file: string; error: string }>;
      };
    }> => ipcRenderer.invoke('icon:getConversionStatus'),

    /**
     * Gets an item icon by item name.
     * @param {string} itemName - The display name of the item.
     * @returns {Promise<string | null>} Base64 data URL of the icon or null if not found.
     */
    getByName: (itemName: string): Promise<string | null> =>
      ipcRenderer.invoke('icon:getByName', itemName),

    /**
     * Gets an item icon by filename.
     * @param {string} filename - The icon filename (e.g., "item.png").
     * @returns {Promise<string | null>} Base64 data URL of the icon or null if not found.
     */
    getByFilename: (filename: string): Promise<string | null> =>
      ipcRenderer.invoke('icon:getByFilename', filename),

    /**
     * Clears the icon cache.
     * @returns {Promise<{ success: boolean }>} Success indicator.
     */
    clearCache: (): Promise<{ success: boolean }> => ipcRenderer.invoke('icon:clearCache'),

    /**
     * Gets cache statistics.
     * @returns {Promise<CacheStats>} Cache stats.
     */
    getCacheStats: (): Promise<{
      size: number;
      iconDirectory: string;
      cacheFile: string;
      conversionStatus: {
        status: 'not_started' | 'in_progress' | 'completed' | 'failed';
        progress?: { current: number; total: number };
      };
    }> => ipcRenderer.invoke('icon:getCacheStats'),

    /**
     * Validates the D2R installation path for icon extraction.
     * @returns {Promise<{ valid: boolean; path?: string; error?: string }>} Validation result.
     */
    validatePath: (): Promise<{ valid: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('icon:validatePath'),
  },

  /**
   * Widget window API methods for managing the overlay widget.
   */
  widget: {
    /**
     * Toggles the widget window on or off.
     * @param {boolean} enabled - Whether to enable or disable the widget.
     * @param {Partial<Settings>} settings - Current application settings for widget configuration.
     * @returns {Promise<{ success: boolean; error?: string }>} Success indicator.
     */
    toggle: (
      enabled: boolean,
      settings: Partial<Settings>,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('widget:toggle', enabled, settings),

    /**
     * Gets the current widget window position.
     * @returns {Promise<{ success: boolean; position: { x: number; y: number } | null; error?: string }>} Widget position.
     */
    getPosition: (): Promise<{
      success: boolean;
      position: { x: number; y: number } | null;
      error?: string;
    }> => ipcRenderer.invoke('widget:get-position'),

    /**
     * Updates the widget window position.
     * @param {{ x: number; y: number }} position - The new position for the widget.
     * @returns {Promise<{ success: boolean; error?: string }>} Success indicator.
     */
    updatePosition: (position: {
      x: number;
      y: number;
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('widget:update-position', position),

    /**
     * Updates the widget display mode.
     * @param {'overall' | 'split' | 'all' | 'run-only'} display - The new display mode for the widget.
     * @param {Partial<Settings>} settings - Application settings containing custom sizes.
     * @returns {Promise<{ success: boolean; error?: string }>} Success indicator.
     */
    updateDisplay: (
      display: 'overall' | 'split' | 'all' | 'run-only',
      settings: Partial<Settings>,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('widget:update-display', display, settings),

    /**
     * Updates the widget window opacity.
     * @param {number} opacity - The new opacity value (0.0 to 1.0).
     * @returns {Promise<{ success: boolean; error?: string }>} Success indicator.
     */
    updateOpacity: (opacity: number): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('widget:update-opacity', opacity),

    /**
     * Updates the widget window size.
     * @param {'overall' | 'split' | 'all' | 'run-only'} display - The display mode for the size.
     * @param {{ width: number; height: number }} size - The new size for the widget.
     * @returns {Promise<{ success: boolean; error?: string }>} Success indicator.
     */
    updateSize: (
      display: 'overall' | 'split' | 'all' | 'run-only',
      size: { width: number; height: number },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('widget:update-size', display, size),

    /**
     * Resets the widget size to default for the current display mode.
     * @param {'overall' | 'split' | 'all' | 'run-only'} display - The display mode to reset size for.
     * @returns {Promise<{ success: boolean; size: { width: number; height: number } | null; error?: string }>} Default size.
     */
    resetSize: (
      display: 'overall' | 'split' | 'all' | 'run-only',
    ): Promise<{
      success: boolean;
      size: { width: number; height: number } | null;
      error?: string;
    }> => ipcRenderer.invoke('widget:reset-size', display),

    /**
     * Checks if the widget window is currently open.
     * @returns {Promise<{ success: boolean; isOpen: boolean }>} Widget status.
     */
    isOpen: (): Promise<{ success: boolean; isOpen: boolean }> =>
      ipcRenderer.invoke('widget:is-open'),

    /**
     * Resets the widget position to the center of the screen.
     * @returns {Promise<{ success: boolean; position: { x: number; y: number } | null; error?: string }>} New position.
     */
    resetPosition: (): Promise<{
      success: boolean;
      position: { x: number; y: number } | null;
      error?: string;
    }> => ipcRenderer.invoke('widget:reset-position'),
  },

  /**
   * Updates the title bar overlay colors (Windows/Linux only).
   * @param {Object} colors - The colors to apply.
   * @returns {Promise<{ success: boolean }>} Success indicator.
   */
  updateTitleBarOverlay: (colors: {
    backgroundColor: string;
    symbolColor: string;
  }): Promise<{ success: boolean }> => ipcRenderer.invoke('update-titlebar-overlay', colors),

  /**
   * Gets the absolute path to the app icon for use in native notifications.
   * @returns {Promise<string>} The absolute path to the app icon.
   */
  getIconPath: (): Promise<string> => ipcRenderer.invoke('app:getIconPath'),

  /**
   * Application update API methods.
   */
  update: {
    /**
     * Checks for available application updates.
     * @returns {Promise<UpdateStatus>} Update status.
     */
    checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('update:checkForUpdates'),

    /**
     * Downloads the available update.
     * @returns {Promise<{ success: boolean }>} Success indicator.
     */
    downloadUpdate: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('update:downloadUpdate'),

    /**
     * Quits the application and installs the downloaded update.
     * @returns {Promise<void>} Resolves when quit is initiated.
     */
    quitAndInstall: (): Promise<void> => ipcRenderer.invoke('update:quitAndInstall'),

    /**
     * Gets the current version and update status.
     * @returns {Promise<{ currentVersion: string; status: UpdateStatus }>} Version and status.
     */
    getUpdateInfo: (): Promise<{ currentVersion: string; status: UpdateStatus }> =>
      ipcRenderer.invoke('update:getUpdateInfo'),

    /**
     * Registers a callback to be notified of update status changes.
     * @param {(status: UpdateStatus) => void} callback - Function to call when status changes.
     * @returns {() => void} Cleanup function to remove the listener.
     */
    onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: UpdateStatus) => callback(value);
      ipcRenderer.on('update:status', listener);
      return () => ipcRenderer.removeListener('update:status', listener);
    },
  },

  /**
   * Shell API methods for opening external URLs and files.
   */
  shell: {
    /**
     * Opens an external URL in the system's default browser.
     * @param {string} url - The URL to open.
     * @returns {Promise<{ success: boolean; error?: string }>} Success indicator.
     */
    openExternal: (url: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('shell:openExternal', url),
  },

  /**
   * Run tracker API methods for managing run tracking sessions and runs.
   */
  runTracker: {
    /**
     * Session Management
     */
    /**
     * Starts a new run tracking session.
     * @param {string} [characterId] - Optional character ID to associate with the session.
     * @returns {Promise<Session>} A promise that resolves with the created session.
     */
    startSession: (characterId?: string): Promise<Session> =>
      ipcRenderer.invoke('run-tracker:start-session', characterId),

    /**
     * Ends the current run tracking session.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    endSession: (): Promise<{ success: boolean }> => ipcRenderer.invoke('run-tracker:end-session'),

    /**
     * Archives a session by ID.
     * @param {string} sessionId - The ID of the session to archive.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    archiveSession: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('run-tracker:archive-session', sessionId),

    /**
     * Run Management
     */
    /**
     * Starts a new run within the current session.
     * @param {string} [characterId] - Optional character ID for the run.
     * @returns {Promise<Run>} A promise that resolves with the created run.
     */
    startRun: (characterId?: string): Promise<Run> =>
      ipcRenderer.invoke('run-tracker:start-run', characterId),

    /**
     * Ends the current run.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    endRun: (): Promise<{ success: boolean }> => ipcRenderer.invoke('run-tracker:end-run'),

    /**
     * Pauses the current run.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    pauseRun: (): Promise<{ success: boolean }> => ipcRenderer.invoke('run-tracker:pause'),

    /**
     * Resumes the current run.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    resumeRun: (): Promise<{ success: boolean }> => ipcRenderer.invoke('run-tracker:resume'),

    /**
     * State Queries
     */
    /**
     * Gets the current state of the run tracker.
     * @returns {Promise<{ isRunning: boolean; isPaused: boolean; activeSession: Session | null; activeRun: Run | null }>} A promise that resolves with the current state.
     */
    getState: (): Promise<{
      isRunning: boolean;
      isPaused: boolean;
      activeSession: Session | null;
      activeRun: Run | null;
    }> => ipcRenderer.invoke('run-tracker:get-state'),

    /**
     * Gets the currently active session.
     * @returns {Promise<Session | null>} A promise that resolves with the active session or null.
     */
    getActiveSession: (): Promise<Session | null> =>
      ipcRenderer.invoke('run-tracker:get-active-session'),

    /**
     * Gets the currently active run.
     * @returns {Promise<Run | null>} A promise that resolves with the active run or null.
     */
    getActiveRun: (): Promise<Run | null> => ipcRenderer.invoke('run-tracker:get-active-run'),

    /**
     * Statistics Queries
     */
    /**
     * Gets all sessions regardless of character.
     * @param {boolean} includeArchived - Whether to include archived sessions (default: false).
     * @returns {Promise<Session[]>} A promise that resolves with an array of sessions.
     */
    getAllSessions: (includeArchived?: boolean): Promise<Session[]> =>
      ipcRenderer.invoke('run-tracker:get-all-sessions', includeArchived),

    /**
     * Gets a specific session by ID.
     * @param {string} sessionId - The session ID to retrieve.
     * @returns {Promise<Session | null>} A promise that resolves with the session or null.
     */
    getSessionById: (sessionId: string): Promise<Session | null> =>
      ipcRenderer.invoke('run-tracker:get-session-by-id', sessionId),

    /**
     * Gets all runs for a specific session.
     * @param {string} sessionId - The session ID to get runs for.
     * @returns {Promise<Run[]>} A promise that resolves with an array of runs.
     */
    getRunsBySession: (sessionId: string): Promise<Run[]> =>
      ipcRenderer.invoke('run-tracker:get-runs-by-session', sessionId),

    /**
     * Gets all items found during a specific run.
     * @param {string} runId - The run ID to get items for.
     * @returns {Promise<RunItem[]>} A promise that resolves with an array of run items.
     */
    getRunItems: (runId: string): Promise<RunItem[]> =>
      ipcRenderer.invoke('run-tracker:get-run-items', runId),

    /**
     * Gets all items found during a specific session (across all runs).
     * @param {string} sessionId - The session ID to get items for.
     * @returns {Promise<RunItem[]>} A promise that resolves with an array of run items.
     */
    getSessionItems: (sessionId: string): Promise<RunItem[]> =>
      ipcRenderer.invoke('run-tracker:get-session-items', sessionId),

    /**
     * Gets overall run statistics across all sessions.
     * @returns {Promise<RunStatistics>} A promise that resolves with overall run statistics.
     */
    getOverallStatistics: () => ipcRenderer.invoke('run-tracker:get-overall-statistics'),

    /**
     * Gets the memory reading status (whether offsets are valid).
     * @returns {Promise<{ available: boolean; reason: string | null }>} A promise that resolves with memory status.
     */
    getMemoryStatus: (): Promise<{ available: boolean; reason: string | null }> =>
      ipcRenderer.invoke('run-tracker:get-memory-status'),

    /**
     * Manually adds a run item to a run.
     * @param {Object} data - The run item data.
     * @param {string} data.runId - The run ID to add the item to.
     * @param {string} [data.name] - Optional name for manual entries.
     * @param {string} [data.grailProgressId] - Optional grail progress ID.
     * @param {Date} [data.foundTime] - Optional found time (defaults to now).
     * @returns {Promise<{ success: boolean; runItem: RunItem }>} A promise that resolves with the result.
     */
    addRunItem: (data: {
      runId: string;
      name?: string;
      grailProgressId?: string;
      foundTime?: Date;
    }) => ipcRenderer.invoke('run-tracker:add-run-item', data),
  },

  /**
   * Terror zone configuration API methods.
   */
  terrorZone: {
    /**
     * Retrieves all terror zones from the game file.
     * @returns {Promise<TerrorZone[]>} A promise that resolves with an array of terror zones.
     */
    getZones: (): Promise<TerrorZone[]> => ipcRenderer.invoke('terrorZone:getZones'),

    /**
     * Retrieves current terror zone configuration from database.
     * @returns {Promise<Record<number, boolean>>} A promise that resolves with zone configuration.
     */
    getConfig: (): Promise<Record<number, boolean>> => ipcRenderer.invoke('terrorZone:getConfig'),

    /**
     * Updates terror zone configuration and applies to game file.
     * @param {Record<number, boolean>} config - Zone configuration (zone ID -> enabled state).
     * @returns {Promise<{ success: boolean; requiresRestart: boolean }>} A promise that resolves with update result.
     */
    updateConfig: (
      config: Record<number, boolean>,
    ): Promise<{ success: boolean; requiresRestart: boolean }> =>
      ipcRenderer.invoke('terrorZone:updateConfig', config),

    /**
     * Restores the original desecratedzones.json file from backup.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with restore result.
     */
    restoreOriginal: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('terrorZone:restoreOriginal'),

    /**
     * Validates the D2R installation path for terror zone configuration.
     * @returns {Promise<{ valid: boolean; path?: string; error?: string }>} A promise that resolves with validation result.
     */
    validatePath: (): Promise<{ valid: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('terrorZone:validatePath'),
  },
});
