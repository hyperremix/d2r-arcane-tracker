import { existsSync, readdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { FSWatcher } from 'chokidar';
import { app } from 'electron';
import type { GrailDatabase } from '../../database/database';
import type {
  D2SaveFile,
  InventorySearchResult,
  ParsedInventorySnapshot,
  SaveFileEvent,
  SaveFileState,
  VaultSourceFileType,
} from '../../types/grail';
import { GameMode } from '../../types/grail';
import { createServiceLogger } from '../../utils/serviceLogger';
import { ensureD2sConstants } from '../d2s/constants';
import type { EventBus } from '../EventBus';
import type { SettingsService } from '../settingsService';
import { executeConcurrently } from './executeConcurrently';
import { countAvailableRunes, mergeInventorySnapshots } from './inventorySnapshots';
import {
  readConfiguredSaveDirectory,
  resolveDebounceDelay,
  resolveEffectiveSaveDirectory,
  resolveTickReaderInterval,
  resolveWatcherIntervals,
} from './saveDirectorySettings';
import {
  buildSaveFileHeader,
  type D2iHeaderInfo,
  getSaveNameFromPath,
  readD2iHeaderInfo,
  shouldIncludeSaveFile,
} from './saveFileFormat';
import { type GameModeReader, parseSaveContent, readLegacyStashHardcore } from './saveFileParser';
import { SAVE_WATCHER_USES_POLLING, watchSaveDirectory } from './saveFileWatcher';
import type {
  CompleteFileParseResult,
  FileParseSuccess,
  IncompleteFileParseResult,
  SingleFileParseResult,
} from './types';
import {
  createPresenceIdentityKey,
  markOrphanedVaultRowsMissing,
  reconcileVaultPresence,
  type VaultPresenceDatabase,
} from './vaultPresenceReconciler';

const log = createServiceLogger('SaveFileMonitor');

/** The database operations the save file monitor uses. */
export type SaveFileMonitorDatabase = VaultPresenceDatabase &
  Pick<
    GrailDatabase,
    | 'getSaveFileState'
    | 'upsertSaveFileState'
    | 'getAllSaveFileStates'
    | 'deleteSaveFileState'
    | 'getCharacterByName'
  >;

/** The settings access the save file monitor uses. */
export type SaveFileMonitorSettings = Pick<SettingsService, 'get' | 'getAll'>;

/** A pending request to re-parse every save file; settled once that parse ran or was skipped. */
interface ForcedParseRequest {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

function createForcedParseRequest(): ForcedParseRequest {
  let resolve: () => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

/**
 * Service for monitoring Diablo 2 save files and extracting item data.
 * This service watches save file directories, parses D2 save files, and maintains
 * a database of found items for Holy Grail tracking.
 */
class SaveFileMonitor {
  private inventorySnapshots: ParsedInventorySnapshot[] = [];
  private fileWatcher: FSWatcher | null;
  private watchPath: string | null;
  private fileChangeCounter: number = 0;
  private lastProcessedChangeCounter: number = 0;
  private readingFiles: boolean;
  private isMonitoring = false;
  private monitoringOperations: Promise<void> = Promise.resolve();
  private readonly grailDatabase: SaveFileMonitorDatabase;
  private readonly settings: SaveFileMonitorSettings;
  private saveDirectory: string | null = null;
  /** True only while a forced parse runs: every file is parsed regardless of its modification time. */
  private forceParseAll: boolean = false;
  /** Forced parse requested by `refreshSaveFiles` that the tick reader has not started yet. */
  private pendingForcedParse: ForcedParseRequest | undefined;
  private isInitialParsing: boolean = false;
  private tickReaderInterval: NodeJS.Timeout | null = null;
  private tickReaderCount: number = 0;
  private eventBus: EventBus;
  private lastFileChangeTime: number = 0;
  private readonly MAX_CONCURRENT_PARSES = 5; // Limit concurrent file parsing

  /**
   * Creates a new instance of the SaveFileMonitor.
   * @param {EventBus} eventBus - EventBus instance for emitting events
   * @param {SaveFileMonitorDatabase} grailDatabase - Stores save file states and vault presence.
   * @param {SaveFileMonitorSettings} settings - Reads the save directory, game mode and intervals.
   */
  constructor(
    eventBus: EventBus,
    grailDatabase: SaveFileMonitorDatabase,
    settings: SaveFileMonitorSettings,
  ) {
    log.info('constructor', 'Constructor called');
    this.eventBus = eventBus;
    this.grailDatabase = grailDatabase;
    this.settings = settings;
    this.fileWatcher = null;
    this.watchPath = null;
    this.fileChangeCounter = 0;
    this.lastProcessedChangeCounter = 0;
    this.readingFiles = false;

    // Initialize D2S constants
    ensureD2sConstants();
    log.info('constructor', 'D2S constants initialized');

    // Initialize save directories
    this.initializeSaveDirectories();
  }

  /**
   * Starts the tick reader for automatic file change detection. The constructor starts no timers,
   * so call this once right after construction. Calling it again while the tick reader runs does
   * nothing. `shutdown` stops it.
   */
  start(): void {
    if (this.tickReaderInterval) {
      return;
    }

    const tickInterval = resolveTickReaderInterval(this.settings);
    this.tickReaderInterval = setInterval(this.tickReader, tickInterval);
    log.info('start', `Tick reader started (interval: ${tickInterval}ms)`);
  }

  /**
   * Applies the effective save directory (see `resolveEffectiveSaveDirectory`): the configured
   * `saveDir` setting, or the platform default. A setting that cannot be read counts as not
   * configured.
   * @private
   */
  private initializeSaveDirectories(): void {
    log.info('initializeSaveDirectories', 'Starting initialization');
    this.saveDirectory =
      resolveEffectiveSaveDirectory(
        readConfiguredSaveDirectory(this.settings),
        this.getPlatformDefaultDirectory(),
      ) ?? null;
    log.info('initializeSaveDirectories', `Using save directory: ${this.saveDirectory}`);
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
   * Starts monitoring the save file directory for changes.
   * Sets up file watching and parses existing save files.
   * @returns {Promise<void>} A promise that resolves when monitoring is started.
   */
  async startMonitoring(): Promise<void> {
    return this.runMonitoringOperation(() => this.performStartMonitoring());
  }

  /**
   * Runs a start/stop operation after all previously requested ones have settled, so a stop can
   * never overtake a start still parsing (and vice versa) and leave monitoring in the wrong state.
   * @private
   * @param {() => Promise<void>} operation - The operation to run.
   * @returns {Promise<void>} A promise that settles with the operation's outcome.
   */
  private runMonitoringOperation(operation: () => Promise<void>): Promise<void> {
    const result = this.monitoringOperations.then(operation);
    this.monitoringOperations = result.catch(() => undefined);
    return result;
  }

  private async performStartMonitoring(): Promise<void> {
    log.info('startMonitoring', 'Called');
    if (this.isMonitoring) {
      log.info('startMonitoring', 'Already monitoring, exiting');
      return;
    }

    // Refresh save directory from settings
    log.info('startMonitoring', 'Refreshing save directory from settings');
    this.initializeSaveDirectories();

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
    let parsedSuccessfully: boolean;
    try {
      parsedSuccessfully = await this.parseSaveDirectory(this.saveDirectory);
    } finally {
      this.isInitialParsing = false;
    }

    if (!parsedSuccessfully) {
      log.warn('startMonitoring', 'Initial parsing failed');
      return; // Error was already emitted
    }

    log.info('startMonitoring', 'Initial parsing successful');
    this.watchPath = this.saveDirectory;

    log.info('startMonitoring', `Using polling mode: ${SAVE_WATCHER_USES_POLLING}`);

    // Get configurable intervals from settings
    const { pollingInterval, stabilityThreshold } = resolveWatcherIntervals(this.settings.getAll());

    log.info(
      'startMonitoring',
      `Using intervals: polling=${pollingInterval}ms, stability=${stabilityThreshold}ms`,
    );

    this.fileWatcher = watchSaveDirectory(
      this.saveDirectory,
      { pollingInterval, stabilityThreshold },
      () => {
        this.fileChangeCounter++;
        this.lastFileChangeTime = Date.now();
        log.info('chokidar', `fileChangeCounter incremented to ${this.fileChangeCounter}`);
      },
    );

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
    return this.runMonitoringOperation(() => this.performStopMonitoring());
  }

  /**
   * Stops monitoring only if it is active once all previously requested start/stop operations
   * have settled. Unlike stopMonitoring, it emits nothing when there is nothing to stop.
   * @returns {Promise<void>} A promise that resolves when the monitor is stopped.
   */
  async stopMonitoringIfActive(): Promise<void> {
    return this.runMonitoringOperation(async () => {
      if (this.isMonitoring || this.fileWatcher) {
        await this.performStopMonitoring();
      }
    });
  }

  private async performStopMonitoring(): Promise<void> {
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
        const files = allFilesInDir.filter((file) => shouldIncludeSaveFile(file));
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
    await this.parseFiles(allFiles);
    log.info('parseAllSaveDirectories', 'Parsing complete');
    return true;
  }

  /**
   * Parses all save files in a single directory.
   * @private
   * @param {string} directory - The directory path to parse.
   * @returns {Promise<boolean>} A promise that resolves to true if the directory was readable (even when it holds no save files yet), false otherwise.
   */
  private async parseSaveDirectory(directory: string): Promise<boolean> {
    try {
      const allFilesInDir = readdirSync(directory);

      const files = allFilesInDir.filter((file) => shouldIncludeSaveFile(file));

      const allFiles = files.map((file) => join(directory, file));

      if (allFiles.length === 0) {
        // The directory exists and is readable, so keep watching it: the first character
        // save created later must still be detected.
        log.warn('parseSaveDirectory', `No D2R save files found in directory: ${directory}`);
        this.eventBus.emit('monitoring-error', {
          type: 'no-save-files',
          message: `No D2R save files found in monitored directory`,
          directory: directory,
          saveFileCount: 0,
        });
        return true;
      }

      // Parse all files and update current data
      log.info('parseSaveDirectory', `Parsing ${allFiles.length} save files`);
      await this.parseFiles(allFiles);
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
      const stats = await stat(filePath);
      const fileState = this.grailDatabase.getSaveFileState(filePath);

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
   * Reads the configured game mode for the parser.
   * @private
   */
  private createGameModeReader(): GameModeReader {
    return () => this.settings.get('gameMode');
  }

  /**
   * Reads and parses a single save file once: its items, inventory snapshot and header.
   * @private
   * @param {string} filePath - Path to the save file.
   * @returns {Promise<SingleFileParseResult>} Parse result with save name, success status and snapshot data.
   */
  private async processSingleFile(filePath: string): Promise<SingleFileParseResult> {
    let saveName = getSaveNameFromPath(filePath);

    try {
      // Stat before reading: if the file changes while it is read, the stored time stays older than
      // the new content, so the next scan parses the file again.
      const { mtime } = await stat(filePath);
      const buffer = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();
      let d2iHeader: D2iHeaderInfo | undefined;

      if (extension === '.d2i') {
        d2iHeader = readD2iHeaderInfo(filePath, buffer);
        saveName = getSaveNameFromPath(filePath, d2iHeader.hardcore, d2iHeader.version);
      }

      const {
        items: inventoryItems,
        status: parseStatus,
        stashHardcore,
      } = await parseSaveContent(
        { saveName, filePath, content: buffer, extension },
        this.createGameModeReader(),
      );
      const characterId = this.grailDatabase.getCharacterByName(saveName)?.id;
      const parsedItems = inventoryItems.map((inventoryItem) => ({
        ...inventoryItem,
        characterId,
      }));
      const snapshotItems = parsedItems.filter((item) => !item.isSocketedItem);

      // Update save file state after successful parsing
      await this.updateSaveFileState(filePath, mtime);

      const inventorySnapshot: ParsedInventorySnapshot = {
        snapshotId: `${saveName}-${Date.now()}`,
        characterName: saveName,
        characterId,
        sourceFileType: extension.replace('.', '') as VaultSourceFileType,
        sourceFilePath: filePath,
        sourceFileVersion: d2iHeader?.version,
        readOnly: false,
        capturedAt: new Date(),
        items: snapshotItems,
      };
      const saveFile = buildSaveFileHeader(filePath, buffer, mtime, {
        d2iHeader,
        stashHardcore,
      });

      if (parseStatus !== 'parsed') {
        return {
          saveName,
          success: true,
          parseStatus,
          inventorySnapshot,
          saveFile,
          parsedItems,
        };
      }

      return {
        saveName,
        success: true,
        parseStatus,
        // Includes socketed items, which the snapshot omits, so vault reconciliation sees every item.
        presentFingerprints: parsedItems.map((item) => item.fingerprint),
        presentIdentityKeys: parsedItems.map((item) => createPresenceIdentityKey(item)),
        inventorySnapshot,
        saveFile,
        parsedItems,
      };
    } catch (error) {
      log.error('processSingleFile', error, { filePath });
      return { saveName, success: false };
    }
  }

  /**
   * Updates the database state for a parsed save file.
   * @private
   * @param {string} filePath - Path to the save file.
   * @param {Date} lastModified - Modification time of the file content that was parsed.
   */
  private async updateSaveFileState(filePath: string, lastModified: Date): Promise<void> {
    try {
      // Check if state already exists and reuse its ID
      const existingState = this.grailDatabase.getSaveFileState(filePath);
      const id =
        existingState?.id || `save-file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const saveFileState: SaveFileState = {
        id,
        filePath,
        lastModified,
        lastParsed: new Date(),
        created: existingState?.created || new Date(),
        updated: new Date(),
      };

      this.grailDatabase.upsertSaveFileState(saveFileState);
    } catch (error) {
      log.error('updateSaveFileState', error, { filePath });
    }
  }

  /**
   * Emits a save file event for every successfully parsed file, carrying the items and header that
   * were already parsed so listeners never read the file again.
   * @private
   * @param {FileParseSuccess[]} parsedFiles - Successful parse results, in file order.
   */
  private async emitSaveFileEvents(parsedFiles: FileParseSuccess[]): Promise<void> {
    log.info('emitSaveFileEvents', `Emitting events for ${parsedFiles.length} files`);
    for (const { saveFile, parsedItems } of parsedFiles) {
      try {
        // Suppress notifications during initial parsing so items that already exist on app startup
        // do not spam the user. A manual re-scan is not silent: the detection service already
        // ignores items it has seen, so only genuinely new items notify.
        // Items are still saved to database, only notifications are suppressed
        const silent = this.isInitialParsing;

        // Set isInitialScan flag ONLY during initial parsing (not force re-scan)
        // This marks items for exclusion from statistics like Recent Finds, Streaks, and Avg per Day
        const isInitialScan = this.isInitialParsing;

        // Note: Save file events are no longer used for run tracking
        // Auto mode uses memory reading instead (RunTrackerService listens to game-entered/game-exited events)

        // Emit event and wait for all handlers to complete processing
        // This prevents race conditions in item detection by ensuring sequential processing
        const event: SaveFileEvent = {
          type: 'modified',
          file: saveFile,
          parsedItems,
          silent,
          isInitialScan,
        };
        await this.eventBus.emitAsync('save-file-event', event);
      } catch (error) {
        log.error('emitSaveFileEvents', error, { filePath: saveFile.path });
      }
    }
    log.info('emitSaveFileEvents', 'All events emitted');
  }

  /**
   * Parses multiple save files and updates the current data.
   * @private
   * @param {string[]} filePaths - Array of file paths to parse.
   * @returns {Promise<void>} A promise that resolves when parsing is complete.
   */
  private async parseFiles(filePaths: string[]): Promise<void> {
    log.info('parseFiles', `Starting to parse ${filePaths.length} files`);

    await markOrphanedVaultRowsMissing(this.grailDatabase, filePaths);

    // Filter files that need parsing based on modification time
    let filesToParse = await this.filterFilesToParse(filePaths);

    // On startup, snapshots are empty and must be fully rebuilt to avoid a partial inventory view.
    if (this.inventorySnapshots.length === 0 && filePaths.length > 0) {
      log.info('parseFiles', 'Inventory snapshots are empty, forcing full parse of all files');
      filesToParse = filePaths;
    }

    log.info(
      'parseFiles',
      `Parsing ${filesToParse.length} out of ${filePaths.length} save files (${filePaths.length - filesToParse.length} skipped due to no changes)`,
    );

    if (filesToParse.length === 0) {
      log.info('parseFiles', 'No files to parse, exiting early');
      this.inventorySnapshots = mergeInventorySnapshots(this.inventorySnapshots, filePaths, [], []);
      return;
    }

    // Parse files with concurrency limit to prevent resource exhaustion
    log.info(
      'parseFiles',
      `Starting concurrent parsing of ${filesToParse.length} files (max ${this.MAX_CONCURRENT_PARSES} at a time)`,
    );

    const tasks = filesToParse.map((filePath) => {
      return () => this.processSingleFile(filePath);
    });

    const parseResults = await executeConcurrently(tasks, this.MAX_CONCURRENT_PARSES);
    const successfulParseResults = parseResults.filter(
      (result): result is CompleteFileParseResult | IncompleteFileParseResult =>
        Boolean(result?.success && result.saveName),
    );

    const failedFiles = parseResults.filter((r) => r && !r.success);
    const successfulSnapshots = successfulParseResults.map((result) => result.inventorySnapshot);
    reconcileVaultPresence(this.grailDatabase, parseResults);
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

    this.inventorySnapshots = mergeInventorySnapshots(
      this.inventorySnapshots,
      filePaths,
      filesToParse,
      successfulSnapshots,
    );

    // Emit save file events for each file that was actually parsed
    await this.emitSaveFileEvents(successfulParseResults);
    log.info('parseFiles', `Complete - processed ${filesToParse.length} files`);
  }

  /**
   * Reads a save file to extract basic character information.
   * @private
   * @param {string} filePath - The path to the save file.
   * @returns {Promise<D2SaveFile | null>} A promise that resolves with the parsed save file data or null if parsing fails.
   */
  private async parseSaveFile(filePath: string): Promise<D2SaveFile | null> {
    try {
      const stats = await stat(filePath);
      const buffer = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();

      let stashHardcore: boolean | undefined;
      if (extension === '.sss' || extension === '.d2x') {
        stashHardcore = await readLegacyStashHardcore(buffer);
      }

      return buildSaveFileHeader(filePath, buffer, stats.mtime, { stashHardcore });
    } catch (error) {
      log.error('parseSaveFile', error);
      return null;
    }
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

      const d2sFiles = files.filter((file) => extname(file).toLowerCase() === '.d2s');
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
   * Checks whether the persisted game mode is Manual (no save file monitoring).
   * @private
   * @returns {boolean} True if the game mode is Manual, false otherwise or if settings are unavailable.
   */
  private isManualGameMode(): boolean {
    try {
      return this.settings.get('gameMode') === GameMode.Manual;
    } catch (error) {
      log.warn('isManualGameMode', `Failed to read game mode from settings: ${error}`);
      return false;
    }
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

    try {
      // Re-initialize directories with the new setting
      log.info('updateSaveDirectory', 'Re-initializing save directories');
      this.initializeSaveDirectories();

      // Manual mode never monitors save files; the new directory is used when leaving Manual mode
      if (this.isManualGameMode()) {
        log.info('updateSaveDirectory', 'Manual mode active, not starting monitoring');
        log.info('updateSaveDirectory', 'Complete');
        return;
      }

      // Start monitoring after directory change - user explicitly wants to use this directory
      log.info('updateSaveDirectory', 'Starting monitoring for new directory');
      await this.startMonitoring();
    } finally {
      this.forceParseAll = false;
    }

    log.info('updateSaveDirectory', 'Complete');
  }

  getInventorySearchResult(): InventorySearchResult<ParsedInventorySnapshot> {
    return {
      snapshots: this.inventorySnapshots,
      totalSnapshots: this.inventorySnapshots.length,
      totalItems: this.inventorySnapshots.reduce((sum, snapshot) => sum + snapshot.items.length, 0),
    };
  }

  /**
   * Gets the count of each available rune across the latest inventory snapshot of every save file.
   * Stacked runes count with their stack size. Runes socketed into another item are used up and
   * therefore not available for runewords.
   * @returns {Record<string, number>} A record mapping rune IDs to their counts.
   */
  getAvailableRunesCount(): Record<string, number> {
    return countAvailableRunes(this.inventorySnapshots);
  }

  /**
   * Triggers a manual refresh/rescan of all save files.
   * This forces a re-parse of all save files to get the latest item data.
   * Resolves once the forced parse finished, or once it was skipped (manual game mode, no save
   * files, monitoring stopped); rejects if the parse itself failed.
   * @returns {Promise<void>} A promise that resolves when the refresh is complete.
   */
  async refreshSaveFiles(): Promise<void> {
    log.info('refreshSaveFiles', 'Manual refresh requested');

    if (!this.isMonitoring) {
      log.info('refreshSaveFiles', 'Not monitoring, cannot refresh');
      throw new Error('Save file monitoring is not active');
    }

    // Requests made before the tick reader picks one up share the same parse.
    this.pendingForcedParse ??= createForcedParseRequest();
    const { promise } = this.pendingForcedParse;

    log.info('refreshSaveFiles', 'Triggered force parse, waiting for completion...');
    // Start right away instead of waiting for the next tick. If files are being read already, the
    // tick after that read picks the request up.
    void this.tickReader();

    await promise;
    log.info('refreshSaveFiles', 'Refresh completed');
  }

  /**
   * Settles a pending forced parse request that cannot run, so `refreshSaveFiles` never waits for
   * a parse that will not happen.
   * @private
   */
  private skipPendingForcedParse(reason: string): void {
    const request = this.pendingForcedParse;
    if (!request) {
      return;
    }

    log.info('skipPendingForcedParse', `Forced parse skipped: ${reason}`);
    this.pendingForcedParse = undefined;
    request.resolve();
  }

  /**
   * Periodic tick reader that checks for file changes and re-parses if needed.
   * Never rejects: an unexpected error fails a pending forced parse instead of leaving
   * `refreshSaveFiles` waiting.
   * @private
   * @returns {Promise<void>} A promise that resolves when the tick is complete.
   */
  private tickReader = async (): Promise<void> => {
    try {
      await this.checkForFileChanges();
    } catch (error) {
      log.error('tickReader', error);
      const request = this.pendingForcedParse;
      this.pendingForcedParse = undefined;
      request?.reject(error);
    }
  };

  /**
   * Decides whether the save directories must be parsed on this tick and parses them if so.
   * @private
   */
  private async checkForFileChanges(): Promise<void> {
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

    if (!this.watchPath) {
      log.info('tickReader', 'Skipping: No watch path');
      this.skipPendingForcedParse('not watching a save directory');
      return;
    }

    const hasForcedParseRequest = this.pendingForcedParse !== undefined;

    // Check if there are unprocessed file changes
    if (!hasForcedParseRequest && this.fileChangeCounter === this.lastProcessedChangeCounter) {
      // No new changes since last processing
      return;
    }

    // Read only once there is something to process: most ticks see no changes
    const settings = this.settings.getAll();

    // Check if enough time has passed since last file change (debouncing)
    // Skip debounce for initial parsing or force parse
    const timeSinceLastChange = Date.now() - this.lastFileChangeTime;
    const shouldDebounce = !this.isInitialParsing && !hasForcedParseRequest;
    const debounceDelay = resolveDebounceDelay(settings);

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
      // A pending forced parse stays queued and runs on the tick after this read.
      log.info('tickReader', 'Skipping: Already reading files');
      return;
    }

    if (settings.gameMode === GameMode.Manual) {
      log.info('tickReader', 'Skipping: Manual mode active');
      this.skipPendingForcedParse('manual game mode');
      return;
    }

    log.info(
      'tickReader',
      `Debounce period elapsed (${timeSinceLastChange}ms), processing file changes...`,
    );
    await this.processFileChanges();
  }

  /**
   * Parses the save directories for the tick reader, taking a pending forced parse request along.
   * The request is settled once the parse finished; the force flag is always reset afterwards.
   * @private
   */
  private async processFileChanges(): Promise<void> {
    log.info(
      'processFileChanges',
      `Processing changes: counter=${this.fileChangeCounter}, lastProcessed=${this.lastProcessedChangeCounter}`,
    );
    this.readingFiles = true;

    // Take the forced parse request now: a refresh requested while this parse runs gets its own parse.
    const forcedParseRequest = this.pendingForcedParse;
    this.pendingForcedParse = undefined;
    this.forceParseAll = forcedParseRequest !== undefined;

    // Capture current counter before processing (in case new changes arrive during processing)
    const counterAtStartOfProcessing = this.fileChangeCounter;

    try {
      const directories = await this.findExistingSaveDirectories();
      await this.parseAllSaveDirectories(directories);

      // Update last processed counter to what we started processing
      // If new changes arrived during processing, they'll be caught on next tick
      this.lastProcessedChangeCounter = counterAtStartOfProcessing;

      log.info(
        'processFileChanges',
        `Done processing file changes (processed up to counter ${counterAtStartOfProcessing})`,
      );

      // Check if new changes arrived during processing
      if (this.fileChangeCounter > counterAtStartOfProcessing) {
        log.info(
          'processFileChanges',
          `New changes detected during processing (counter now ${this.fileChangeCounter}), will process on next tick`,
        );
      }

      forcedParseRequest?.resolve();
    } catch (error) {
      log.error('processFileChanges', error);
      forcedParseRequest?.reject(error);
    } finally {
      this.forceParseAll = false;
      this.readingFiles = false;
    }
  }

  /**
   * Cleans up save file states for files that no longer exist.
   * @private
   * @param {string[]} existingFilePaths - Array of file paths that currently exist
   */
  private cleanupDeletedFileStates(existingFilePaths: string[]): void {
    log.info('cleanupDeletedFileStates', 'Checking for deleted files');
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
    this.skipPendingForcedParse('monitor shut down');
    try {
      await this.stopMonitoring();
    } finally {
      // A refresh requested while the file watcher was closing found the monitor still active and
      // queued a request that no tick will pick up now that the interval is cleared. This runs
      // even when closing the watcher rejects so the refresh never hangs.
      this.skipPendingForcedParse('monitor shut down while the file watcher was closing');
    }
    log.info('shutdown', 'Shutdown complete');
  }
}

export { SaveFileMonitor };
export type { D2SaveFile, SaveFileEvent };
