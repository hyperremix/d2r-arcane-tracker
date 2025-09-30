import type { Character, D2Item, D2SaveFile, GrailProgress, HolyGrailItem, MonitoringStatus, Settings } from './grail'

/**
 * Main interface defining the Electron API available to the renderer process.
 * This interface provides type-safe access to all Electron main process functionality
 * from the renderer process through the preload script.
 */
export interface ElectronAPI {
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
     * @returns {Promise<HolyGrailItem[]>} A promise that resolves with an array of HolyGrailItem objects.
     */
    getItems(): Promise<HolyGrailItem[]>

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
  }

  /**
   * Item detection API methods for managing automatic item detection from save files.
   */
  itemDetection: {
    /**
     * Enables automatic item detection from save files.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    enable(): Promise<{ success: boolean }>
    /**
     * Disables automatic item detection from save files.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    disable(): Promise<{ success: boolean }>
    /**
     * Sets the Holy Grail items to match against during detection.
     * @param {HolyGrailItem[]} items - Array of Holy Grail items to use for matching.
     * @returns {Promise<{ success: boolean }>} A promise that resolves with a success indicator.
     */
    setGrailItems(items: HolyGrailItem[]): Promise<{ success: boolean }>
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
