import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import chokidar, { type FSWatcher } from 'chokidar';
import { app } from 'electron';
import type { GrailDatabase } from '../database/database';
import { isRuneId, runewordsByNameSimple } from '../items/indexes';
import type {
  AvailableRunes,
  D2SaveFile,
  FileReaderResponse,
  ItemDetails,
  SaveFileEvent,
  SaveFileItem,
  SaveFileState,
} from '../types/grail';
import { GameMode } from '../types/grail';
import { getGrailItemId } from '../utils/grailItemUtils';
import { isRune, simplifyItemName } from '../utils/objects';
import type { EventBus } from './EventBus';

/**
 * Processes an item to determine its item ID from the flat items list.
 * @param {d2s.types.IItem} item - The D2S item to process.
 * @returns {string} The item ID or simplified name as fallback.
 */
const processItemName = (item: d2s.types.IItem): string => {
  // Try to get the item ID from our centralized logic
  const itemId = getGrailItemId(item);
  if (itemId) {
    return itemId;
  }

  // Fallback to simplified name for items not in our list
  // Note: rare items (rare_name/rare_name2) are excluded - they have randomly
  // generated names that can match real grail items (e.g., "Doom Collar")
  let name = item.unique_name || item.set_name || '';
  name = name.toLowerCase().replace(/[^a-z0-9]/gi, '');

  if (isRune(item)) {
    // For runes, use the simplified name as fallback
    return name;
  }

  if (item.type === 'runeword') {
    return simplifyItemName(item.runeword_name || '');
  }

  return name;
};

/**
 * Determines if an item should be skipped during processing.
 * @param {string} name - The item name/ID.
 * @param {d2s.types.IItem} item - The D2S item.
 * @returns {boolean} True if the item should be skipped, false otherwise.
 */
const shouldSkipItem = (name: string): boolean => {
  if (name === '') {
    return true;
  }
  return false;
};

/**
 * Creates a saved item details object from a D2S item.
 * @param {d2s.types.IItem} item - The D2S item to create details from.
 * @returns {ItemDetails} The created item details object.
 */
const createSavedItem = (item: d2s.types.IItem): ItemDetails => {
  return {
    ethereal: !!item.ethereal,
    ilevel: item.level,
    socketed: !!item.socketed,
    d2sItem: item,
  };
};

/**
 * Adds an item to the results object.
 * @param {FileReaderResponse} results - The results object to add the item to.
 * @param {string} name - The item name/ID.
 * @param {ItemDetails} savedItem - The item details.
 * @param {string} saveName - The save file name.
 * @param {d2s.types.IItem} item - The D2S item.
 * @param {boolean} isEthereal - Whether the item is ethereal.
 */
const addItemToResults = (
  results: FileReaderResponse,
  name: string,
  savedItem: ItemDetails,
  saveName: string,
  item: d2s.types.IItem,
  isEthereal: boolean,
): void => {
  const key: 'items' | 'ethItems' = isEthereal ? 'ethItems' : 'items';

  if (results[key][name]) {
    if (!results[key][name].inSaves[saveName]) {
      results[key][name].inSaves[saveName] = [];
    }
    results[key][name].inSaves[saveName].push(savedItem);
  } else {
    results[key][name] = {
      name,
      inSaves: {},
      type: item.type,
    };
    results[key][name].inSaves[saveName] = [savedItem];
  }
};

/**
 * Adds a rune to the available runes in the results object.
 * @param {FileReaderResponse} results - The results object to add the rune to.
 * @param {string} name - The rune name.
 * @param {ItemDetails} savedItem - The rune details.
 * @param {string} saveName - The save file name.
 * @param {d2s.types.IItem} item - The D2S item.
 */
const addRuneToAvailableRunes = (
  results: FileReaderResponse,
  name: string,
  savedItem: ItemDetails,
  saveName: string,
  item: d2s.types.IItem,
): void => {
  if (results.availableRunes[name]) {
    if (!results.availableRunes[name].inSaves[saveName]) {
      results.availableRunes[name].inSaves[saveName] = [];
    }
    results.availableRunes[name].inSaves[saveName].push(savedItem);
  } else {
    results.availableRunes[name] = {
      name,
      inSaves: {},
      type: item.type,
    };
    results.availableRunes[name].inSaves[saveName] = [savedItem];
  }
};

/**
 * Determines if an item should be included in parsing based on its properties.
 * @param {d2s.types.IItem} item - The D2S item to check.
 * @returns {boolean} True if the item should be included, false otherwise.
 */
const shouldIncludeItem = (item: d2s.types.IItem): boolean => {
  // Only include unique and set items - rare items have randomly generated names
  // that can match real grail items (e.g., "Doom Collar" matching "Doom" runeword)
  return !!((item.unique_name || item.set_name) && getGrailItemId(item));
};

/**
 * Processes unique or set items and adds them to the items array.
 * @param {d2s.types.IItem} item - The D2S item to process.
 * @param {d2s.types.IItem[]} items - The array to add the item to.
 */
const processUniqueOrSetItem = (item: d2s.types.IItem, items: d2s.types.IItem[]): void => {
  items.push(item);
};

/**
 * Processes rune items and adds them to the items array.
 * @param {d2s.types.IItem} item - The D2S item to process.
 * @param {d2s.types.IItem[]} items - The array to add the item to.
 * @param {boolean} isEmbed - Whether the rune is embedded in another item.
 */
const processRuneItem = (
  item: d2s.types.IItem,
  items: d2s.types.IItem[],
  isEmbed: boolean,
): void => {
  if (isRune(item)) {
    if (isEmbed) {
      item.socketed = 1; // the "socketed" in Rune item types will indicated that *it* sits inside socket
    }
    items.push(item);
  }
};

/**
 * Processes runeword items and adds them to the items array.
 * Validates runeword names against known runewords to prevent false positives
 * from D2S parser bugs or corrupted item data.
 * @param {d2s.types.IItem} item - The D2S item to process.
 * @param {d2s.types.IItem[]} items - The array to add the item to.
 */
const processRunewordItem = (item: d2s.types.IItem, items: d2s.types.IItem[]): void => {
  if (!item.runeword_name) {
    return;
  }

  // Skip if item has unique or set name - runewords cannot be unique/set items
  // This catches false positives from corrupted save files or modded games
  if (item.unique_name || item.set_name) {
    console.warn(
      `[processRunewordItem] Skipping "${item.runeword_name}" - has conflicting unique/set: ${item.unique_name || item.set_name}`,
    );
    return;
  }

  // Fix known parser bug: "Love" should be "Lore"
  if (item.runeword_name === 'Love') {
    item.runeword_name = 'Lore';
  }

  // Validate runeword name against known runewords to prevent false positives
  // from D2S parser bugs or corrupted item data
  const simplifiedName = simplifyItemName(item.runeword_name);
  if (!runewordsByNameSimple[simplifiedName]) {
    console.warn(`[processRunewordItem] Ignoring unknown runeword name: ${item.runeword_name}`);
    return;
  }

  // we push Runewords as "items" for easier displaying in a list
  const newItem = {
    runeword_name: item.runeword_name,
    type: 'runeword',
  } as d2s.types.IItem;
  items.push(newItem);
};

/**
 * Service for monitoring Diablo 2 save files and extracting item data.
 * This service watches save file directories, parses D2 save files, and maintains
 * a database of found items for Holy Grail tracking.
 */
class SaveFileMonitor {
  private currentData: FileReaderResponse;
  private fileWatcher: FSWatcher | null;
  private watchPath: string | null;
  private fileChangeCounter: number = 0;
  private lastProcessedChangeCounter: number = 0;
  private readingFiles: boolean;
  private isMonitoring = false;
  private grailDatabase: GrailDatabase | null = null;
  private saveDirectory: string | null = null;
  private forceParseAll: boolean = false;
  private isInitialParsing: boolean = false;
  private tickReaderInterval: NodeJS.Timeout | null = null;
  private tickReaderCount: number = 0;
  private eventBus: EventBus;
  private lastFileChangeTime: number = 0;
  // Default values for configurable intervals
  private readonly DEFAULT_TICK_INTERVAL = 500;
  private readonly DEFAULT_POLLING_INTERVAL = 1000;
  private readonly DEFAULT_STABILITY_THRESHOLD = 300;
  private readonly DEFAULT_DEBOUNCE_DELAY = 500;
  private readonly MAX_CONCURRENT_PARSES = 5; // Limit concurrent file parsing

  /**
   * Creates a new instance of the SaveFileMonitor.
   * @param {EventBus} eventBus - EventBus instance for emitting events
   * @param {GrailDatabase} [grailDatabase] - Optional grail database instance for settings and data storage.
   */
  constructor(eventBus: EventBus, grailDatabase?: GrailDatabase) {
    console.log('[SaveFileMonitor] Constructor called');
    this.eventBus = eventBus;
    this.grailDatabase = grailDatabase || null;
    this.currentData = {
      items: {},
      ethItems: {},
      stats: {},
      availableRunes: {},
    };
    this.fileWatcher = null;
    this.watchPath = null;
    this.fileChangeCounter = 0;
    this.lastProcessedChangeCounter = 0;
    this.readingFiles = false;

    // Initialize D2S constants
    this.initializeD2SConstants();
    console.log('[SaveFileMonitor] D2S constants initialized');

    // Initialize save directories
    this.initializeSaveDirectories();

    // Start the tick reader for automatic file change detection
    const tickInterval = this.getTickReaderInterval();
    this.tickReaderInterval = setInterval(this.tickReader, tickInterval);
    console.log(`[SaveFileMonitor] Tick reader started (interval: ${tickInterval}ms)`);
  }

  /**
   * Initializes D2S library constants for different game versions.
   * @private
   */
  private initializeD2SConstants(): void {
    const constantVersions = [96, 97, 98, 99, 0, 1, 2];

    for (const version of constantVersions) {
      try {
        d2s.getConstantData(version);
      } catch (_e) {
        const constants = version === 99 ? constants99 : constants96;
        d2s.setConstantData(version, constants);
      }
    }
  }

  /**
   * Initializes save directories by reading settings from the database or using platform defaults.
   * @private
   * @returns {Promise<void>} A promise that resolves when initialization is complete.
   */
  private async initializeSaveDirectories(): Promise<void> {
    console.log('[initializeSaveDirectories] Starting initialization');
    // First, try to get saveDir from Settings via grail database
    let customSaveDir: string | null = null;
    if (this.grailDatabase) {
      try {
        const settings = this.grailDatabase.getAllSettings();
        console.log('[initializeSaveDirectories] Settings retrieved:', {
          saveDir: settings.saveDir,
          gameMode: settings.gameMode,
        });
        if (settings.saveDir && settings.saveDir.trim() !== '') {
          customSaveDir = settings.saveDir.trim();
          console.log('[initializeSaveDirectories] Custom save directory found:', customSaveDir);
        } else {
          console.log('[initializeSaveDirectories] No custom save directory in settings');
        }
      } catch (error) {
        console.warn('[initializeSaveDirectories] Failed to read saveDir from settings:', error);
      }
    } else {
      console.log('[initializeSaveDirectories] No grail database available');
    }

    // Use custom saveDir if available, otherwise fall back to platform default
    if (customSaveDir) {
      this.saveDirectory = customSaveDir;
      console.log('[initializeSaveDirectories] Using custom directory:', this.saveDirectory);
    } else {
      this.saveDirectory = this.getPlatformDefaultDirectory();
      console.log(
        '[initializeSaveDirectories] Using platform default directory:',
        this.saveDirectory,
      );
    }
  }

  /**
   * Gets the platform-specific default save directory for Diablo 2 Resurrected.
   * @private
   * @returns {string} The default save directory path for the current platform.
   */
  private getPlatformDefaultDirectory(): string {
    return join(app.getPath('home'), 'Saved Games', 'Diablo II Resurrected');
  }

  /**
   * Gets the platform-specific default save directory for Diablo 2 Resurrected.
   * @returns {string} The default save directory path for the current platform.
   */
  getDefaultDirectory(): string {
    return this.getPlatformDefaultDirectory();
  }

  /**
   * Validates an interval value to ensure it's within acceptable bounds.
   * @private
   * @param {number | undefined} value - The value to validate
   * @param {number} min - Minimum acceptable value
   * @param {number} max - Maximum acceptable value
   * @param {number} defaultValue - Default value to use if validation fails
   * @returns {number} The validated interval value
   */
  private validateInterval(
    value: number | undefined,
    min: number,
    max: number,
    defaultValue: number,
  ): number {
    if (value === undefined) return defaultValue;
    if (value < min || value > max) {
      console.warn(
        `[SaveFileMonitor] Invalid interval ${value} (valid range: ${min}-${max}ms), using default ${defaultValue}ms`,
      );
      return defaultValue;
    }
    return value;
  }

  /**
   * Gets the tick reader interval from settings or returns default.
   * @private
   * @returns {number} The tick reader interval in milliseconds
   */
  private getTickReaderInterval(): number {
    if (!this.grailDatabase) {
      return this.DEFAULT_TICK_INTERVAL;
    }

    const settings = this.grailDatabase.getAllSettings();
    return this.validateInterval(
      settings.tickReaderIntervalMs,
      100, // min 100ms
      5000, // max 5 seconds
      this.DEFAULT_TICK_INTERVAL,
    );
  }

  /**
   * Starts monitoring the save file directory for changes.
   * Sets up file watching and parses existing save files.
   * @returns {Promise<void>} A promise that resolves when monitoring is started.
   */
  async startMonitoring(): Promise<void> {
    console.log('[startMonitoring] Called');
    if (this.isMonitoring) {
      console.log('[startMonitoring] Already monitoring, exiting');
      return;
    }

    // Refresh save directory from settings
    console.log('[startMonitoring] Refreshing save directory from settings');
    await this.initializeSaveDirectories();

    if (!this.saveDirectory) {
      console.warn('[startMonitoring] No save directory configured');
      this.eventBus.emit('monitoring-error', {
        type: 'no-directory',
        message: 'No save directory configured',
        directory: null,
      });
      return;
    }

    console.log('[startMonitoring] Checking if directory exists:', this.saveDirectory);
    // Check if directory exists
    if (!existsSync(this.saveDirectory)) {
      console.warn('[startMonitoring] Save directory does not exist:', this.saveDirectory);
      this.eventBus.emit('monitoring-error', {
        type: 'directory-not-found',
        message: `Save directory does not exist: ${this.saveDirectory}`,
        directory: this.saveDirectory,
      });
      return;
    }

    console.log('[startMonitoring] Directory exists, starting initial parsing');
    // Start file parsing to get initial data and file count
    this.isInitialParsing = true;
    const parsedSuccessfully = await this.parseSaveDirectory(this.saveDirectory);
    this.isInitialParsing = false;

    if (!parsedSuccessfully) {
      console.warn('[startMonitoring] Initial parsing failed');
      return; // Error was already emitted
    }

    console.log('[startMonitoring] Initial parsing successful');
    this.watchPath = this.saveDirectory;

    // Use polling mode for better compatibility with D2R (which uses atomic file writes)
    // Polling checks files periodically instead of relying on file system events
    const usePolling = true;
    console.log('[startMonitoring] Using polling mode:', usePolling);

    // Get configurable intervals from settings
    const settings = this.grailDatabase?.getAllSettings();
    const pollingInterval = this.validateInterval(
      settings?.chokidarPollingIntervalMs,
      500, // min 500ms
      5000, // max 5 seconds
      this.DEFAULT_POLLING_INTERVAL,
    );
    const stabilityThreshold = this.validateInterval(
      settings?.fileStabilityThresholdMs,
      100, // min 100ms
      2000, // max 2 seconds
      this.DEFAULT_STABILITY_THRESHOLD,
    );

    console.log(
      `[startMonitoring] Using intervals: polling=${pollingInterval}ms, stability=${stabilityThreshold}ms`,
    );

    this.fileWatcher = chokidar
      .watch(this.saveDirectory, {
        // Only watch files with save file extensions
        ignored: (path, stats) =>
          !!stats?.isFile() &&
          !['.d2s', '.sss', '.d2x', '.d2i'].includes(extname(path).toLowerCase()),
        followSymlinks: false,
        ignoreInitial: true,
        depth: 0,
        usePolling: usePolling, // Polling is more reliable for games like D2R that use atomic writes
        interval: pollingInterval,
        awaitWriteFinish: {
          stabilityThreshold: stabilityThreshold,
          pollInterval: 100,
        },
      })
      .on('all', (event, path) => {
        console.log(`[Chokidar] Event: ${event} on ${path}`);
        this.fileChangeCounter++;
        this.lastFileChangeTime = Date.now();
        console.log(`[Chokidar] fileChangeCounter incremented to ${this.fileChangeCounter}`);
      })
      .on('error', (error) => console.error('[Chokidar] Save file watcher error:', error))
      .on('ready', () => {
        console.log('[Chokidar] File watcher ready');
        const watched = this.fileWatcher?.getWatched();
        if (watched) {
          console.log('[Chokidar] Watching paths:', Object.keys(watched));
          console.log(
            '[Chokidar] Total files being watched:',
            Object.values(watched).reduce((sum, files) => sum + files.length, 0),
          );
        }
      })
      .on('add', (path) => console.log('[Chokidar] File added:', path))
      .on('change', (path) => console.log('[Chokidar] File changed:', path))
      .on('unlink', (path) => console.log('[Chokidar] File removed:', path));

    this.isMonitoring = true;
    console.log('[startMonitoring] Monitoring flag set to true');

    // Count save files for status reporting
    const saveFiles = await this.getSaveFiles();

    this.eventBus.emit('monitoring-started', {
      directory: this.saveDirectory,
      saveFileCount: saveFiles.length,
    });

    console.log(
      `[startMonitoring] Save file monitoring started for directory: ${this.saveDirectory} - Found ${saveFiles.length} save files`,
    );
  }

  /**
   * Stops monitoring the save file directory.
   * Closes the file watcher and emits a monitoring-stopped event.
   * @returns {Promise<void>} A promise that resolves when monitoring is stopped.
   */
  async stopMonitoring(): Promise<void> {
    console.log('[stopMonitoring] Called');
    if (this.fileWatcher) {
      console.log('[stopMonitoring] Closing file watcher');
      await this.fileWatcher.close();
      this.fileWatcher = null;
      console.log('[stopMonitoring] File watcher closed');
    }
    this.watchPath = null;
    this.isMonitoring = false;
    console.log('[stopMonitoring] Monitoring stopped');
    this.eventBus.emit('monitoring-stopped', {});
  }

  /**
   * Finds existing save directories that can be monitored.
   * @private
   * @returns {Promise<string[]>} A promise that resolves with an array of existing save directory paths.
   */
  private async findExistingSaveDirectories(): Promise<string[]> {
    const existingDirs: string[] = [];

    if (this.saveDirectory) {
      const dir = this.saveDirectory;
      try {
        if (existsSync(dir)) {
          existingDirs.push(dir);
        }
      } catch (error) {
        console.error('[findExistingSaveDirectories] Error checking directory:', dir, error);
      }
    }

    return existingDirs;
  }

  /**
   * Parses all save files in the specified directories.
   * @private
   * @param {string[]} directories - Array of directory paths to parse.
   * @returns {Promise<boolean>} A promise that resolves to true if parsing was successful, false otherwise.
   */
  private async parseAllSaveDirectories(directories: string[]): Promise<boolean> {
    const allFiles: string[] = [];

    // Collect all save files from all directories
    for (const dir of directories) {
      try {
        const allFilesInDir = readdirSync(dir);
        const files = allFilesInDir.filter(
          (file) => ['.d2s', '.sss', '.d2x', '.d2i'].indexOf(extname(file).toLowerCase()) !== -1,
        );
        allFiles.push(...files.map((file) => join(dir, file)));
      } catch (error) {
        console.error('[parseAllSaveDirectories] Error reading save directory', dir, ':', error);
      }
    }

    console.log('[parseAllSaveDirectories] Found', allFiles.length, 'save files total');

    // Clean up save file states for files that no longer exist
    this.cleanupDeletedFileStates(allFiles);

    if (allFiles.length === 0) {
      console.warn(
        '[parseAllSaveDirectories] No D2R save files found in directories:',
        directories,
      );
      this.eventBus.emit('monitoring-error', {
        type: 'no-save-files',
        message: `No D2R save files found in monitored directories`,
        directory: directories[0] || null,
        saveFileCount: 0,
      });
      return false;
    }

    // Parse all files and update current data
    await this.parseFiles(allFiles, false);
    console.log('[parseAllSaveDirectories] Parsing complete');
    return true;
  }

  /**
   * Parses all save files in a single directory.
   * @private
   * @param {string} directory - The directory path to parse.
   * @returns {Promise<boolean>} A promise that resolves to true if parsing was successful, false otherwise.
   */
  private async parseSaveDirectory(directory: string): Promise<boolean> {
    try {
      const allFilesInDir = readdirSync(directory);

      const files = allFilesInDir.filter(
        (file) => ['.d2s', '.sss', '.d2x', '.d2i'].indexOf(extname(file).toLowerCase()) !== -1,
      );

      const allFiles = files.map((file) => join(directory, file));

      if (allFiles.length === 0) {
        console.warn('[parseSaveDirectory] No D2R save files found in directory:', directory);
        this.eventBus.emit('monitoring-error', {
          type: 'no-save-files',
          message: `No D2R save files found in monitored directory`,
          directory: directory,
          saveFileCount: 0,
        });
        return false;
      }

      // Parse all files and update current data
      console.log('[parseSaveDirectory] Parsing', allFiles.length, 'save files');
      await this.parseFiles(allFiles, false);
      console.log('[parseSaveDirectory] Parsing complete');
      return true;
    } catch (error) {
      console.error('[parseSaveDirectory] Error reading save directory:', directory, error);
      this.eventBus.emit('monitoring-error', {
        type: 'directory-read-error',
        message: `Error reading save directory: ${error}`,
        directory: directory,
        saveFileCount: 0,
      });
      return false;
    }
  }

  /**
   * Checks if a save file should be parsed based on modification time.
   * @private
   * @param {string} filePath - The path to the save file
   * @returns {Promise<boolean>} True if the file should be parsed, false otherwise
   */
  private async shouldParseSaveFile(filePath: string): Promise<boolean> {
    // If force parse flag is set, parse all files
    if (this.forceParseAll) {
      return true;
    }

    try {
      const stats = await import('node:fs/promises').then((fs) => fs.stat(filePath));
      const fileState = this.grailDatabase?.getSaveFileState(filePath);

      if (!fileState) {
        return true; // New file, should parse
      }

      // Use getTime() for more reliable comparison
      const fileTime = stats.mtime.getTime();
      const lastModTime = fileState.lastModified.getTime();
      const shouldParse = fileTime > lastModTime;

      return shouldParse;
    } catch (error) {
      console.error(`Error checking file modification time for ${filePath}:`, error);
      return true; // On error, parse the file to be safe
    }
  }

  /**
   * Filters files that need parsing based on modification time.
   * @private
   * @param {string[]} filePaths - Array of all file paths to check.
   * @returns {Promise<string[]>} Array of file paths that need parsing.
   */
  private async filterFilesToParse(filePaths: string[]): Promise<string[]> {
    const filesToParse: string[] = [];

    for (const filePath of filePaths) {
      const shouldParse = await this.shouldParseSaveFile(filePath);
      if (shouldParse) {
        filesToParse.push(filePath);
      }
    }

    console.log(
      '[filterFilesToParse] Will parse',
      filesToParse.length,
      'out of',
      filePaths.length,
      'files',
    );
    return filesToParse;
  }

  /**
   * Extracts the character/save name from a file path.
   * For .d2i files, returns friendly names like "Shared Stash Hardcore".
   * @private
   * @param {string} filePath - The file path to extract the name from.
   * @param {boolean} [isHardcore] - Optional hardcore status (for shared stash files). If not provided, falls back to filename detection.
   * @returns {string} The character/save name.
   */
  private getSaveNameFromPath(filePath: string, isHardcore?: boolean): string {
    const extension = extname(filePath).toLowerCase();
    let saveName = basename(filePath)
      .replace('.d2s', '')
      .replace('.sss', '')
      .replace('.d2x', '')
      .replace('.d2i', '');

    // Use friendly names for shared stash files
    if (extension === '.d2i') {
      // Use provided hardcore status if available, otherwise fall back to filename
      const hardcore =
        isHardcore !== undefined ? isHardcore : saveName.toLowerCase().includes('hardcore');
      saveName = hardcore ? 'Shared Stash Hardcore' : 'Shared Stash Softcore';
    }

    return saveName;
  }

  /**
   * Collects extracted items for a specific save file from the results.
   * @private
   * @param {FileReaderResponse} results - The parsing results containing all items.
   * @param {string} saveName - The save name to collect items for.
   * @returns {d2s.types.IItem[]} Array of extracted items for this save.
   */
  private collectExtractedItems(results: FileReaderResponse, saveName: string): d2s.types.IItem[] {
    const extractedItems: d2s.types.IItem[] = [];

    // Collect items from both regular and ethereal item collections
    const itemCollections = [results.items, results.ethItems];

    for (const collection of itemCollections) {
      Object.values(collection).forEach((itemData) => {
        if (itemData.inSaves[saveName]) {
          itemData.inSaves[saveName].forEach((itemDetails) => {
            if (itemDetails.d2sItem) {
              extractedItems.push(itemDetails.d2sItem);
            }
          });
        }
      });
    }

    return extractedItems;
  }

  /**
   * Processes a single save file and updates results.
   * @private
   * @param {string} filePath - Path to the save file.
   * @param {FileReaderResponse} results - Results object to update.
   * @returns {Promise<{saveName: string, success: boolean}>} Parse result with save name and success status.
   */
  private async processSingleFile(
    filePath: string,
    results: FileReaderResponse,
  ): Promise<{ saveName: string; success: boolean }> {
    const saveName = this.getSaveNameFromPath(filePath);

    try {
      const buffer = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();
      const parsedItems = await this.parseSave(saveName, buffer, extension);

      results.stats[saveName] = 0;

      for (const item of parsedItems) {
        const name = processItemName(item);

        if (shouldSkipItem(name)) {
          continue;
        }

        const savedItem = createSavedItem(item);
        const isEthereal = !!item.ethereal;
        addItemToResults(results, name, savedItem, saveName, item, isEthereal);

        if (isRune(item) && !item.socketed) {
          addRuneToAvailableRunes(results, name, savedItem, saveName, item);
        }

        results.stats[saveName] = (results.stats[saveName] || 0) + 1;
      }

      // Update save file state after successful parsing
      await this.updateSaveFileState(filePath);

      return { saveName, success: true };
    } catch (error) {
      console.error('[processSingleFile] ERROR parsing save file:', filePath, error);
      results.stats[saveName] = null;
      return { saveName, success: false };
    }
  }

  /**
   * Updates the database state for a parsed save file.
   * @private
   * @param {string} filePath - Path to the save file.
   */
  private async updateSaveFileState(filePath: string): Promise<void> {
    try {
      const stats = await import('node:fs/promises').then((fs) => fs.stat(filePath));

      // Check if state already exists and reuse its ID
      const existingState = this.grailDatabase?.getSaveFileState(filePath);
      const id =
        existingState?.id || `save-file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const saveFileState: SaveFileState = {
        id,
        filePath,
        lastModified: stats.mtime,
        lastParsed: new Date(),
        created: existingState?.created || new Date(),
        updated: new Date(),
      };

      this.grailDatabase?.upsertSaveFileState(saveFileState);
    } catch (error) {
      console.error(
        '[updateSaveFileState] Failed to update save file state for',
        filePath,
        ':',
        error,
      );
    }
  }

  /**
   * Emits save file events for all successfully parsed files.
   * @private
   * @param {string[]} filePaths - Array of file paths that were parsed.
   * @param {FileReaderResponse} results - The parsing results.
   */
  private async emitSaveFileEvents(
    filePaths: string[],
    results: FileReaderResponse,
  ): Promise<void> {
    console.log('[emitSaveFileEvents] Emitting events for', filePaths.length, 'files');
    for (const filePath of filePaths) {
      try {
        const saveFile = await this.parseSaveFile(filePath);
        if (!saveFile) {
          continue;
        }

        const saveName = this.getSaveNameFromPath(filePath);
        const extractedItems = this.collectExtractedItems(results, saveName);

        // Set silent flag to prevent notification spam during:
        // - Initial parsing: avoid notifications for existing items on app startup
        // - Force parse all: avoid notifications when user manually re-scans all files
        // Items are still saved to database, only notifications are suppressed
        const silent = this.isInitialParsing || this.forceParseAll;

        // Set isInitialScan flag ONLY during initial parsing (not force re-scan)
        // This marks items for exclusion from statistics like Recent Finds, Streaks, and Avg per Day
        const isInitialScan = this.isInitialParsing;

        // Note: Save file events are no longer used for run tracking
        // Auto mode uses memory reading instead (RunTrackerService listens to game-entered/game-exited events)

        // Emit event and wait for all handlers to complete processing
        // This prevents race conditions in item detection by ensuring sequential processing
        await this.eventBus.emitAsync('save-file-event', {
          type: 'modified',
          file: saveFile,
          extractedItems,
          silent,
          isInitialScan,
        } as SaveFileEvent);
      } catch (error) {
        console.error('[emitSaveFileEvents] Error creating save file event for:', filePath, error);
      }
    }
    console.log('[emitSaveFileEvents] All events emitted');
  }

  /**
   * Executes an array of async tasks with a concurrency limit.
   * This prevents resource exhaustion when many files need to be parsed.
   * @private
   * @template T - The return type of the tasks
   * @param {Array<() => Promise<T>>} tasks - Array of async task functions
   * @param {number} limit - Maximum number of concurrent tasks
   * @returns {Promise<T[]>} Promise that resolves with all task results in order
   */
  private async executeConcurrently<T>(
    tasks: Array<() => Promise<T>>,
    limit: number,
  ): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    const queue = tasks.map((task, index) => ({ task, index }));

    const worker = async (): Promise<void> => {
      let item = queue.shift();
      while (item !== undefined) {
        try {
          results[item.index] = await item.task();
        } catch (error) {
          console.error(`[executeConcurrently] Error executing task ${item.index}:`, error);
          results[item.index] = undefined as T;
        }
        item = queue.shift();
      }
    };

    const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
    await Promise.all(workers);

    return results;
  }

  /**
   * Parses multiple save files and updates the current data.
   * @private
   * @param {string[]} filePaths - Array of file paths to parse.
   * @param {boolean} userRequested - Whether the parsing was requested by the user.
   * @returns {Promise<void>} A promise that resolves when parsing is complete.
   */
  private async parseFiles(filePaths: string[], userRequested: boolean): Promise<void> {
    console.log(
      '[parseFiles] Starting to parse',
      filePaths.length,
      'files, userRequested:',
      userRequested,
    );
    const results: FileReaderResponse = {
      items: {},
      ethItems: {},
      stats: {},
      availableRunes: {},
    };

    if (!this.grailDatabase) {
      console.warn('[parseFiles] No grail database available for parsing');
      return;
    }

    // Filter files that need parsing based on modification time
    const filesToParse = await this.filterFilesToParse(filePaths);

    console.log(
      `[parseFiles] Parsing ${filesToParse.length} out of ${filePaths.length} save files (${filePaths.length - filesToParse.length} skipped due to no changes)`,
    );

    if (filesToParse.length === 0) {
      console.log('[parseFiles] No files to parse, exiting early');
      return;
    }

    // Parse files with concurrency limit to prevent resource exhaustion
    console.log(
      `[parseFiles] Starting concurrent parsing of ${filesToParse.length} files ` +
        `(max ${this.MAX_CONCURRENT_PARSES} at a time)`,
    );

    const tasks = filesToParse.map((filePath) => {
      return () => this.processSingleFile(filePath, results);
    });

    await this.executeConcurrently(tasks, this.MAX_CONCURRENT_PARSES);

    console.log('[parseFiles] Concurrent parsing complete');

    // Reset force parse flag after parsing completes
    if (this.forceParseAll) {
      console.log('[parseFiles] Resetting forceParseAll flag');
      this.forceParseAll = false;
    }

    // Update save directory if user requested
    if (userRequested && filePaths.length > 0) {
      const firstDir = dirname(filePaths[0]);
      console.log('[parseFiles] User requested parsing, updating saveDir to:', firstDir);
      this.grailDatabase.setSetting('saveDir', firstDir);
    }

    // Update current data
    this.currentData = results;

    // Emit save file events for each file that was actually parsed
    await this.emitSaveFileEvents(filesToParse, results);
    console.log('[parseFiles] Complete - processed', filesToParse.length, 'files');
  }

  /**
   * Parses a single save file and extracts items from it.
   * @private
   * @param {string} saveName - The name of the save file.
   * @param {Buffer} content - The binary content of the save file.
   * @param {string} extension - The file extension (.d2s, .sss, .d2x, .d2i).
   * @returns {Promise<d2s.types.IItem[]>} A promise that resolves with an array of extracted items.
   */
  private async parseSave(
    _saveName: string,
    content: Buffer,
    extension: string,
  ): Promise<d2s.types.IItem[]> {
    const items: d2s.types.IItem[] = [];

    const parseItems = (itemList: d2s.types.IItem[], isEmbed: boolean = false) => {
      itemList.forEach((item) => {
        if (shouldIncludeItem(item)) {
          processUniqueOrSetItem(item, items);
        }

        processRuneItem(item, items, isEmbed);
        processRunewordItem(item, items);

        if (item.socketed_items?.length) {
          parseItems(item.socketed_items, true);
        }
      });
    };

    const parseD2S = (response: d2s.types.ID2S) => {
      if (!this.grailDatabase) {
        return [];
      }

      const settings = this.grailDatabase.getAllSettings();
      const isHardcore = response.header.status.hardcore;

      if (settings.gameMode === GameMode.Softcore && isHardcore) {
        return [];
      }
      if (settings.gameMode === GameMode.Hardcore && !isHardcore) {
        return [];
      }
      const items = response.items || [];
      const mercItems = response.merc_items || [];
      const corpseItems = response.corpse_items || [];
      const itemList = [...items, ...mercItems, ...corpseItems];
      parseItems(itemList);
    };

    const parseStash = (response: d2s.types.IStash) => {
      if (!this.grailDatabase) {
        return [];
      }

      const settings = this.grailDatabase.getAllSettings();
      // Use hardcore flag from parsed stash header instead of filename
      const isHardcore = response.hardcore;

      if (settings.gameMode === GameMode.Softcore && isHardcore) {
        return [];
      }
      if (settings.gameMode === GameMode.Hardcore && !isHardcore) {
        return [];
      }

      response.pages.forEach((page) => {
        parseItems(page.items);
      });
    };

    switch (extension) {
      case '.sss':
      case '.d2x':
        await d2stash.read(content, constants96).then(parseStash);
        break;
      case '.d2i':
        await d2stash.read(content, constants99).then(parseStash);
        break;
      default:
        await d2s.read(content).then(parseD2S);
    }

    return items;
  }

  /**
   * Parses a save file to extract basic character information.
   * @private
   * @param {string} filePath - The path to the save file.
   * @returns {Promise<D2SaveFile | null>} A promise that resolves with the parsed save file data or null if parsing fails.
   */
  private async parseSaveFile(filePath: string): Promise<D2SaveFile | null> {
    try {
      const stats = await import('node:fs/promises').then((fs) => fs.stat(filePath));
      const buffer = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();

      // Handle shared stash files (.d2i)
      if (extension === '.d2i') {
        // Parse the stash file header to extract hardcore status
        let isHardcore = false;
        try {
          const stashData = await d2stash.read(buffer, constants99);
          isHardcore = stashData.hardcore;
          console.log('[parseSaveFile] Parsed .d2i file, hardcore:', isHardcore);
        } catch (parseError) {
          console.warn(
            '[parseSaveFile] Failed to parse .d2i file header, falling back to filename:',
            parseError,
          );
          // Fallback to filename if parsing fails
          isHardcore = basename(filePath).toLowerCase().includes('hardcore');
        }

        const characterName = this.getSaveNameFromPath(filePath, isHardcore);

        return {
          name: characterName,
          path: filePath,
          lastModified: stats.mtime,
          characterClass: 'shared_stash',
          level: 1,
          hardcore: isHardcore,
          expansion: true,
        };
      }

      // Basic D2 save file parsing (simplified)
      const fileName = basename(filePath, '.d2s');

      // Character name is typically the filename
      const characterName = fileName;
      let characterClass = 'unknown';
      let level = 1;
      let hardcore = false;
      let expansion = true;

      // Basic header parsing (D2 save files have a specific structure)
      if (buffer.length >= 765) {
        // Character class at offset 40
        const classId = buffer.readUInt8(40);
        characterClass = this.getCharacterClass(classId);

        // Level at offset 43
        level = buffer.readUInt8(43);

        // Status flags at offset 36
        const status = buffer.readUInt8(36);
        hardcore = (status & 0x04) !== 0;
        expansion = (status & 0x20) !== 0;
      }

      return {
        name: characterName,
        path: filePath,
        lastModified: stats.mtime,
        characterClass,
        level,
        hardcore,
        expansion,
      };
    } catch (error) {
      console.error('Error parsing save file:', error);
      return null;
    }
  }

  /**
   * Maps a character class ID to its name.
   * @private
   * @param {number} classId - The character class ID from the save file.
   * @returns {string} The character class name.
   */
  private getCharacterClass(classId: number): string {
    const classes = [
      'amazon',
      'sorceress',
      'necromancer',
      'paladin',
      'barbarian',
      'druid',
      'assassin',
    ];
    return classes[classId] || 'unknown';
  }

  /**
   * Retrieves all save files from the monitored directory.
   * @returns {Promise<D2SaveFile[]>} A promise that resolves with an array of save file objects.
   */
  async getSaveFiles(): Promise<D2SaveFile[]> {
    console.log('[getSaveFiles] Called');
    const saveFiles: D2SaveFile[] = [];

    if (!this.saveDirectory) {
      console.log('[getSaveFiles] No save directory configured');
      return saveFiles;
    }

    console.log('[getSaveFiles] Reading directory:', this.saveDirectory);
    try {
      const files = readdirSync(this.saveDirectory);
      console.log('[getSaveFiles] Total files in directory:', files.length);

      const d2sFiles = files.filter((file) => file.endsWith('.d2s'));
      console.log('[getSaveFiles] .d2s files found:', d2sFiles.length);

      for (const file of d2sFiles) {
        const filePath = join(this.saveDirectory, file);
        const saveFile = await this.parseSaveFile(filePath);
        if (saveFile) {
          saveFiles.push(saveFile);
        } else {
          console.log('[getSaveFiles] Failed to parse save file:', file);
        }
      }
    } catch (error) {
      console.error('[getSaveFiles] Error reading save directory', this.saveDirectory, ':', error);
    }

    console.log('[getSaveFiles] Returning', saveFiles.length, 'save files');
    return saveFiles;
  }

  /**
   * Checks if the monitor is currently active.
   * @returns {boolean} True if monitoring is active, false otherwise.
   */
  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  /**
   * Gets the current save directory being monitored.
   * @returns {string | null} The save directory path, or null if not set.
   */
  getSaveDirectory(): string | null {
    return this.saveDirectory;
  }

  /**
   * Updates the save directory and restarts monitoring if it was active.
   * @returns {Promise<void>} A promise that resolves when the update is complete.
   */
  async updateSaveDirectory(): Promise<void> {
    console.log('[updateSaveDirectory] Called');
    // Update the save directory and restart monitoring if active
    // Stop any existing monitoring before changing directory
    if (this.isMonitoring) {
      console.log('[updateSaveDirectory] Stopping current monitoring');
      await this.stopMonitoring();
    }

    // Force parse all files in new directory
    console.log('[updateSaveDirectory] Setting forceParseAll flag');
    this.forceParseAll = true;
    this.lastFileChangeTime = 0; // Bypass debounce for force parse

    // Re-initialize directories with the new setting
    console.log('[updateSaveDirectory] Re-initializing save directories');
    await this.initializeSaveDirectories();

    // Always start monitoring after directory change - user explicitly wants to use this directory
    console.log('[updateSaveDirectory] Starting monitoring for new directory');
    await this.startMonitoring();

    console.log('[updateSaveDirectory] Complete');
  }

  /**
   * Gets the current parsed item data.
   * @returns {FileReaderResponse} The current item data from all parsed save files.
   */
  getItems(): FileReaderResponse {
    return this.currentData;
  }

  /**
   * Fills in available runes from the current item data.
   * This method populates the availableRunes section of the current data.
   */
  fillInAvailableRunes(): void {
    // filling in all the runes into the "available runes"
    this.currentData.availableRunes = Object.keys(this.currentData.items).reduce(
      (acc: AvailableRunes, itemKey: string) => {
        const item = this.currentData.items[itemKey];
        if (isRuneId(itemKey)) {
          acc[itemKey] = item;
        }
        return acc;
      },
      {} as AvailableRunes,
    );
  }

  /**
   * Creates a manual item entry for tracking purposes.
   * @param {number} count - The number of items to create.
   * @returns {SaveFileItem} A manual item object.
   */
  createManualItem(count: number): SaveFileItem {
    return {
      inSaves: {
        'Manual entry': new Array(count).fill({} as ItemDetails),
      },
      name: '',
      type: '',
    };
  }

  /**
   * Gets the count of each available rune from the most recent save file scan.
   * Returns a map of rune IDs to their total counts across all save files.
   * @returns {Record<string, number>} A record mapping rune IDs to their counts.
   */
  getAvailableRunesCount(): Record<string, number> {
    const runeCounts: Record<string, number> = {};

    for (const [runeId, saveFileItem] of Object.entries(this.currentData.availableRunes)) {
      let totalCount = 0;
      // Sum up rune counts across all save files
      for (const itemsArray of Object.values(saveFileItem.inSaves)) {
        totalCount += itemsArray.length;
      }
      runeCounts[runeId] = totalCount;
    }

    return runeCounts;
  }

  /**
   * Triggers a manual refresh/rescan of all save files.
   * This forces a re-parse of all save files to get the latest item data.
   * @returns {Promise<void>} A promise that resolves when the refresh is complete.
   */
  async refreshSaveFiles(): Promise<void> {
    console.log('[refreshSaveFiles] Manual refresh requested');

    if (!this.isMonitoring) {
      console.log('[refreshSaveFiles] Not monitoring, cannot refresh');
      throw new Error('Save file monitoring is not active');
    }

    // Set force parse flag and trigger immediate parsing
    this.forceParseAll = true;
    this.lastFileChangeTime = 0; // Bypass debounce

    // Increment file change counter to trigger tick reader
    this.fileChangeCounter++;

    console.log('[refreshSaveFiles] Triggered force parse, waiting for completion...');

    // Wait for the tick reader to process the changes
    // Poll until forceParseAll is reset (which happens after parsing completes)
    const maxWaitTime = 30000; // 30 seconds timeout
    const pollInterval = 100; // Check every 100ms
    let elapsed = 0;

    while (this.forceParseAll && elapsed < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;
    }

    if (this.forceParseAll) {
      console.log('[refreshSaveFiles] Timeout waiting for parse to complete');
      throw new Error('Timeout waiting for save file refresh to complete');
    }

    console.log('[refreshSaveFiles] Refresh completed');
  }

  /**
   * Periodic tick reader that checks for file changes and re-parses if needed.
   * @private
   * @returns {Promise<void>} A promise that resolves when the tick is complete.
   */
  private tickReader = async (): Promise<void> => {
    // Log periodic heartbeat every 20 ticks (10 seconds)
    if (!this.tickReaderCount) {
      this.tickReaderCount = 0;
    }
    this.tickReaderCount++;

    if (this.tickReaderCount % 20 === 0) {
      console.log(
        '[tickReader] Heartbeat - watching:',
        this.watchPath,
        'changeCounter:',
        this.fileChangeCounter,
        'lastProcessed:',
        this.lastProcessedChangeCounter,
        'isMonitoring:',
        this.isMonitoring,
      );
    }

    if (!this.grailDatabase) {
      console.log('[tickReader] Skipping: No grail database');
      return;
    }

    const settings = this.grailDatabase.getAllSettings();

    if (!this.watchPath) {
      console.log('[tickReader] Skipping: No watch path');
      return;
    }

    // Check if there are unprocessed file changes
    if (this.fileChangeCounter === this.lastProcessedChangeCounter) {
      // No new changes since last processing
      return;
    }

    // Check if enough time has passed since last file change (debouncing)
    // Skip debounce for initial parsing or force parse
    const timeSinceLastChange = Date.now() - this.lastFileChangeTime;
    const shouldDebounce = !this.isInitialParsing && !this.forceParseAll;
    const debounceDelay = this.validateInterval(
      settings.fileChangeDebounceMs,
      500, // min 500ms
      10000, // max 10 seconds
      this.DEFAULT_DEBOUNCE_DELAY,
    );

    if (shouldDebounce && timeSinceLastChange < debounceDelay) {
      // Still within debounce window - don't process yet
      if (this.tickReaderCount % 4 === 0) {
        // Log occasionally to show debouncing is working
        console.log(
          `[tickReader] Debouncing: ${timeSinceLastChange}ms since last change ` +
            `(waiting for ${debounceDelay}ms)`,
        );
      }
      return;
    }

    if (this.readingFiles) {
      console.log('[tickReader] Skipping: Already reading files');
      return;
    }

    if (settings.gameMode === GameMode.Manual) {
      console.log('[tickReader] Skipping: Manual mode active');
      return;
    }

    console.log(
      `[tickReader] Debounce period elapsed (${timeSinceLastChange}ms), processing file changes...`,
    );
    console.log(
      `[tickReader] Processing changes: counter=${this.fileChangeCounter}, lastProcessed=${this.lastProcessedChangeCounter}`,
    );
    this.readingFiles = true;

    // Capture current counter before processing (in case new changes arrive during processing)
    const counterAtStartOfProcessing = this.fileChangeCounter;

    const directories = await this.findExistingSaveDirectories();
    await this.parseAllSaveDirectories(directories);

    // Update last processed counter to what we started processing
    // If new changes arrived during processing, they'll be caught on next tick
    this.lastProcessedChangeCounter = counterAtStartOfProcessing;

    this.readingFiles = false;
    console.log(
      `[tickReader] Done processing file changes (processed up to counter ${counterAtStartOfProcessing})`,
    );

    // Check if new changes arrived during processing
    if (this.fileChangeCounter > counterAtStartOfProcessing) {
      console.log(
        `[tickReader] New changes detected during processing (counter now ${this.fileChangeCounter}), will process on next tick`,
      );
    }
  };

  /**
   * Cleans up save file states for files that no longer exist.
   * @private
   * @param {string[]} existingFilePaths - Array of file paths that currently exist
   */
  private cleanupDeletedFileStates(existingFilePaths: string[]): void {
    console.log('[cleanupDeletedFileStates] Checking for deleted files');
    if (!this.grailDatabase) {
      console.log('[cleanupDeletedFileStates] No database available');
      return;
    }

    const existingPaths = new Set(existingFilePaths);
    const allStates = this.grailDatabase.getAllSaveFileStates();
    console.log(
      '[cleanupDeletedFileStates] Existing files:',
      existingFilePaths.length,
      'Tracked states:',
      allStates.length,
    );

    let deletedCount = 0;
    for (const state of allStates) {
      if (!existingPaths.has(state.filePath)) {
        console.log(
          '[cleanupDeletedFileStates] Cleaning up state for deleted file:',
          state.filePath,
        );
        this.grailDatabase.deleteSaveFileState(state.filePath);
        deletedCount++;
      }
    }

    console.log('[cleanupDeletedFileStates] Cleaned up', deletedCount, 'deleted file states');
  }

  /**
   * Shuts down the save file monitor and stops all monitoring activities.
   * @returns {Promise<void>} A promise that resolves when shutdown is complete.
   */
  async shutdown(): Promise<void> {
    console.log('[shutdown] Shutting down save file monitor');
    if (this.tickReaderInterval) {
      console.log('[shutdown] Clearing tick reader interval');
      clearInterval(this.tickReaderInterval);
      this.tickReaderInterval = null;
    }
    await this.stopMonitoring();
    console.log('[shutdown] Shutdown complete');
  }
}

export { SaveFileMonitor };
export type { D2SaveFile, SaveFileEvent };
