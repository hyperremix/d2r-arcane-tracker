import type {
  Character,
  D2Item,
  D2SaveFile,
  GrailProgress,
  Item,
  MonitoringStatus,
  Settings,
  UpdateInfo,
  UpdateStatus,
} from './grail'

/**
 * Main interface defining the Electron API available to the renderer process.
 * This interface provides type-safe access to all Electron main process functionality
 * from the renderer process through the preload script.
 */
export interface ElectronAPI {
  /**
   * Platform information from Node.js process.
   * Returns 'darwin' for macOS, 'win32' for Windows, or 'linux' for Linux.
   */
  platform: 'darwin' | 'win32' | 'linux'

  /**
   * Grail-related API methods for managing Holy Grail data.
   */
  grail: {
    /**
     * Retrieves all characters from the database.
     * @returns {Promise<Character[]>} A promise that resolves with an array of Character objects.
     */
    getCharacters(): Promise<Character[]>

    /**
     * Retrieves all Holy Grail items from the database.
     * @returns {Promise<Item[]>} A promise that resolves with an array of Item objects.
     */
    getItems(): Promise<Item[]>
    /**
     * Retrieves all runewords from the database, regardless of grailRunewords setting.
     * @returns {Promise<Item[]>} A promise that resolves with an array of runeword items.
     */
    getAllRunewords(): Promise<Item[]>

    /**
     * Retrieves grail progress for a specific character or all characters.
     * @param {string} [characterId] - Optional character ID to filter progress by.
     * @returns {Promise<GrailProgress[]>} A promise that resolves with an array of GrailProgress objects.
     */
    getProgress(characterId?: string): Promise<GrailProgress[]>
    /**
     * Updates grail progress for an item.
     * @param {GrailProgress} progress - The progress data to update.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    updateProgress(progress: GrailProgress): Promise<{ success: boolean }>

    /**
     * Retrieves current application settings.
     * @returns {Promise<Partial<Settings>>} A promise that resolves with the current settings.
     */
    getSettings(): Promise<Partial<Settings>>
    /**
     * Updates application settings.
     * @param {Partial<Settings>} settings - The settings to update.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    updateSettings(settings: Partial<Settings>): Promise<{ success: boolean }>

    /**
     * Retrieves Holy Grail statistics for a specific character or overall progress.
     * @param {string} [characterId] - Optional character ID to get statistics for.
     * @returns {Promise<Object>} A promise that resolves with statistics object containing:
     * @returns {number} returns.totalItems - Total number of items in the Holy Grail.
     * @returns {number} returns.foundItems - Number of items found.
     * @returns {number} returns.uniqueItems - Total number of unique items.
     * @returns {number} returns.setItems - Total number of set items.
     * @returns {number} returns.runes - Total number of runes.
     * @returns {number} returns.foundUnique - Number of unique items found.
     * @returns {number} returns.foundSet - Number of set items found.
     * @returns {number} returns.foundRunes - Number of runes found.
     */
    getStatistics(characterId?: string): Promise<{
      totalItems: number
      foundItems: number
      uniqueItems: number
      setItems: number
      runes: number
      foundUnique: number
      foundSet: number
      foundRunes: number
    }>

    /**
     * Creates a backup of the database to the specified path.
     * @param {string} backupPath - The file path where the backup should be saved.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    backup(backupPath: string): Promise<{ success: boolean }>
    /**
     * Restores the database from a backup file.
     * @param {string} backupPath - The file path of the backup to restore from.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    restore(backupPath: string): Promise<{ success: boolean }>
    /**
     * Restores the database from a backup buffer.
     * @param {Uint8Array} backupBuffer - The backup data as a buffer.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    restoreFromBuffer(backupBuffer: Uint8Array): Promise<{ success: boolean }>
    /**
     * Truncates all user data from the database (keeps only seed data).
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    truncateUserData(): Promise<{ success: boolean }>
  }

  /**
   * Save file monitoring API methods for managing Diablo 2 save file monitoring.
   */
  saveFile: {
    /**
     * Starts monitoring the save file directory for changes.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    startMonitoring(): Promise<{ success: boolean }>
    /**
     * Stops monitoring the save file directory.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    stopMonitoring(): Promise<{ success: boolean }>
    /**
     * Retrieves all detected save files.
     * @returns {Promise<D2SaveFile[]>} A promise that resolves with an array of D2SaveFile objects.
     */
    getSaveFiles(): Promise<D2SaveFile[]>
    /**
     * Gets the current monitoring status and directory.
     * @returns {Promise<MonitoringStatus>} A promise that resolves with the monitoring status.
     */
    getMonitoringStatus(): Promise<MonitoringStatus>
    /**
     * Updates the save directory being monitored.
     * @param {string} saveDir - The new save directory path.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    updateSaveDirectory(saveDir: string): Promise<{ success: boolean }>
    /**
     * Restores the default save directory for the current platform.
     * @returns {Promise<{ success: boolean; defaultDirectory: string }>} A promise that resolves with success indicator and default directory path.
     */
    restoreDefaultDirectory(): Promise<{ success: boolean; defaultDirectory: string }>
    /**
     * Retrieves the count of each available rune from the most recent save file scan.
     * Returns a map of rune IDs to their total counts from current inventory/stash.
     * @returns {Promise<Record<string, number>>} A promise that resolves with a record mapping rune IDs to counts.
     */
    getAvailableRunes(): Promise<Record<string, number>>
    /**
     * Triggers a manual refresh/rescan of all save files.
     * Forces a re-parse of all save files to get the latest item data.
     * @returns {Promise<{ success: boolean }>} A promise that resolves when the refresh is complete.
     */
    refreshSaveFiles(): Promise<{ success: boolean }>
  }

  /**
   * Icon API methods for managing item icons.
   */
  icon: {
    /**
     * Sets the D2R installation path.
     * @param {string} path - Path to D2R installation.
     * @returns {Promise<void>}
     */
    setD2RPath(path: string): Promise<void>

    /**
     * Gets the current D2R installation path.
     * @returns {Promise<string | null>} D2R path or null if not set.
     */
    getD2RPath(): Promise<string | null>

    /**
     * Converts all sprite files from D2R installation to PNGs.
     * @returns {Promise<{ success: boolean; totalFiles: number; convertedFiles: number; skippedFiles: number; errors: Array<{ file: string; error: string }> }>} Conversion result.
     */
    convertSprites(): Promise<{
      success: boolean
      totalFiles: number
      convertedFiles: number
      skippedFiles: number
      errors: Array<{ file: string; error: string }>
    }>

    /**
     * Gets the current conversion status.
     * @returns {Promise<{ status: 'not_started' | 'in_progress' | 'completed' | 'failed'; progress?: { current: number; total: number }; lastResult?: any }>} Conversion status.
     */
    getConversionStatus(): Promise<{
      status: 'not_started' | 'in_progress' | 'completed' | 'failed'
      progress?: { current: number; total: number }
      lastResult?: {
        success: boolean
        totalFiles: number
        convertedFiles: number
        skippedFiles: number
        errors: Array<{ file: string; error: string }>
      }
    }>

    /**
     * Gets an item icon by item name.
     * @param {string} itemName - The display name of the item.
     * @returns {Promise<string | null>} Base64 data URL of the icon or null if not found.
     */
    getByName(itemName: string): Promise<string | null>

    /**
     * Gets an item icon by filename.
     * @param {string} filename - The icon filename (e.g., "item.png").
     * @returns {Promise<string | null>} Base64 data URL of the icon or null if not found.
     */
    getByFilename(filename: string): Promise<string | null>

    /**
     * Clears the icon cache.
     * @returns {Promise<{ success: boolean }>} Success indicator.
     */
    clearCache(): Promise<{ success: boolean }>

    /**
     * Gets cache statistics.
     * @returns {Promise<{ size: number; iconDirectory: string; cacheFile: string; conversionStatus: any }>} Cache stats.
     */
    getCacheStats(): Promise<{
      size: number
      iconDirectory: string
      cacheFile: string
      conversionStatus: {
        status: 'not_started' | 'in_progress' | 'completed' | 'failed'
        progress?: { current: number; total: number }
      }
    }>
  }

  /**
   * Application update API methods for managing automatic updates.
   */
  update: {
    /**
     * Checks for available application updates.
     * @returns {Promise<UpdateStatus>} A promise that resolves with the current update status.
     */
    checkForUpdates(): Promise<UpdateStatus>

    /**
     * Downloads the available update.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    downloadUpdate(): Promise<{ success: boolean }>

    /**
     * Quits the application and installs the downloaded update.
     * @returns {Promise<void>} A promise that resolves when the quit is initiated.
     */
    quitAndInstall(): Promise<void>

    /**
     * Gets the current version and update status.
     * @returns {Promise<{ currentVersion: string; status: UpdateStatus }>} A promise that resolves with version and status.
     */
    getUpdateInfo(): Promise<{ currentVersion: string; status: UpdateStatus }>

    /**
     * Registers a callback to be notified of update status changes.
     * @param {(status: UpdateStatus) => void} callback - Function to call when update status changes.
     */
    onUpdateStatus(callback: (status: UpdateStatus) => void): () => void
  }

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
     * @returns {Promise<{ canceled: boolean; filePath?: string }>} A promise that resolves with dialog result.
     */
    showSaveDialog(options: {
      title?: string
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
      properties?: string[]
    }): Promise<{ canceled: boolean; filePath?: string }>
    /**
     * Shows a native open file dialog.
     * @param {Object} options - Dialog options.
     * @param {string} [options.title] - Dialog title.
     * @param {string} [options.defaultPath] - Default file path.
     * @param {Array<{ name: string; extensions: string[] }>} [options.filters] - File type filters.
     * @param {string[]} [options.properties] - Dialog properties.
     * @returns {Promise<{ canceled: boolean; filePaths?: string[] }>} A promise that resolves with dialog result.
     */
    showOpenDialog(options: {
      title?: string
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
      properties?: string[]
    }): Promise<{ canceled: boolean; filePaths?: string[] }>
  }

  /**
   * Widget window API methods for managing the overlay widget.
   */
  widget: {
    /**
     * Toggles the widget window on or off.
     * @param {boolean} enabled - Whether to enable or disable the widget.
     * @param {Partial<Settings>} settings - Current application settings for widget configuration.
     * @returns {Promise<{ success: boolean; error?: string }>} A promise that resolves with a success indicator.
     */
    toggle(enabled: boolean, settings: Partial<Settings>): Promise<{ success: boolean; error?: string }>

    /**
     * Gets the current widget window position.
     * @returns {Promise<{ success: boolean; position: { x: number; y: number } | null; error?: string }>} A promise that resolves with the widget position.
     */
    getPosition(): Promise<{ success: boolean; position: { x: number; y: number } | null; error?: string }>

    /**
     * Updates the widget window position.
     * @param {{ x: number; y: number }} position - The new position for the widget.
     * @returns {Promise<{ success: boolean; error?: string }>} A promise that resolves with a success indicator.
     */
    updatePosition(position: { x: number; y: number }): Promise<{ success: boolean; error?: string }>

    /**
     * Updates the widget display mode.
     * @param {'overall' | 'split' | 'all'} display - The new display mode for the widget.
     * @returns {Promise<{ success: boolean; error?: string }>} A promise that resolves with a success indicator.
     */
    updateDisplay(display: 'overall' | 'split' | 'all'): Promise<{ success: boolean; error?: string }>

    /**
     * Updates the widget window opacity.
     * @param {number} opacity - The new opacity value (0.0 to 1.0).
     * @returns {Promise<{ success: boolean; error?: string }>} A promise that resolves with a success indicator.
     */
    updateOpacity(opacity: number): Promise<{ success: boolean; error?: string }>

    /**
     * Checks if the widget window is currently open.
     * @returns {Promise<{ success: boolean; isOpen: boolean }>} A promise that resolves with the widget status.
     */
    isOpen(): Promise<{ success: boolean; isOpen: boolean }>

    /**
     * Resets the widget position to the center of the screen.
     * @returns {Promise<{ success: boolean; position: { x: number; y: number } | null; error?: string }>} A promise that resolves with the new position.
     */
    resetPosition(): Promise<{ success: boolean; position: { x: number; y: number } | null; error?: string }>
  }

  /**
   * Updates the title bar overlay colors (Windows/Linux only).
   * @param {Object} colors - The colors to apply.
   * @param {string} colors.backgroundColor - Background color of the title bar overlay.
   * @param {string} colors.symbolColor - Color of window control symbols.
   * @returns {Promise<{ success: boolean }>} Success indicator.
   */
  updateTitleBarOverlay(colors: {
    backgroundColor: string
    symbolColor: string
  }): Promise<{ success: boolean }>

  /**
   * Gets the absolute path to the app icon for use in native notifications.
   * @returns {Promise<string>} A promise that resolves with the absolute path to the app icon.
   */
  getIconPath(): Promise<string>

  /**
   * Shell API methods for opening external URLs and files.
   */
  shell: {
    /**
     * Opens an external URL in the system's default browser.
     * @param {string} url - The URL to open.
     * @returns {Promise<{ success: boolean; error?: string }>} A promise that resolves with a success indicator.
     */
    openExternal(url: string): Promise<{ success: boolean; error?: string }>
  }

  /**
   * Terror zone configuration API methods.
   */
  terrorZone: {
    /**
     * Retrieves all terror zones from the game file.
     * @returns {Promise<TerrorZone[]>} A promise that resolves with an array of terror zones.
     */
    getZones(): Promise<TerrorZone[]>

    /**
     * Retrieves current terror zone configuration from database.
     * @returns {Promise<Record<number, boolean>>} A promise that resolves with zone configuration.
     */
    getConfig(): Promise<Record<number, boolean>>

    /**
     * Updates terror zone configuration and applies to game file.
     * @param {Record<number, boolean>} config - Zone configuration (zone ID -> enabled state).
     * @returns {Promise<{ success: boolean; requiresRestart: boolean }>} A promise that resolves with update result.
     */
    updateConfig(config: Record<number, boolean>): Promise<{ success: boolean; requiresRestart: boolean }>

    /**
     * Restores the original desecratedzones.json file from backup.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with restore result.
     */
    restoreOriginal(): Promise<{ success: boolean }>

    /**
     * Validates the D2R installation path for terror zone configuration.
     * @returns {Promise<{ valid: boolean; path?: string; error?: string }>} A promise that resolves with validation result.
     */
    validatePath(): Promise<{ valid: boolean; path?: string; error?: string }>
  }
}

/**
 * Global declaration extending the Window interface to include the Electron API.
 * This makes the electronAPI available on the window object in the renderer process.
 */
declare global {
  interface Window {
    /**
     * The Electron API interface providing access to main process functionality.
     */
    electronAPI: ElectronAPI
  }
}
