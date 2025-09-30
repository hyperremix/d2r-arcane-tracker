import { contextBridge, ipcRenderer } from 'electron';
import type {
  Character,
  D2SaveFile,
  FileReaderResponse,
  GrailProgress,
  Item,
  MonitoringStatus,
  Settings,
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
  },

  /**
   * Item detection API methods for managing automatic item detection.
   */
  itemDetection: {
    /**
     * Enables automatic item detection from save files.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    enable: (): Promise<{ success: boolean }> => ipcRenderer.invoke('itemDetection:enable'),
    /**
     * Disables automatic item detection from save files.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    disable: (): Promise<{ success: boolean }> => ipcRenderer.invoke('itemDetection:disable'),
    /**
     * Sets the Holy Grail items to match against during detection.
     * @param {Item[]} items - Array of Holy Grail items to use for matching.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    setGrailItems: (items: Item[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('itemDetection:setGrailItems', items),
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
  },

  /**
   * Icon API methods for managing item icons.
   */
  icon: {
    /**
     * Gets an item icon by item name.
     * @param {string} itemName - The display name of the item.
     * @returns {Promise<string | null>} Base64 data URL of the icon or null if not found.
     */
    getByName: (itemName: string): Promise<string | null> =>
      ipcRenderer.invoke('icon:getByName', itemName),

    /**
     * Gets an item icon by D2R item code.
     * @param {string} itemCode - The D2R internal item code.
     * @returns {Promise<string | null>} Base64 data URL of the icon or null if not found.
     */
    getByCode: (itemCode: string): Promise<string | null> =>
      ipcRenderer.invoke('icon:getByCode', itemCode),

    /**
     * Preloads popular item icons for faster display.
     * @returns {Promise<{ success: boolean }>} Success indicator.
     */
    preloadPopular: (): Promise<{ success: boolean }> => ipcRenderer.invoke('icon:preloadPopular'),

    /**
     * Checks if D2R installation is available.
     * @returns {Promise<boolean>} True if D2R is found.
     */
    isD2RAvailable: (): Promise<boolean> => ipcRenderer.invoke('icon:isD2RAvailable'),

    /**
     * Clears the icon cache.
     * @returns {Promise<{ success: boolean }>} Success indicator.
     */
    clearCache: (): Promise<{ success: boolean }> => ipcRenderer.invoke('icon:clearCache'),

    /**
     * Gets cache statistics.
     * @returns {Promise<{ size: number; d2rAvailable: boolean; cachePath: string }>} Cache stats.
     */
    getCacheStats: (): Promise<{ size: number; d2rAvailable: boolean; cachePath: string }> =>
      ipcRenderer.invoke('icon:getCacheStats'),
  },
});
