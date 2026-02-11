import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import { app } from 'electron';
import type { GrailDatabase } from '../database/database';
import { isRuneId, runewordsByNameSimple } from '../items/indexes';
import type {
  AvailableRunes,
  CharacterInventorySnapshot,
  D2SaveFile,
  D2SItem,
  FileReaderResponse,
  InventorySearchResult,
  ItemDetails,
  ParsedInventoryItem,
  SaveFileEvent,
  SaveFileItem,
  SaveFileState,
  VaultLocationContext,
  VaultSourceFileType,
} from '../types/grail';
import { GameMode } from '../types/grail';
import { getGrailItemId } from '../utils/grailItemUtils';
import { isRune } from '../utils/objects';
import { createServiceLogger } from '../utils/serviceLogger';
import type { EventBus } from './EventBus';

const log = createServiceLogger('SaveFileMonitor');

const processItemName = (item: D2SItem): string => {
  const itemId = getGrailItemId(item);
  if (itemId) {
    return itemId;
  }

  let name = item.unique_name || item.set_name || '';
  name = name.toLowerCase().replace(/[^a-z0-9]/gi, '');

  if (isRune(item as d2s.types.IItem)) {
    return name;
  }

  if (item.type === 'runeword') {
    return (item.runeword_name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
  }

  return name;
};

const shouldSkipItem = (name: string): boolean => name === '';

const createSavedItem = (item: D2SItem): ItemDetails => ({
  ethereal: !!item.ethereal,
  ilevel: item.level ?? null,
  socketed: !!item.socketed,
  d2sItem: item as d2s.types.IItem,
});

const addItemToResults = (
  results: FileReaderResponse,
  name: string,
  savedItem: ItemDetails,
  saveName: string,
  item: D2SItem,
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
      type: item.type ?? 'unknown',
    };
    results[key][name].inSaves[saveName] = [savedItem];
  }
};

const addRuneToAvailableRunes = (
  results: FileReaderResponse,
  name: string,
  savedItem: ItemDetails,
  saveName: string,
  item: D2SItem,
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
      type: item.type ?? 'unknown',
    };
    results.availableRunes[name].inSaves[saveName] = [savedItem];
  }
};

const shouldIncludeItem = (item: D2SItem): boolean => {
  return !!((item.unique_name || item.set_name) && getGrailItemId(item as d2s.types.IItem));
};

const getValidatedRunewordName = (item: D2SItem): string | null => {
  if (!item.runeword_name) {
    return null;
  }

  const normalized = item.runeword_name === 'Love' ? 'Lore' : item.runeword_name;
  const simplified = normalized.toLowerCase().replace(/[^a-z0-9]/gi, '');

  if (!runewordsByNameSimple[simplified]) {
    return null;
  }

  return normalized;
};

/**
 * Service for monitoring Diablo 2 save files and extracting item data.
 * This service watches save file directories, parses D2 save files, and maintains
 * a database of found items for Holy Grail tracking.
 */
class SaveFileMonitor {
  private currentData: FileReaderResponse;
  private inventorySnapshots: CharacterInventorySnapshot[] = [];
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
    log.info('constructor', 'Constructor called');
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
    log.info('constructor', 'D2S constants initialized');

    // Initialize save directories
    this.initializeSaveDirectories();

    // Start the tick reader for automatic file change detection
    const tickInterval = this.getTickReaderInterval();
    this.tickReaderInterval = setInterval(this.tickReader, tickInterval);
    log.info('constructor', `Tick reader started (interval: ${tickInterval}ms)`);
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
    log.info('initializeSaveDirectories', 'Starting initialization');
    // First, try to get saveDir from Settings via grail database
    let customSaveDir: string | null = null;
    if (this.grailDatabase) {
      try {
        const settings = this.grailDatabase.getAllSettings();
        log.info(
          'initializeSaveDirectories',
          `Settings retrieved: saveDir=${settings.saveDir}, gameMode=${settings.gameMode}`,
        );
        if (settings.saveDir && settings.saveDir.trim() !== '') {
          customSaveDir = settings.saveDir.trim();
          log.info('initializeSaveDirectories', `Custom save directory found: ${customSaveDir}`);
        } else {
          log.info('initializeSaveDirectories', 'No custom save directory in settings');
        }
      } catch (error) {
        log.warn('initializeSaveDirectories', `Failed to read saveDir from settings: ${error}`);
      }
    } else {
      log.info('initializeSaveDirectories', 'No grail database available');
    }

    // Use custom saveDir if available, otherwise fall back to platform default
    if (customSaveDir) {
      this.saveDirectory = customSaveDir;
      log.info('initializeSaveDirectories', `Using custom directory: ${this.saveDirectory}`);
    } else {
      this.saveDirectory = this.getPlatformDefaultDirectory();
      log.info(
        'initializeSaveDirectories',
        `Using platform default directory: ${this.saveDirectory}`,
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
      log.warn(
        'validateInterval',
        `Invalid interval ${value} (valid range: ${min}-${max}ms), using default ${defaultValue}ms`,
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
    log.info('startMonitoring', 'Called');
    if (this.isMonitoring) {
      log.info('startMonitoring', 'Already monitoring, exiting');
      return;
    }

    // Refresh save directory from settings
    log.info('startMonitoring', 'Refreshing save directory from settings');
    await this.initializeSaveDirectories();

    if (!this.saveDirectory) {
      log.warn('startMonitoring', 'No save directory configured');
      this.eventBus.emit('monitoring-error', {
        type: 'no-directory',
        message: 'No save directory configured',
        directory: null,
      });
      return;
    }

    log.info('startMonitoring', `Checking if directory exists: ${this.saveDirectory}`);
    // Check if directory exists
    if (!existsSync(this.saveDirectory)) {
      log.warn('startMonitoring', `Save directory does not exist: ${this.saveDirectory}`);
      this.eventBus.emit('monitoring-error', {
        type: 'directory-not-found',
        message: `Save directory does not exist: ${this.saveDirectory}`,
        directory: this.saveDirectory,
      });
      return;
    }

    log.info('startMonitoring', 'Directory exists, starting initial parsing');
    // Start file parsing to get initial data and file count
    this.isInitialParsing = true;
    const parsedSuccessfully = await this.parseSaveDirectory(this.saveDirectory);
    this.isInitialParsing = false;

    if (!parsedSuccessfully) {
      log.warn('startMonitoring', 'Initial parsing failed');
      return; // Error was already emitted
    }

    log.info('startMonitoring', 'Initial parsing successful');
    this.watchPath = this.saveDirectory;

    // Use polling mode for better compatibility with D2R (which uses atomic file writes)
    // Polling checks files periodically instead of relying on file system events
    const usePolling = true;
    log.info('startMonitoring', `Using polling mode: ${usePolling}`);

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

    log.info(
      'startMonitoring',
      `Using intervals: polling=${pollingInterval}ms, stability=${stabilityThreshold}ms`,
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
        log.info('chokidar', `Event: ${event} on ${path}`);
        this.fileChangeCounter++;
        this.lastFileChangeTime = Date.now();
        log.info('chokidar', `fileChangeCounter incremented to ${this.fileChangeCounter}`);
      })
      .on('error', (error) => log.error('chokidar', error))
      .on('ready', () => {
        log.info('chokidar', 'File watcher ready');
        const watched = this.fileWatcher?.getWatched();
        if (watched) {
          log.info('chokidar', `Watching paths: ${Object.keys(watched).join(', ')}`);
          log.info(
            'chokidar',
            `Total files being watched: ${Object.values(watched).reduce((sum, files) => sum + files.length, 0)}`,
          );
        }
      })
      .on('add', (path) => log.info('chokidar', `File added: ${path}`))
      .on('change', (path) => log.info('chokidar', `File changed: ${path}`))
      .on('unlink', (path) => log.info('chokidar', `File removed: ${path}`));

    this.isMonitoring = true;
    log.info('startMonitoring', 'Monitoring flag set to true');

    // Count save files for status reporting
    const saveFiles = await this.getSaveFiles();

    this.eventBus.emit('monitoring-started', {
      directory: this.saveDirectory,
      saveFileCount: saveFiles.length,
    });

    log.info(
      'startMonitoring',
      `Save file monitoring started for directory: ${this.saveDirectory} - Found ${saveFiles.length} save files`,
    );
  }

  /**
   * Stops monitoring the save file directory.
   * Closes the file watcher and emits a monitoring-stopped event.
   * @returns {Promise<void>} A promise that resolves when monitoring is stopped.
   */
  async stopMonitoring(): Promise<void> {
    log.info('stopMonitoring', 'Called');
    if (this.fileWatcher) {
      log.info('stopMonitoring', 'Closing file watcher');
      await this.fileWatcher.close();
      this.fileWatcher = null;
      log.info('stopMonitoring', 'File watcher closed');
    }
    this.watchPath = null;
    this.isMonitoring = false;
    log.info('stopMonitoring', 'Monitoring stopped');
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
        log.error('findExistingSaveDirectories', error, { directory: dir });
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
        log.error('parseAllSaveDirectories', error, { directory: dir });
      }
    }

    log.info('parseAllSaveDirectories', `Found ${allFiles.length} save files total`);

    // Clean up save file states for files that no longer exist
    this.cleanupDeletedFileStates(allFiles);

    if (allFiles.length === 0) {
      log.warn(
        'parseAllSaveDirectories',
        `No D2R save files found in directories: ${directories.join(', ')}`,
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
    log.info('parseAllSaveDirectories', 'Parsing complete');
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
        log.warn('parseSaveDirectory', `No D2R save files found in directory: ${directory}`);
        this.eventBus.emit('monitoring-error', {
          type: 'no-save-files',
          message: `No D2R save files found in monitored directory`,
          directory: directory,
          saveFileCount: 0,
        });
        return false;
      }

      // Parse all files and update current data
      log.info('parseSaveDirectory', `Parsing ${allFiles.length} save files`);
      await this.parseFiles(allFiles, false);
      log.info('parseSaveDirectory', 'Parsing complete');
      return true;
    } catch (error) {
      log.error('parseSaveDirectory', error, { directory });
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
      log.error('shouldParseSaveFile', error, { filePath });
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

    log.info(
      'filterFilesToParse',
      `Will parse ${filesToParse.length} out of ${filePaths.length} files`,
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

  private inferLocationContext(
    item: D2SItem,
    fallback: VaultLocationContext,
  ): VaultLocationContext {
    if (item.location === 'equipped' || item.equipped) return 'equipped';
    if (item.location === 'stash') return 'stash';
    if (item.location === 'inventory') return 'inventory';
    if (item.location === 'mercenary') return 'mercenary';
    if (item.location === 'corpse') return 'corpse';
    return fallback;
  }

  private createFingerprint(item: ParsedInventoryItem): string {
    const stash = item.stashTab !== undefined ? String(item.stashTab) : '';
    return [
      item.sourceFileType,
      item.characterName,
      item.locationContext,
      item.itemCode ?? '',
      item.quality,
      String(item.ethereal),
      String(item.socketCount),
      stash,
      item.itemName,
    ].join('|');
  }

  private createParsedInventoryItem(params: {
    filePath: string;
    saveName: string;
    sourceFileType: VaultSourceFileType;
    item: D2SItem;
    fallbackLocation: VaultLocationContext;
    stashTab?: number;
  }): ParsedInventoryItem {
    const locationContext = this.inferLocationContext(params.item, params.fallbackLocation);
    const quality = String(params.item.quality ?? 'normal');
    const runewordName = getValidatedRunewordName(params.item);
    const itemName = runewordName
      ? runewordName.toLowerCase().replace(/[^a-z0-9]/gi, '')
      : processItemName(params.item);
    const socketCount = Array.isArray(params.item.gems)
      ? params.item.gems.length
      : (params.item.socket_count ??
        (typeof params.item.socketed === 'number' ? params.item.socketed : 0));

    const parsed: ParsedInventoryItem = {
      fingerprint: '',
      fingerprintInputs: {
        sourceFileType: params.sourceFileType,
        characterName: params.saveName,
        locationContext,
        itemCode: params.item.code ?? params.item.type ?? undefined,
        quality,
        ethereal: !!params.item.ethereal,
        socketCount,
        stashTab: params.stashTab,
        itemName,
      },
      characterName: params.saveName,
      sourceFileType: params.sourceFileType,
      sourceFilePath: params.filePath,
      locationContext,
      stashTab: params.stashTab,
      itemName,
      itemCode: params.item.code ?? params.item.type ?? undefined,
      quality,
      type: runewordName ? 'runeword' : params.item.type,
      ethereal: !!params.item.ethereal,
      socketCount,
      grailItemId: getGrailItemId(params.item as d2s.types.IItem) ?? undefined,
      rawItemJson: JSON.stringify(params.item),
      rawParsedItem: params.item as d2s.types.IItem,
      seenAt: new Date(),
    };

    parsed.fingerprint = this.createFingerprint(parsed);
    return parsed;
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
  ): Promise<{
    saveName: string;
    success: boolean;
    inventorySnapshot?: CharacterInventorySnapshot;
  }> {
    const saveName = this.getSaveNameFromPath(filePath);

    try {
      const buffer = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();
      const inventoryItems = await this.parseSave(saveName, filePath, buffer, extension);
      const characterId = this.grailDatabase?.getCharacterByName(saveName)?.id;
      const inventoryItemsWithCharacter = inventoryItems.map((inventoryItem) => ({
        ...inventoryItem,
        characterId,
      }));

      results.stats[saveName] = 0;

      for (const inventoryItem of inventoryItemsWithCharacter) {
        const item = inventoryItem.rawParsedItem;
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

      return {
        saveName,
        success: true,
        inventorySnapshot: {
          snapshotId: `${saveName}-${Date.now()}`,
          characterName: saveName,
          characterId,
          sourceFileType: extension.replace('.', '') as VaultSourceFileType,
          sourceFilePath: filePath,
          capturedAt: new Date(),
          items: inventoryItemsWithCharacter,
        },
      };
    } catch (error) {
      log.error('processSingleFile', error, { filePath });
      results.stats[saveName] = null;
      return { saveName, success: false, inventorySnapshot: undefined };
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
      log.error('updateSaveFileState', error, { filePath });
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
    log.info('emitSaveFileEvents', `Emitting events for ${filePaths.length} files`);
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
        log.error('emitSaveFileEvents', error, { filePath });
      }
    }
    log.info('emitSaveFileEvents', 'All events emitted');
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
          log.error('executeConcurrently', error, { taskIndex: item.index });
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
    log.info(
      'parseFiles',
      `Starting to parse ${filePaths.length} files, userRequested: ${userRequested}`,
    );
    const results: FileReaderResponse = {
      items: {},
      ethItems: {},
      stats: {},
      availableRunes: {},
    };

    if (!this.grailDatabase) {
      log.warn('parseFiles', 'No grail database available for parsing');
      return;
    }

    // Filter files that need parsing based on modification time
    let filesToParse = await this.filterFilesToParse(filePaths);

    // If no files changed but snapshots are empty, force-parse all files
    // so inventory data is available on startup
    if (filesToParse.length === 0 && this.inventorySnapshots.length === 0 && filePaths.length > 0) {
      log.info(
        'parseFiles',
        'No files changed but inventory snapshots are empty, forcing full parse',
      );
      filesToParse = filePaths;
    }

    log.info(
      'parseFiles',
      `Parsing ${filesToParse.length} out of ${filePaths.length} save files (${filePaths.length - filesToParse.length} skipped due to no changes)`,
    );

    if (filesToParse.length === 0) {
      log.info('parseFiles', 'No files to parse, exiting early');
      return;
    }

    // Parse files with concurrency limit to prevent resource exhaustion
    log.info(
      'parseFiles',
      `Starting concurrent parsing of ${filesToParse.length} files (max ${this.MAX_CONCURRENT_PARSES} at a time)`,
    );

    const tasks = filesToParse.map((filePath) => {
      return () => this.processSingleFile(filePath, results);
    });

    const parseResults = await this.executeConcurrently(tasks, this.MAX_CONCURRENT_PARSES);

    const failedFiles = parseResults.filter((r) => r && !r.success);
    const successfulSnapshots = parseResults
      .filter((r) => r?.success && r.inventorySnapshot)
      .map((r) => r.inventorySnapshot as CharacterInventorySnapshot);
    if (failedFiles.length > 0) {
      log.warn(
        'parseFiles',
        `${failedFiles.length} file(s) failed to parse: ${failedFiles.map((f) => f.saveName).join(', ')}`,
      );
    }
    log.info(
      'parseFiles',
      `Concurrent parsing complete: ${filesToParse.length - failedFiles.length} succeeded, ${failedFiles.length} failed`,
    );

    // Reset force parse flag after parsing completes
    if (this.forceParseAll) {
      log.info('parseFiles', 'Resetting forceParseAll flag');
      this.forceParseAll = false;
    }

    // Update save directory if user requested
    if (userRequested && filePaths.length > 0) {
      const firstDir = dirname(filePaths[0]);
      log.info('parseFiles', `User requested parsing, updating saveDir to: ${firstDir}`);
      this.grailDatabase.setSetting('saveDir', firstDir);
    }

    // Update current data
    this.currentData = results;
    this.inventorySnapshots = successfulSnapshots;

    if (this.grailDatabase) {
      this.reconcileVaultFromSnapshots(successfulSnapshots);
    }

    // Emit save file events for each file that was actually parsed
    await this.emitSaveFileEvents(filesToParse, results);
    log.info('parseFiles', `Complete - processed ${filesToParse.length} files`);
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
    saveName: string,
    filePathOrContent: string | Buffer,
    contentOrExtension: Buffer | string,
    extensionArg?: string,
  ): Promise<ParsedInventoryItem[]> {
    const items: ParsedInventoryItem[] = [];

    const legacyCall = Buffer.isBuffer(filePathOrContent);
    const filePath = legacyCall ? `${saveName}.d2s` : filePathOrContent;
    const content = (legacyCall ? filePathOrContent : contentOrExtension) as Buffer;
    const extension = (legacyCall ? contentOrExtension : extensionArg) as string;

    const sourceFileType = extension.replace('.', '') as VaultSourceFileType;

    const parseItems = (
      itemList: D2SItem[],
      fallbackLocation: VaultLocationContext,
      stashTab?: number,
      _isEmbed: boolean = false,
    ) => {
      itemList.forEach((item) => {
        const runewordName = getValidatedRunewordName(item);
        const shouldTrack =
          shouldIncludeItem(item) || isRune(item as d2s.types.IItem) || !!runewordName;

        if (shouldTrack) {
          items.push(
            this.createParsedInventoryItem({
              filePath,
              saveName,
              sourceFileType,
              item,
              fallbackLocation,
              stashTab,
            }),
          );
        }

        if (item.socketed_items?.length) {
          parseItems(item.socketed_items, fallbackLocation, stashTab, true);
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
      const inventoryItems = (response.items || []) as D2SItem[];
      const mercItems = (response.merc_items || []) as D2SItem[];
      const corpseItems = (response.corpse_items || []) as D2SItem[];
      parseItems(inventoryItems, 'inventory');
      parseItems(mercItems, 'mercenary');
      parseItems(corpseItems, 'corpse');
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

      response.pages.forEach((page, pageIndex) => {
        parseItems(page.items as D2SItem[], 'stash', pageIndex);
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
          log.info('parseSaveFile', `Parsed .d2i file, hardcore: ${isHardcore}`);
        } catch (_parseError) {
          log.warn('parseSaveFile', 'Failed to parse .d2i file header, falling back to filename');
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
      log.error('parseSaveFile', error);
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
    log.info('getSaveFiles', 'Called');
    const saveFiles: D2SaveFile[] = [];

    if (!this.saveDirectory) {
      log.info('getSaveFiles', 'No save directory configured');
      return saveFiles;
    }

    log.info('getSaveFiles', `Reading directory: ${this.saveDirectory}`);
    try {
      const files = readdirSync(this.saveDirectory);
      log.info('getSaveFiles', `Total files in directory: ${files.length}`);

      const d2sFiles = files.filter((file) => file.endsWith('.d2s'));
      log.info('getSaveFiles', `.d2s files found: ${d2sFiles.length}`);

      for (const file of d2sFiles) {
        const filePath = join(this.saveDirectory, file);
        const saveFile = await this.parseSaveFile(filePath);
        if (saveFile) {
          saveFiles.push(saveFile);
        } else {
          log.info('getSaveFiles', `Failed to parse save file: ${file}`);
        }
      }
    } catch (error) {
      log.error('getSaveFiles', error, { directory: this.saveDirectory });
    }

    log.info('getSaveFiles', `Returning ${saveFiles.length} save files`);
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
    log.info('updateSaveDirectory', 'Called');
    // Update the save directory and restart monitoring if active
    // Stop any existing monitoring before changing directory
    if (this.isMonitoring) {
      log.info('updateSaveDirectory', 'Stopping current monitoring');
      await this.stopMonitoring();
    }

    // Force parse all files in new directory
    log.info('updateSaveDirectory', 'Setting forceParseAll flag');
    this.forceParseAll = true;
    this.lastFileChangeTime = 0; // Bypass debounce for force parse

    // Re-initialize directories with the new setting
    log.info('updateSaveDirectory', 'Re-initializing save directories');
    await this.initializeSaveDirectories();

    // Always start monitoring after directory change - user explicitly wants to use this directory
    log.info('updateSaveDirectory', 'Starting monitoring for new directory');
    await this.startMonitoring();

    log.info('updateSaveDirectory', 'Complete');
  }

  private reconcileVaultFromSnapshots(snapshots: CharacterInventorySnapshot[]): void {
    const bySource = new Map<string, CharacterInventorySnapshot>();

    for (const snapshot of snapshots) {
      const key = `${snapshot.sourceFileType}:${snapshot.characterName}`;
      bySource.set(key, snapshot);

      const characterId = this.grailDatabase?.getCharacterByName(snapshot.characterName)?.id;
      const now = new Date();

      for (const item of snapshot.items) {
        this.grailDatabase?.upsertVaultItemByFingerprint({
          fingerprint: item.fingerprint,
          itemName: item.itemName,
          itemCode: item.itemCode,
          quality: item.quality,
          ethereal: item.ethereal,
          socketCount: item.socketCount,
          rawItemJson: item.rawItemJson,
          sourceCharacterId: characterId,
          sourceCharacterName: snapshot.characterName,
          sourceFileType: snapshot.sourceFileType,
          locationContext: item.locationContext,
          stashTab: item.stashTab,
          grailItemId: item.grailItemId,
          isPresentInLatestScan: true,
          lastSeenAt: now,
        });
      }
    }

    for (const snapshot of bySource.values()) {
      const characterId = this.grailDatabase?.getCharacterByName(snapshot.characterName)?.id;
      this.grailDatabase?.reconcileVaultItemsForScan({
        sourceFileType: snapshot.sourceFileType,
        sourceCharacterId: characterId,
        sourceCharacterName: snapshot.characterName,
        presentFingerprints: snapshot.items.map((item) => item.fingerprint),
        lastSeenAt: snapshot.capturedAt,
      });
    }
  }

  /**
   * Gets the current parsed item data.
   * @returns {FileReaderResponse} The current item data from all parsed save files.
   */
  getItems(): FileReaderResponse {
    return this.currentData;
  }

  getInventorySearchResult(): InventorySearchResult {
    return {
      snapshots: this.inventorySnapshots,
      totalSnapshots: this.inventorySnapshots.length,
      totalItems: this.inventorySnapshots.reduce((sum, snapshot) => sum + snapshot.items.length, 0),
    };
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
    log.info('refreshSaveFiles', 'Manual refresh requested');

    if (!this.isMonitoring) {
      log.info('refreshSaveFiles', 'Not monitoring, cannot refresh');
      throw new Error('Save file monitoring is not active');
    }

    // Set force parse flag and trigger immediate parsing
    this.forceParseAll = true;
    this.lastFileChangeTime = 0; // Bypass debounce

    // Increment file change counter to trigger tick reader
    this.fileChangeCounter++;

    log.info('refreshSaveFiles', 'Triggered force parse, waiting for completion...');

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
      log.info('refreshSaveFiles', 'Timeout waiting for parse to complete');
      throw new Error('Timeout waiting for save file refresh to complete');
    }

    log.info('refreshSaveFiles', 'Refresh completed');
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
      log.info(
        'tickReader',
        `Heartbeat - watching: ${this.watchPath}, changeCounter: ${this.fileChangeCounter}, lastProcessed: ${this.lastProcessedChangeCounter}, isMonitoring: ${this.isMonitoring}`,
      );
    }

    if (!this.grailDatabase) {
      log.info('tickReader', 'Skipping: No grail database');
      return;
    }

    const settings = this.grailDatabase.getAllSettings();

    if (!this.watchPath) {
      log.info('tickReader', 'Skipping: No watch path');
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
        log.info(
          'tickReader',
          `Debouncing: ${timeSinceLastChange}ms since last change (waiting for ${debounceDelay}ms)`,
        );
      }
      return;
    }

    if (this.readingFiles) {
      log.info('tickReader', 'Skipping: Already reading files');
      return;
    }

    if (settings.gameMode === GameMode.Manual) {
      log.info('tickReader', 'Skipping: Manual mode active');
      return;
    }

    log.info(
      'tickReader',
      `Debounce period elapsed (${timeSinceLastChange}ms), processing file changes...`,
    );
    log.info(
      'tickReader',
      `Processing changes: counter=${this.fileChangeCounter}, lastProcessed=${this.lastProcessedChangeCounter}`,
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
    log.info(
      'tickReader',
      `Done processing file changes (processed up to counter ${counterAtStartOfProcessing})`,
    );

    // Check if new changes arrived during processing
    if (this.fileChangeCounter > counterAtStartOfProcessing) {
      log.info(
        'tickReader',
        `New changes detected during processing (counter now ${this.fileChangeCounter}), will process on next tick`,
      );
    }
  };

  /**
   * Cleans up save file states for files that no longer exist.
   * @private
   * @param {string[]} existingFilePaths - Array of file paths that currently exist
   */
  private cleanupDeletedFileStates(existingFilePaths: string[]): void {
    log.info('cleanupDeletedFileStates', 'Checking for deleted files');
    if (!this.grailDatabase) {
      log.info('cleanupDeletedFileStates', 'No database available');
      return;
    }

    const existingPaths = new Set(existingFilePaths);
    const allStates = this.grailDatabase.getAllSaveFileStates();
    log.info(
      'cleanupDeletedFileStates',
      `Existing files: ${existingFilePaths.length}, Tracked states: ${allStates.length}`,
    );

    let deletedCount = 0;
    for (const state of allStates) {
      if (!existingPaths.has(state.filePath)) {
        log.info(
          'cleanupDeletedFileStates',
          `Cleaning up state for deleted file: ${state.filePath}`,
        );
        this.grailDatabase.deleteSaveFileState(state.filePath);
        deletedCount++;
      }
    }

    log.info('cleanupDeletedFileStates', `Cleaned up ${deletedCount} deleted file states`);
  }

  /**
   * Shuts down the save file monitor and stops all monitoring activities.
   * @returns {Promise<void>} A promise that resolves when shutdown is complete.
   */
  async shutdown(): Promise<void> {
    log.info('shutdown', 'Shutting down save file monitor');
    if (this.tickReaderInterval) {
      log.info('shutdown', 'Clearing tick reader interval');
      clearInterval(this.tickReaderInterval);
      this.tickReaderInterval = null;
    }
    await this.stopMonitoring();
    log.info('shutdown', 'Shutdown complete');
  }
}

export { SaveFileMonitor };
export type { D2SaveFile, SaveFileEvent };
