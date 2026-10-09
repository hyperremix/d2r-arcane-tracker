import { existsSync, readdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import { app } from 'electron';
import type { GrailDatabase } from '../database/database';
import { runewordsByNameSimple } from '../items/indexes';
import type {
  CharacterInventorySnapshot,
  D2SaveFile,
  D2SItem,
  FileReaderResponse,
  InventorySearchResult,
  ItemDetails,
  ParsedInventoryItem,
  SaveFileEvent,
  SaveFileState,
  StashTabKind,
  VaultLocationContext,
  VaultSourceFileType,
} from '../types/grail';
import { GameMode } from '../types/grail';
import { getGrailItemId } from '../utils/grailItemUtils';
import { normalizeIconFilename, resolveCanonicalIconFilename } from '../utils/iconFilenameResolver';
import { isRune } from '../utils/objects';
import { createServiceLogger } from '../utils/serviceLogger';
import { resolveSpatialLocation } from '../utils/spatialLocationResolver';
import { createVaultPresenceKey } from '../utils/vaultPresence';
import type { EventBus } from './EventBus';
import { parseModernStash } from './modernStashParser';
import { readD2iHeaderVersion, readD2iMetadata } from './stashFormat';

const log = createServiceLogger('SaveFileMonitor');
/**
 * How much of a save file a parse really read.
 * - 'parsed': the whole file was read.
 * - 'partial': only some of the file could be read (a damaged .d2i sector); the items found so far are kept.
 * - 'skipped': filtered out by the configured game mode.
 * - 'errored': a parse error was swallowed.
 * Only 'parsed' proves which items are gone from a file; every other status yields no or only some items.
 */
type SaveParseStatus = 'parsed' | 'partial' | 'skipped' | 'errored';

interface FileParseSuccess {
  saveName: string;
  success: true;
  inventorySnapshot: CharacterInventorySnapshot;
}

/** A complete parse: the only result vault reconciliation may act on. */
interface CompleteFileParseResult extends FileParseSuccess {
  parseStatus: 'parsed';
  /** Fingerprints of every item in the file, including socketed ones the snapshot omits. */
  presentFingerprints: string[];
  /** Location-independent identity of each item, parallel to `presentFingerprints`. */
  presentIdentityKeys: string[];
}

/** A parse that read no items or only some of them; it must never mark vault rows as missing. */
interface IncompleteFileParseResult extends FileParseSuccess {
  parseStatus: Exclude<SaveParseStatus, 'parsed'>;
}

interface FailedFileParseResult {
  saveName: string;
  success: false;
}

type SingleFileParseResult =
  | CompleteFileParseResult
  | IncompleteFileParseResult
  | FailedFileParseResult;

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

const SUPPORTED_SAVE_EXTENSIONS = new Set(['.d2s', '.sss', '.d2x', '.d2i']);
const MODERN_STASH_MIN_VERSION = 105;

const processItemName = (item: D2SItem): string => {
  const itemId = getGrailItemId(item);
  if (itemId) {
    return itemId;
  }

  let name = item.unique_name || item.set_name || '';
  name = name.toLowerCase().replace(/[^a-z0-9]/gi, '');

  return name;
};

const shouldSkipItem = (name: string): boolean => name === '';

/** True when a save's softcore/hardcore status is excluded by the configured game mode. */
const isGameModeMismatch = (gameMode: GameMode | undefined, isHardcore: boolean): boolean =>
  (gameMode === GameMode.Softcore && isHardcore) || (gameMode === GameMode.Hardcore && !isHardcore);

const createSavedItem = (item: D2SItem, quantity?: number): ItemDetails => ({
  ethereal: !!item.ethereal,
  ilevel: item.level ?? null,
  socketed: !!item.socketed,
  quantity,
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

const mapQualityValue = (quality: number | undefined): string => {
  switch (quality) {
    case 1:
      return 'normal';
    case 2:
      return 'magic';
    case 3:
      return 'rare';
    case 4:
      return 'set';
    case 5:
      return 'unique';
    case 6:
      return 'crafted';
    default:
      return 'normal';
  }
};

function toDisplayString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\0/g, '').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveFallbackItemName(item: D2SItem): string {
  const candidates = [
    item.name,
    item.unique_name,
    item.set_name,
    item.type_name,
    item.type,
    item.code,
    'unknown',
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return 'unknown';
}

function resolveMagicOrRareDisplayName(item: D2SItem): string | undefined {
  const rareParts = [toDisplayString(item.rare_name), toDisplayString(item.rare_name2)].filter(
    (part): part is string => Boolean(part),
  );
  if (rareParts.length > 0) {
    return rareParts.join(' ');
  }

  const prefix = toDisplayString(item.magic_prefix_name);
  const suffix = toDisplayString(item.magic_suffix_name);
  if (!prefix && !suffix) {
    return undefined;
  }

  const baseName =
    toDisplayString(item.type_name) ??
    toDisplayString(item.name) ??
    toDisplayString(item.type) ??
    toDisplayString(item.code);

  return [prefix, baseName, suffix].filter((part): part is string => Boolean(part)).join(' ');
}

function resolveParsedItemName(item: D2SItem, runewordName: string | null): string {
  const candidates = [
    toDisplayString(runewordName),
    toDisplayString(item.unique_name),
    toDisplayString(item.set_name),
    resolveMagicOrRareDisplayName(item),
    toDisplayString(resolveFallbackItemName(item)),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return 'unknown';
}

function resolveSocketCount(item: D2SItem): number {
  if (Array.isArray(item.gems)) {
    return item.gems.length;
  }

  if (typeof item.socket_count === 'number') {
    return item.socket_count;
  }

  return typeof item.socketed === 'number' ? item.socketed : 0;
}

function resolveParsedItemType(
  item: D2SItem,
  quality: string,
  runewordName: string | null,
): string {
  if (runewordName) {
    return 'runeword';
  }

  if (isRune(item as d2s.types.IItem)) {
    return 'rune';
  }

  if (quality === 'unique' || quality === 'set') {
    return quality;
  }

  return item.type ?? 'other';
}

type ParsedItemSpatialMetadata = Pick<
  ParsedInventoryItem,
  | 'gridX'
  | 'gridY'
  | 'gridWidth'
  | 'gridHeight'
  | 'equippedSlotId'
  | 'iconFileName'
  | 'isSocketedItem'
>;

function resolveParsedItemSpatialMetadata(
  resolvedSpatial: ReturnType<typeof resolveSpatialLocation>,
  isSocketedItem: boolean,
  iconFileName: string | undefined,
): ParsedItemSpatialMetadata {
  return {
    gridX: resolvedSpatial.gridX,
    gridY: resolvedSpatial.gridY,
    gridWidth: resolvedSpatial.gridWidth,
    gridHeight: resolvedSpatial.gridHeight,
    equippedSlotId: resolvedSpatial.equippedSlotId,
    iconFileName,
    isSocketedItem,
  };
}

/**
 * Service for monitoring Diablo 2 save files and extracting item data.
 * This service watches save file directories, parses D2 save files, and maintains
 * a database of found items for Holy Grail tracking.
 */
class SaveFileMonitor {
  private inventorySnapshots: CharacterInventorySnapshot[] = [];
  private fileWatcher: FSWatcher | null;
  private watchPath: string | null;
  private fileChangeCounter: number = 0;
  private lastProcessedChangeCounter: number = 0;
  private readingFiles: boolean;
  private isMonitoring = false;
  private grailDatabase: GrailDatabase | null = null;
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
        ignored: (path, stats) => !!stats?.isFile() && !this.shouldIncludeSaveFile(basename(path)),
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
        const files = allFilesInDir.filter((file) => this.shouldIncludeSaveFile(file));
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
   * @returns {Promise<boolean>} A promise that resolves to true if the directory was readable (even when it holds no save files yet), false otherwise.
   */
  private async parseSaveDirectory(directory: string): Promise<boolean> {
    try {
      const allFilesInDir = readdirSync(directory);

      const files = allFilesInDir.filter((file) => this.shouldIncludeSaveFile(file));

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

  private shouldIncludeSaveFile(fileName: string): boolean {
    const extension = extname(fileName).toLowerCase();
    if (!SUPPORTED_SAVE_EXTENSIONS.has(extension)) {
      return false;
    }

    if (extension !== '.d2i') {
      return true;
    }

    return !this.isBackupLikeStashFile(fileName);
  }

  private isBackupLikeStashFile(fileName: string): boolean {
    const lowerFileName = fileName.toLowerCase();
    if (!lowerFileName.endsWith('.d2i')) {
      return false;
    }

    const stem = lowerFileName.slice(0, -'.d2i'.length);
    return (
      stem.includes('_backup') ||
      stem.endsWith('.bak') ||
      stem.endsWith('_bak') ||
      stem.endsWith('-bak')
    );
  }

  private resolveSharedStashName(
    isHardcore: boolean,
    sourceFileVersion?: number,
  ):
    | 'Shared Stash Hardcore'
    | 'Shared Stash Softcore'
    | 'Modern Shared Stash Hardcore'
    | 'Modern Shared Stash Softcore' {
    const isModern =
      sourceFileVersion !== undefined && sourceFileVersion >= MODERN_STASH_MIN_VERSION;

    if (isModern) {
      return isHardcore ? 'Modern Shared Stash Hardcore' : 'Modern Shared Stash Softcore';
    }

    return isHardcore ? 'Shared Stash Hardcore' : 'Shared Stash Softcore';
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
   * @param {number} [sourceFileVersion] - Optional d2i source file version for modern stash naming.
   * @returns {string} The character/save name.
   */
  private getSaveNameFromPath(
    filePath: string,
    isHardcore?: boolean,
    sourceFileVersion?: number,
  ): string {
    const extension = extname(filePath).toLowerCase();
    let saveName = basename(filePath)
      .replace(/\.d2s/i, '')
      .replace(/\.sss/i, '')
      .replace(/\.d2x/i, '')
      .replace(/\.d2i/i, '');

    // Use friendly names for shared stash files
    if (extension === '.d2i') {
      // Use provided hardcore status if available, otherwise fall back to filename
      const hardcore =
        isHardcore !== undefined ? isHardcore : saveName.toLowerCase().includes('hardcore');
      saveName = this.resolveSharedStashName(hardcore, sourceFileVersion);
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

  private getFingerprintFieldValue<K extends keyof ParsedInventoryItem['fingerprintInputs']>(
    item: ParsedInventoryItem,
    key: K,
  ): ParsedInventoryItem['fingerprintInputs'][K] {
    const itemValue = item[key as keyof ParsedInventoryItem];
    if (itemValue !== undefined) {
      return itemValue as ParsedInventoryItem['fingerprintInputs'][K];
    }

    return item.fingerprintInputs[key];
  }

  private createFingerprint(item: ParsedInventoryItem): string {
    const stashTab = this.getFingerprintFieldValue(item, 'stashTab');
    const gridX = this.getFingerprintFieldValue(item, 'gridX');
    const gridY = this.getFingerprintFieldValue(item, 'gridY');
    const gridWidth = this.getFingerprintFieldValue(item, 'gridWidth');
    const gridHeight = this.getFingerprintFieldValue(item, 'gridHeight');
    const equippedSlotId = this.getFingerprintFieldValue(item, 'equippedSlotId');
    const iconFileName = item.fingerprintInputs.iconFileName ?? item.iconFileName ?? '';
    const isSocketedItem = this.getFingerprintFieldValue(item, 'isSocketedItem') ?? false;
    const itemCode = this.getFingerprintFieldValue(item, 'itemCode') ?? '';
    const itemName = this.getFingerprintFieldValue(item, 'itemName');
    const stash = stashTab !== undefined ? String(stashTab) : '';

    return [
      this.getFingerprintFieldValue(item, 'sourceFileType'),
      this.getFingerprintFieldValue(item, 'characterName'),
      this.getFingerprintFieldValue(item, 'locationContext'),
      itemCode,
      this.getFingerprintFieldValue(item, 'quality'),
      String(this.getFingerprintFieldValue(item, 'ethereal')),
      String(this.getFingerprintFieldValue(item, 'socketCount')),
      stash,
      gridX ?? '',
      gridY ?? '',
      gridWidth ?? '',
      gridHeight ?? '',
      equippedSlotId ?? '',
      iconFileName,
      String(isSocketedItem),
      itemName,
    ].join('|');
  }

  /**
   * Describes an item without its position, location or character, so presence matching can still
   * recognise an item after it moved inside its save (which changes its fingerprint).
   */
  private createPresenceIdentityKey(item: ParsedInventoryItem): string {
    return createVaultPresenceKey({
      sourceFileType: item.sourceFileType,
      itemCode: item.itemCode,
      quality: item.quality,
      ethereal: item.ethereal,
      socketCount: item.socketCount,
      itemName: item.itemName,
      isSocketedItem: item.isSocketedItem,
      itemUid: item.rawParsedItem?.id,
    });
  }

  private createParsedInventoryItem(params: {
    filePath: string;
    saveName: string;
    sourceFileType: VaultSourceFileType;
    item: D2SItem;
    fallbackLocation: VaultLocationContext;
    stashTab?: number;
    stashTabKind?: StashTabKind;
    stackCount?: number;
    isSocketedItem?: boolean;
  }): ParsedInventoryItem {
    const resolvedSpatialLocation = resolveSpatialLocation({
      item: params.item,
      sourceFileType: params.sourceFileType,
      fallbackLocation: params.fallbackLocation,
      fallbackStashTab: params.stashTab,
    });
    const locationContext = resolvedSpatialLocation.locationContext;
    const stashTab = resolvedSpatialLocation.stashTab;
    const quality = mapQualityValue(params.item.quality);
    const runewordName = getValidatedRunewordName(params.item);
    const isSocketedItem = params.isSocketedItem ?? false;
    const itemName = resolveParsedItemName(params.item, runewordName);
    const socketCount = resolveSocketCount(params.item);
    const parsedType = resolveParsedItemType(params.item, quality, runewordName);
    const grailItemId = getGrailItemId(params.item as d2s.types.IItem) ?? undefined;
    const legacyParserIconFileName = normalizeIconFilename(params.item.inv_file);
    const resolvedIconFileName = resolveCanonicalIconFilename({
      grailItemId,
      itemCode: params.item.code ?? params.item.type,
      itemName,
      uniqueName: params.item.unique_name,
      setName: params.item.set_name,
      parsedName: params.item.name,
      typeName: params.item.type_name,
      rawIconFileName: params.item.inv_file,
    });
    const spatialMetadata = resolveParsedItemSpatialMetadata(
      resolvedSpatialLocation,
      isSocketedItem,
      resolvedIconFileName ?? legacyParserIconFileName,
    );

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
        stashTab,
        gridX: spatialMetadata.gridX,
        gridY: spatialMetadata.gridY,
        gridWidth: spatialMetadata.gridWidth,
        gridHeight: spatialMetadata.gridHeight,
        equippedSlotId: spatialMetadata.equippedSlotId,
        iconFileName: legacyParserIconFileName,
        isSocketedItem: spatialMetadata.isSocketedItem,
        itemName,
      },
      characterName: params.saveName,
      sourceFileType: params.sourceFileType,
      sourceFilePath: params.filePath,
      locationContext,
      stashTab,
      stashTabKind: params.stashTabKind,
      ...spatialMetadata,
      itemName,
      itemCode: params.item.code ?? params.item.type ?? undefined,
      quality,
      type: parsedType,
      ethereal: !!params.item.ethereal,
      socketCount,
      stackCount: params.stackCount,
      grailItemId,
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
   * @returns {Promise<SingleFileParseResult>} Parse result with save name, success status and snapshot data.
   */
  private async processSingleFile(
    filePath: string,
    results: FileReaderResponse,
  ): Promise<SingleFileParseResult> {
    let saveName = this.getSaveNameFromPath(filePath);

    try {
      const buffer = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();
      let sourceFileVersion: number | undefined;

      if (extension === '.d2i') {
        try {
          const metadata = readD2iMetadata(buffer);
          sourceFileVersion = metadata.version;
          saveName = this.getSaveNameFromPath(filePath, metadata.hardcore, metadata.version);
        } catch (error) {
          log.warn('processSingleFile', `Failed to read .d2i metadata: ${error}`);
        }
      }

      const { items: inventoryItems, status: parseStatus } = await this.parseSave(
        saveName,
        filePath,
        buffer,
        extension,
      );
      const characterId = this.grailDatabase?.getCharacterByName(saveName)?.id;
      const inventoryItemsWithCharacter = inventoryItems.map((inventoryItem) => ({
        ...inventoryItem,
        characterId,
      }));
      const snapshotItems = inventoryItemsWithCharacter.filter((item) => !item.isSocketedItem);

      results.stats[saveName] = 0;

      for (const inventoryItem of inventoryItemsWithCharacter) {
        const item = inventoryItem.rawParsedItem;
        const name = processItemName(item);

        if (shouldSkipItem(name)) {
          continue;
        }

        const savedItem = createSavedItem(item, inventoryItem.stackCount);
        const isEthereal = !!item.ethereal;
        addItemToResults(results, name, savedItem, saveName, item, isEthereal);

        results.stats[saveName] = (results.stats[saveName] || 0) + 1;
      }

      // Update save file state after successful parsing
      await this.updateSaveFileState(filePath);

      const inventorySnapshot: CharacterInventorySnapshot = {
        snapshotId: `${saveName}-${Date.now()}`,
        characterName: saveName,
        characterId,
        sourceFileType: extension.replace('.', '') as VaultSourceFileType,
        sourceFilePath: filePath,
        sourceFileVersion,
        readOnly: false,
        capturedAt: new Date(),
        items: snapshotItems,
      };

      if (parseStatus !== 'parsed') {
        return { saveName, success: true, parseStatus, inventorySnapshot };
      }

      return {
        saveName,
        success: true,
        parseStatus,
        // Includes socketed items, which the snapshot omits, so vault reconciliation sees every item.
        presentFingerprints: inventoryItemsWithCharacter.map((item) => item.fingerprint),
        presentIdentityKeys: inventoryItemsWithCharacter.map((item) =>
          this.createPresenceIdentityKey(item),
        ),
        inventorySnapshot,
      };
    } catch (error) {
      log.error('processSingleFile', error, { filePath });
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
      const stats = await stat(filePath);

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
    parsedFiles: Array<{ filePath: string; saveName: string }>,
    results: FileReaderResponse,
  ): Promise<void> {
    log.info('emitSaveFileEvents', `Emitting events for ${parsedFiles.length} files`);
    for (const { filePath, saveName } of parsedFiles) {
      try {
        const saveFile = await this.parseSaveFile(filePath);
        if (!saveFile) {
          continue;
        }

        const extractedItems = this.collectExtractedItems(results, saveName);

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

    await this.markOrphanedVaultRowsMissing(filePaths);

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
      this.inventorySnapshots = this.mergeInventorySnapshots(filePaths, [], []);
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
    const successfulParseResults = parseResults
      .map((result, index) => ({ result, filePath: filesToParse[index] }))
      .filter(
        (
          entry,
        ): entry is { result: NonNullable<(typeof parseResults)[number]>; filePath: string } =>
          Boolean(entry.result?.success && entry.result.saveName),
      );

    const failedFiles = parseResults.filter((r) => r && !r.success);
    const successfulSnapshots = parseResults.flatMap((r) =>
      r?.success ? [r.inventorySnapshot] : [],
    );
    this.reconcileVaultPresence(parseResults);
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

    // Update save directory if user requested
    if (userRequested && filePaths.length > 0) {
      const firstDir = dirname(filePaths[0]);
      log.info('parseFiles', `User requested parsing, updating saveDir to: ${firstDir}`);
      this.grailDatabase.setSetting('saveDir', firstDir);
    }

    this.inventorySnapshots = this.mergeInventorySnapshots(
      filePaths,
      filesToParse,
      successfulSnapshots,
    );

    // Emit save file events for each file that was actually parsed
    await this.emitSaveFileEvents(
      successfulParseResults.map((entry) => ({
        filePath: entry.filePath,
        saveName: entry.result.saveName,
      })),
      results,
    );
    log.info('parseFiles', `Complete - processed ${filesToParse.length} files`);
  }

  /**
   * Clears the "present in latest scan" flag of vault rows whose source save file was deleted or
   * renamed. Without this, such rows would stay present forever because only files that are still
   * scanned get reconciled.
   *
   * Only presence flags change (see `markVaultItemsMissingForSourceFiles`). A file counts as gone
   * only when it is not part of this scan and `stat` reports it missing (ENOENT/ENOTDIR) while its
   * directory is still readable; any other error, or an unavailable directory (an unmounted drive,
   * a moved save folder), is treated as unknown and leaves the rows alone. When no save file is
   * found at all the scan aborts earlier and nothing is changed, because that is more likely a
   * misconfigured directory than every file being deleted.
   *
   * Rows that were vaulted out of their file or that share a `#uuid` fingerprint with another row
   * are not special-cased: they are handled like every other row of their file.
   * @private
   */
  private async markOrphanedVaultRowsMissing(scannedFilePaths: string[]): Promise<void> {
    if (!this.grailDatabase) {
      return;
    }

    try {
      const scanned = new Set(scannedFilePaths);
      const candidates = this.grailDatabase
        .getVaultSourceFilePathsPresentInLatestScan()
        .filter((path) => !scanned.has(path));
      const deletedFiles: string[] = [];

      for (const path of candidates) {
        if (await this.isSaveFileDeleted(path)) {
          deletedFiles.push(path);
        }
      }

      if (deletedFiles.length > 0) {
        log.info('markOrphanedVaultRowsMissing', `Source files deleted: ${deletedFiles.length}`);
        this.grailDatabase.markVaultItemsMissingForSourceFiles(deletedFiles);
      }
    } catch (error) {
      log.error('markOrphanedVaultRowsMissing', error);
    }
  }

  /** True only when the file is verifiably absent while its directory can still be read. */
  private async isSaveFileDeleted(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return false;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') {
        return false;
      }
    }

    try {
      return (await stat(dirname(filePath))).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Updates the "present in latest scan" flag of vault rows for every save file that was parsed
   * successfully in this scan.
   *
   * Only parsed files are reconciled (a failed or skipped file keeps its previous flags), and each
   * reconciliation is scoped to that one file, so it can never mark rows from other files as
   * missing. It only touches presence flags: vaulted state and item data are never modified.
   * Errors are logged and swallowed so a database problem cannot break save file scanning.
   *
   * Fingerprints include the character name and item position, so an item that moved inside its
   * file gets a new fingerprint. The database therefore also matches rows by a location-independent
   * identity key (`presentIdentityKeys`), and a moved item stays present. A renamed character is a
   * different file and is not covered.
   * @private
   */
  private reconcileVaultPresence(parseResults: Array<SingleFileParseResult | undefined>): void {
    for (const result of parseResults) {
      // Only a completed parse proves which items are gone. A skipped (game mode), errored or
      // partial parse yields no or only some items, and must not mark vault rows of the file as missing.
      if (result?.success !== true || result.parseStatus !== 'parsed') {
        continue;
      }

      const snapshot = result.inventorySnapshot;
      try {
        this.grailDatabase?.reconcileVaultItemsForScan({
          sourceFileType: snapshot.sourceFileType,
          sourceFilePath: snapshot.sourceFilePath,
          presentFingerprints: result.presentFingerprints,
          presentIdentityKeys: result.presentIdentityKeys,
          lastSeenAt: snapshot.capturedAt,
        });
      } catch (error) {
        log.error('reconcileVaultPresence', error, { filePath: snapshot.sourceFilePath });
      }
    }
  }

  /**
   * Parses a single save file and extracts items from it.
   * @private
   * @param {string} saveName - The name of the save file.
   * @param {Buffer} content - The binary content of the save file.
   * @param {string} extension - The file extension (.d2s, .sss, .d2x, .d2i).
   * @returns A promise that resolves with the extracted items and whether the file was really parsed.
   * A game-mode mismatch or a swallowed parse error yields no items without being a successful
   * scan, so callers (vault reconciliation) must not read "no items" as "every item left the file".
   */
  private async parseSave(
    saveName: string,
    filePath: string,
    content: Buffer,
    extension: string,
  ): Promise<{ items: ParsedInventoryItem[]; status: SaveParseStatus }> {
    const items: ParsedInventoryItem[] = [];

    const sourceFileType = extension.replace('.', '') as VaultSourceFileType;

    const parseItems = (
      itemList: D2SItem[],
      fallbackLocation: VaultLocationContext,
      stashTab?: number,
      stashTabKind?: StashTabKind,
      stackCount?: number,
      isSocketedItem: boolean = false,
    ) => {
      itemList.forEach((item) => {
        items.push(
          this.createParsedInventoryItem({
            filePath,
            saveName,
            sourceFileType,
            item,
            fallbackLocation,
            stashTab,
            stashTabKind,
            stackCount,
            isSocketedItem,
          }),
        );

        if (item.socketed_items?.length) {
          parseItems(
            item.socketed_items,
            fallbackLocation,
            stashTab,
            stashTabKind,
            undefined,
            true,
          );
        }
      });
    };

    // Each parser reports how much of the file it really read, so no shared mutable status is needed.
    const parseD2S = (response: d2s.types.ID2S): SaveParseStatus => {
      if (!this.grailDatabase) {
        return 'skipped';
      }

      const settings = this.grailDatabase.getAllSettings();
      const isHardcore = response.header.status.hardcore;

      if (isGameModeMismatch(settings.gameMode, isHardcore)) {
        return 'skipped';
      }
      const inventoryItems = (response.items || []) as D2SItem[];
      const mercItems = (response.merc_items || []) as D2SItem[];
      const corpseItems = (response.corpse_items || []) as D2SItem[];
      parseItems(inventoryItems, 'inventory');
      parseItems(mercItems, 'mercenary');
      parseItems(corpseItems, 'corpse');
      return 'parsed';
    };

    const parseStash = (response: d2s.types.IStash): SaveParseStatus => {
      if (!this.grailDatabase) {
        return 'skipped';
      }

      const settings = this.grailDatabase.getAllSettings();
      // Use hardcore flag from parsed stash header instead of filename
      const isHardcore = response.hardcore;

      if (isGameModeMismatch(settings.gameMode, isHardcore)) {
        return 'skipped';
      }

      response.pages.forEach((page, pageIndex) => {
        parseItems(page.items as D2SItem[], 'stash', pageIndex);
      });
      return 'parsed';
    };

    const parseModernD2i = async (): Promise<SaveParseStatus> => {
      if (!this.grailDatabase) {
        return 'skipped';
      }

      const modern = await parseModernStash(content);
      const settings = this.grailDatabase.getAllSettings();
      const isHardcore = modern.hardcore;

      if (isGameModeMismatch(settings.gameMode, isHardcore)) {
        return 'skipped';
      }

      modern.items.forEach((entry) => {
        parseItems([entry.item], 'stash', entry.stashTab, entry.stashTabKind, entry.stackCount);
      });
      // A damaged sector leaves its items out: keep what was read, but do not call it a full scan.
      return modern.partial ? 'partial' : 'parsed';
    };

    const parseD2i = async (): Promise<SaveParseStatus> => {
      let d2iVersion: number | undefined;
      try {
        const metadata = readD2iMetadata(content);
        d2iVersion = metadata.version;
        if (metadata.version >= 105) {
          return await parseModernD2i();
        }
        return await d2stash.read(content, constants99).then(parseStash);
      } catch {
        // Only fall back to classic stash parsing for pre-105 format files.
        // Calling d2stash.read on a v105+ .d2i file would fail or produce
        // garbage because the formats are incompatible. A v105+ file cut off inside a
        // sector throws before the metadata version is known, so read it from the header.
        d2iVersion ??= readD2iHeaderVersion(content);
        if (d2iVersion === undefined || d2iVersion < 105) {
          return await d2stash.read(content, constants99).then(parseStash);
        }
        // The swallowed error leaves the item list empty or partial: not a complete scan.
        return 'errored';
      }
    };

    const parseByExtension = (): Promise<SaveParseStatus> => {
      switch (extension) {
        case '.sss':
        case '.d2x':
          return d2stash.read(content, constants96).then(parseStash);
        case '.d2i':
          return parseD2i();
        default:
          return d2s.read(content).then(parseD2S);
      }
    };

    const status = await parseByExtension();
    return { items, status };
  }

  /**
   * Parses a save file to extract basic character information.
   * @private
   * @param {string} filePath - The path to the save file.
   * @returns {Promise<D2SaveFile | null>} A promise that resolves with the parsed save file data or null if parsing fails.
   */
  private async parseSaveFile(filePath: string): Promise<D2SaveFile | null> {
    try {
      const stats = await stat(filePath);
      const buffer = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();

      // Handle shared stash files (.d2i)
      if (extension === '.d2i') {
        let isHardcore = false;
        let sourceFileVersion: number | undefined;
        try {
          const metadata = readD2iMetadata(buffer);
          isHardcore = metadata.hardcore;
          sourceFileVersion = metadata.version;
          log.info(
            'parseSaveFile',
            `Parsed .d2i metadata, hardcore: ${isHardcore}, version: ${sourceFileVersion}`,
          );
        } catch (_parseError) {
          log.warn('parseSaveFile', 'Failed to parse .d2i metadata, falling back to filename');
          // Fallback to filename if parsing fails
          isHardcore = basename(filePath).toLowerCase().includes('hardcore');
        }

        const characterName = this.getSaveNameFromPath(filePath, isHardcore, sourceFileVersion);

        return {
          name: characterName,
          path: filePath,
          lastModified: stats.mtime,
          characterClass: 'shared_stash',
          level: 1,
          hardcore: isHardcore,
          expansion: true,
          sourceFileVersion,
        };
      }

      // Legacy shared stash files (.sss/.d2x) have no character header: reading one as a .d2s would
      // produce an invalid character class that the characters table rejects.
      if (extension === '.sss' || extension === '.d2x') {
        let isHardcore = basename(filePath).toLowerCase().includes('hardcore');
        try {
          isHardcore = (await d2stash.read(buffer, constants96)).hardcore;
        } catch (_parseError) {
          log.warn(
            'parseSaveFile',
            'Failed to parse legacy stash header, falling back to filename',
          );
        }

        return {
          name: this.getSaveNameFromPath(filePath),
          path: filePath,
          lastModified: stats.mtime,
          characterClass: 'shared_stash',
          level: 1,
          hardcore: isHardcore,
          expansion: true,
        };
      }

      // Basic D2 save file parsing (simplified)
      // Strip the extension case-insensitively (e.g. Hero.D2S), matching getSaveNameFromPath
      const fileName =
        extension === '.d2s' ? basename(filePath, extname(filePath)) : basename(filePath);

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
      await this.initializeSaveDirectories();

      // Always start monitoring after directory change - user explicitly wants to use this directory
      log.info('updateSaveDirectory', 'Starting monitoring for new directory');
      await this.startMonitoring();
    } finally {
      this.forceParseAll = false;
    }

    log.info('updateSaveDirectory', 'Complete');
  }

  getInventorySearchResult(): InventorySearchResult {
    return {
      snapshots: this.inventorySnapshots,
      totalSnapshots: this.inventorySnapshots.length,
      totalItems: this.inventorySnapshots.reduce((sum, snapshot) => sum + snapshot.items.length, 0),
    };
  }

  private mergeInventorySnapshots(
    allFilePaths: string[],
    parsedFilePaths: string[],
    successfulSnapshots: CharacterInventorySnapshot[],
  ): CharacterInventorySnapshot[] {
    const knownFilePathSet = new Set(allFilePaths);
    const parsedFilePathSet = new Set(parsedFilePaths);
    const successfulSnapshotKeySet = new Set(
      successfulSnapshots.map(
        (snapshot) => `${snapshot.sourceFileType}:${snapshot.sourceFilePath}`,
      ),
    );
    const mergedByKey = new Map<string, CharacterInventorySnapshot>();

    for (const snapshot of this.inventorySnapshots) {
      if (!knownFilePathSet.has(snapshot.sourceFilePath)) {
        continue;
      }

      const snapshotKey = `${snapshot.sourceFileType}:${snapshot.sourceFilePath}`;
      if (
        parsedFilePathSet.has(snapshot.sourceFilePath) &&
        successfulSnapshotKeySet.has(snapshotKey)
      ) {
        continue;
      }

      mergedByKey.set(snapshotKey, snapshot);
    }

    for (const snapshot of successfulSnapshots) {
      mergedByKey.set(`${snapshot.sourceFileType}:${snapshot.sourceFilePath}`, snapshot);
    }

    return [...mergedByKey.values()];
  }

  /**
   * Gets the count of each available rune across the latest inventory snapshot of every save file.
   * Stacked runes count with their stack size. Runes socketed into another item are used up and
   * therefore not available for runewords.
   * @returns {Record<string, number>} A record mapping rune IDs to their counts.
   */
  getAvailableRunesCount(): Record<string, number> {
    const runeCounts: Record<string, number> = {};

    for (const snapshot of this.inventorySnapshots) {
      for (const item of snapshot.items) {
        const rawItem = item.rawParsedItem;
        if (item.isSocketedItem || rawItem.socketed || !isRune(rawItem)) {
          continue;
        }

        const runeId = processItemName(rawItem);
        if (shouldSkipItem(runeId)) {
          continue;
        }

        runeCounts[runeId] = (runeCounts[runeId] ?? 0) + (item.stackCount ?? 1);
      }
    }

    return runeCounts;
  }

  /**
   * Triggers a manual refresh/rescan of all save files.
   * This forces a re-parse of all save files to get the latest item data.
   * Resolves once the forced parse finished, or once it was skipped (manual game mode, no save
   * files, no database, monitoring stopped); rejects if the parse itself failed.
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
      this.skipPendingForcedParse('no grail database');
      return;
    }

    const settings = this.grailDatabase.getAllSettings();

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

    // Check if enough time has passed since last file change (debouncing)
    // Skip debounce for initial parsing or force parse
    const timeSinceLastChange = Date.now() - this.lastFileChangeTime;
    const shouldDebounce = !this.isInitialParsing && !hasForcedParseRequest;
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
  };

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
    this.skipPendingForcedParse('monitor shut down');
    await this.stopMonitoring();
    log.info('shutdown', 'Shutdown complete');
  }
}

export { SaveFileMonitor };
export type { D2SaveFile, SaveFileEvent };
