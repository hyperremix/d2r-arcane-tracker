import { EventEmitter } from 'node:events';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import chokidar, { type FSWatcher } from 'chokidar';
import { app } from 'electron';
import type { GrailDatabase } from '../database/database';
import { getHolyGrailSeedData, runesSeed } from '../items/grail';
import { runesMapping } from '../items/runes';
import {
  type AvailableRunes,
  type D2SaveFile,
  type FileReaderResponse,
  type FlatItemsMap,
  GameMode,
  type Item,
  type ItemDetails,
  type ItemWithMagicAttributes,
  type MagicAttribute,
  type RuneType,
  type SaveFileEvent,
} from '../types/grail';
import {
  buildFlattenObjectCacheKey,
  flattenObject,
  isRune,
  simplifyItemName,
} from '../utils/objects';

// Lookup table for magic attribute types
const MAGIC_ATTRIBUTE_TYPES: { [key: string]: string } = {
  item_skillondeath: 'death',
  item_skillonlevelup: 'levelup',
};

// Lookup table for magic attribute skills
const MAGIC_ATTRIBUTE_SKILLS: { [key: string]: string } = {
  passive_cold_mastery: 'cold',
  passive_pois_mastery: 'poison',
  passive_fire_mastery: 'fire',
  passive_ltng_mastery: 'lightning',
};

// Helper function to process rainbow facet attributes
const processRainbowFacetAttributes = (
  magicAttributes: MagicAttribute[],
): { type: string; skill: string } => {
  let type = '';
  let skill = '';

  for (const attr of magicAttributes) {
    if (MAGIC_ATTRIBUTE_TYPES[attr.name]) {
      type = MAGIC_ATTRIBUTE_TYPES[attr.name];
    }
    if (MAGIC_ATTRIBUTE_SKILLS[attr.name]) {
      skill = MAGIC_ATTRIBUTE_SKILLS[attr.name];
    }
  }

  return { type, skill };
};

// Helper function to determine item name
const processItemName = (item: d2s.types.IItem): string => {
  let name = item.unique_name || item.set_name || item.rare_name || item.rare_name2 || '';
  name = name.toLowerCase().replace(/[^a-z0-9]/gi, '');

  if (name.indexOf('rainbowfacet') !== -1) {
    const magicAttributes = (item as unknown as ItemWithMagicAttributes).magic_attributes || [];
    const { type, skill } = processRainbowFacetAttributes(magicAttributes);
    return name + skill + type;
  }

  if (isRune(item)) {
    return runesMapping[item.type as RuneType].name.toLowerCase();
  }

  if (item.type === 'runeword') {
    return item.runeword_name;
  }

  return name;
};

// Helper function to check if item should be skipped
const shouldSkipItem = (
  name: string,
  item: d2s.types.IItem,
  flatItems: FlatItemsMap,
  ethFlatItems: FlatItemsMap,
): boolean => {
  if (!flatItems[name] && item.ethereal && !ethFlatItems[name]) {
    return true;
  }
  if (name === '') {
    return true;
  }
  return false;
};

// Helper function to create saved item details
const createSavedItem = (item: d2s.types.IItem): ItemDetails => {
  return {
    ethereal: !!item.ethereal,
    ilevel: item.level,
    socketed: !!item.socketed,
  };
};

// Helper function to add item to results
const addItemToResults = (
  results: FileReaderResponse,
  name: string,
  savedItem: ItemDetails,
  saveName: string,
  item: d2s.types.IItem,
): void => {
  const key: 'items' | 'ethItems' = 'items';

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

// Helper function to add rune to available runes
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

// Helper function to check if item should be included in parsing
const shouldIncludeItem = (item: d2s.types.IItem): boolean => {
  return !!(item.unique_name || item.set_name || item.rare_name || item.rare_name2);
};

// Helper function to process unique or set items
const processUniqueOrSetItem = (item: d2s.types.IItem, items: d2s.types.IItem[]): void => {
  items.push(item);
};

// Helper function to process rune items
const processRuneItem = (
  item: d2s.types.IItem,
  items: d2s.types.IItem[],
  isEmbed: boolean,
): void => {
  if (isRune(item) && runesMapping[item.type as RuneType]) {
    if (isEmbed) {
      item.socketed = 1; // the "socketed" in Rune item types will indicated that *it* sits inside socket
    }
    items.push(item);
  }
};

// Helper function to process runeword items
const processRunewordItem = (item: d2s.types.IItem, items: d2s.types.IItem[]): void => {
  if (item.runeword_name) {
    // super funny bug in d2s parser :D
    if (item.runeword_name === 'Love') {
      item.runeword_name = 'Lore';
    }
    // we push Runewords as "items" for easier displaying in a list
    const newItem = {
      runeword_name: `runeword${simplifyItemName(item.runeword_name)}`,
      type: 'runeword',
    } as d2s.types.IItem;
    items.push(newItem);
  }
};

class SaveFileMonitor extends EventEmitter {
  private currentData: FileReaderResponse;
  private fileWatcher: FSWatcher | null;
  private watchPath: string | null;
  private filesChanged: boolean;
  private readingFiles: boolean;
  private isMonitoring = false;
  private grailDatabase: GrailDatabase | null = null;
  private saveDirectory: string | null = null;

  constructor(grailDatabase?: GrailDatabase) {
    super();
    this.grailDatabase = grailDatabase || null;
    this.currentData = {
      items: {},
      ethItems: {},
      stats: {},
      availableRunes: {},
    };
    this.fileWatcher = null;
    this.watchPath = null;
    this.filesChanged = false;
    this.readingFiles = false;

    // Initialize D2S constants
    this.initializeD2SConstants();

    // Initialize save directories
    this.initializeSaveDirectories();

    // Start the tick reader for automatic file change detection
    setInterval(this.tickReader, 500);
  }

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

  private async initializeSaveDirectories(): Promise<void> {
    // First, try to get saveDir from Settings via grail database
    let customSaveDir: string | null = null;
    if (this.grailDatabase) {
      try {
        const settings = this.grailDatabase.getAllSettings();
        if (settings.saveDir && settings.saveDir.trim() !== '') {
          customSaveDir = settings.saveDir.trim();
        }
      } catch (error) {
        console.warn('Failed to read saveDir from settings:', error);
      }
    }

    // Use custom saveDir if available, otherwise fall back to platform default
    if (customSaveDir) {
      this.saveDirectory = customSaveDir;
    } else {
      this.saveDirectory = this.getPlatformDefaultDirectory();
    }
  }

  private getPlatformDefaultDirectory(): string {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows save location - use the most common one
      return join(app.getPath('documents'), 'Diablo II Resurrected');
    } else if (platform === 'darwin') {
      // macOS save location - use the most common one
      return join(
        app.getPath('home'),
        'Library',
        'Application Support',
        'Blizzard Entertainment',
        'Diablo II Resurrected',
      );
    } else {
      // Linux (through Wine/Proton) - use the most common one
      return join(
        app.getPath('home'),
        '.wine',
        'drive_c',
        'users',
        process.env.USER || 'user',
        'Saved Games',
        'Diablo II Resurrected',
      );
    }
  }

  // Public method to get the platform default directory
  getDefaultDirectory(): string {
    return this.getPlatformDefaultDirectory();
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    // Refresh save directory from settings
    await this.initializeSaveDirectories();

    if (!this.saveDirectory) {
      console.warn('No save directory configured');
      this.emit('monitoring-error', {
        type: 'no-directory',
        message: 'No save directory configured',
        directory: null,
      });
      return;
    }

    // Check if directory exists
    if (!existsSync(this.saveDirectory)) {
      console.warn(`Save directory does not exist: ${this.saveDirectory}`);
      this.emit('monitoring-error', {
        type: 'directory-not-found',
        message: `Save directory does not exist: ${this.saveDirectory}`,
        directory: this.saveDirectory,
      });
      return;
    }

    // Start file parsing to get initial data and file count
    const parsedSuccessfully = await this.parseSaveDirectory(this.saveDirectory);

    if (!parsedSuccessfully) {
      return; // Error was already emitted
    }

    // Set up file watching
    this.watchPath = this.saveDirectory;
    this.fileWatcher = chokidar
      .watch(this.prepareChokidarGlobe(this.saveDirectory), {
        followSymlinks: false,
        ignoreInitial: true,
        depth: 0,
      })
      .on('all', () => {
        this.filesChanged = true;
      })
      .on('error', (error) => console.error('Save file watcher error:', error));

    this.isMonitoring = true;

    // Count save files for status reporting
    const saveFiles = await this.getSaveFiles();

    this.emit('monitoring-started', {
      directory: this.saveDirectory,
      saveFileCount: saveFiles.length,
    });

    console.log(
      `Save file monitoring started for directory: ${this.saveDirectory} - Found ${saveFiles.length} save files`,
    );
  }

  async stopMonitoring(): Promise<void> {
    if (this.fileWatcher) {
      await this.fileWatcher.close();
      this.fileWatcher = null;
    }
    this.watchPath = null;
    this.isMonitoring = false;
    this.emit('monitoring-stopped');
  }

  private async findExistingSaveDirectories(): Promise<string[]> {
    const existingDirs: string[] = [];

    if (this.saveDirectory) {
      const dir = this.saveDirectory;
      try {
        if (existsSync(dir)) {
          existingDirs.push(dir);
        }
      } catch {
        // Directory doesn't exist, skip it
      }
    }

    return existingDirs;
  }

  private async parseAllSaveDirectories(directories: string[]): Promise<boolean> {
    const allFiles: string[] = [];

    // Collect all save files from all directories
    for (const dir of directories) {
      try {
        const files = readdirSync(dir).filter(
          (file) => ['.d2s', '.sss', '.d2x', '.d2i'].indexOf(extname(file).toLowerCase()) !== -1,
        );
        allFiles.push(...files.map((file) => join(dir, file)));
      } catch (error) {
        console.error(`Error reading save directory ${dir}:`, error);
      }
    }

    if (allFiles.length === 0) {
      console.warn('No D2R save files found in directories:', directories);
      this.emit('monitoring-error', {
        type: 'no-save-files',
        message: `No D2R save files found in monitored directories`,
        directories: directories,
        saveFileCount: 0,
      });
      return false;
    }

    // Parse all files and update current data
    await this.parseFiles(allFiles, false);
    return true;
  }

  private async parseSaveDirectory(directory: string): Promise<boolean> {
    try {
      const files = readdirSync(directory).filter(
        (file) => ['.d2s', '.sss', '.d2x', '.d2i'].indexOf(extname(file).toLowerCase()) !== -1,
      );
      const allFiles = files.map((file) => join(directory, file));

      if (allFiles.length === 0) {
        console.warn(`No D2R save files found in directory: ${directory}`);
        this.emit('monitoring-error', {
          type: 'no-save-files',
          message: `No D2R save files found in monitored directory`,
          directory: directory,
          saveFileCount: 0,
        });
        return false;
      }

      // Parse all files and update current data
      await this.parseFiles(allFiles, false);
      return true;
    } catch (error) {
      console.error(`Error reading save directory ${directory}:`, error);
      this.emit('monitoring-error', {
        type: 'directory-read-error',
        message: `Error reading save directory: ${error}`,
        directory: directory,
        saveFileCount: 0,
      });
      return false;
    }
  }

  private prepareChokidarGlobe(filename: string): string {
    if (filename.length < 2) {
      return filename;
    }
    const resolved = resolve(filename);
    return `${resolved.substring(0, 1) + resolved.substring(1).split(sep).join('/')}/*.{d2s,sss,d2x,d2i}`;
  }

  private async parseFiles(filePaths: string[], userRequested: boolean): Promise<void> {
    const results: FileReaderResponse = {
      items: {},
      ethItems: {},
      stats: {},
      availableRunes: {},
    };

    if (!this.grailDatabase) {
      console.warn('No grail database available for parsing');
      return;
    }

    // Prepare item list
    const settings = this.grailDatabase.getAllSettings();
    const flatItems = flattenObject(
      getHolyGrailSeedData(false),
      buildFlattenObjectCacheKey('all', settings),
    );
    const ethFlatItems = flattenObject(getHolyGrailSeedData(true), 'ethall');
    const erroringSaves: string[] = [];

    const promises = filePaths.map((filePath) => {
      const saveName = basename(filePath)
        .replace('.d2s', '')
        .replace('.sss', '')
        .replace('.d2x', '')
        .replace('.d2i', '');
      return readFile(filePath)
        .then((buffer) => this.parseSave(saveName, buffer, extname(filePath).toLowerCase()))
        .then((result) => {
          results.stats[saveName] = 0;
          result.forEach((item) => {
            const name = processItemName(item);

            if (shouldSkipItem(name, item, flatItems, ethFlatItems)) {
              return;
            }

            const savedItem = createSavedItem(item);
            addItemToResults(results, name, savedItem, saveName, item);

            if (isRune(item) && !item.socketed) {
              addRuneToAvailableRunes(results, name, savedItem, saveName, item);
            }

            results.stats[saveName] = (results.stats[saveName] || 0) + 1;
          });
        })
        .catch((e) => {
          console.log('ERROR parsing save file:', e);
          erroringSaves.push(saveName);
          results.stats[saveName] = null;
        });
    });

    await Promise.all(promises);

    // Update save directory if user requested
    if (userRequested && filePaths.length > 0) {
      const firstDir = dirname(filePaths[0]);
      this.grailDatabase.setSetting('saveDir', firstDir);
    }

    // Update current data
    this.currentData = results;

    // Emit save file events for each found save file
    for (const filePath of filePaths) {
      try {
        const saveFile = await this.parseSaveFile(filePath);
        if (saveFile) {
          this.emit('save-file-event', {
            type: 'modified',
            file: saveFile,
          } as SaveFileEvent);
        }
      } catch (error) {
        console.error('Error creating save file event:', error);
      }
    }
  }

  private async parseSave(
    saveName: string,
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
      if (!this.grailDatabase) return [];

      const settings = this.grailDatabase.getAllSettings();
      if (settings.gameMode === GameMode.Softcore && response.header.status.hardcore) {
        return [];
      }
      if (settings.gameMode === GameMode.Hardcore && !response.header.status.hardcore) {
        return [];
      }
      const items = response.items || [];
      const mercItems = response.merc_items || [];
      const corpseItems = response.corpse_items || [];
      const itemList = [...items, ...mercItems, ...corpseItems];
      parseItems(itemList);
    };

    const parseStash = (response: d2s.types.IStash) => {
      if (!this.grailDatabase) return [];

      const settings = this.grailDatabase.getAllSettings();
      if (settings.gameMode === GameMode.Softcore && saveName.toLowerCase().includes('hardcore')) {
        return [];
      }
      if (settings.gameMode === GameMode.Hardcore && saveName.toLowerCase().includes('softcore')) {
        return [];
      }
      response.pages.forEach((page) => {
        parseItems(page.items);
      });
    };

    switch (extension) {
      case '.sss':
      case '.d2x':
        await d2stash.read(content).then((response) => {
          response.hardcore === saveName.toLowerCase().includes('hardcore');
          parseStash(response);
        });
        break;
      case '.d2i':
        await d2stash.read(content).then(parseStash);
        break;
      default:
        await d2s.read(content).then(parseD2S);
    }
    return items;
  }

  private async parseSaveFile(filePath: string): Promise<D2SaveFile | null> {
    try {
      const stats = await import('node:fs/promises').then((fs) => fs.stat(filePath));
      const buffer = await readFile(filePath);

      // Basic D2 save file parsing (simplified)
      const fileName = basename(filePath, '.d2s');

      // Character name is typically the filename
      const characterName = fileName;
      let characterClass = 'unknown';
      let level = 1;
      let difficulty: 'normal' | 'nightmare' | 'hell' = 'normal';
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

        // Difficulty completion flags at offset 168
        const difficultyFlags = buffer.readUInt8(168);
        if (difficultyFlags & 0x80) difficulty = 'hell';
        else if (difficultyFlags & 0x40) difficulty = 'nightmare';
        else difficulty = 'normal';
      }

      return {
        name: characterName,
        path: filePath,
        lastModified: stats.mtime,
        characterClass,
        level,
        difficulty,
        hardcore,
        expansion,
      };
    } catch (error) {
      console.error('Error parsing save file:', error);
      return null;
    }
  }

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

  async getSaveFiles(): Promise<D2SaveFile[]> {
    const saveFiles: D2SaveFile[] = [];

    if (!this.saveDirectory) {
      return saveFiles;
    }

    try {
      const files = readdirSync(this.saveDirectory);
      for (const file of files) {
        if (file.endsWith('.d2s')) {
          const filePath = join(this.saveDirectory, file);
          const saveFile = await this.parseSaveFile(filePath);
          if (saveFile) {
            saveFiles.push(saveFile);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading save directory ${this.saveDirectory}:`, error);
    }

    return saveFiles;
  }

  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  getSaveDirectory(): string | null {
    return this.saveDirectory;
  }

  async updateSaveDirectory(): Promise<void> {
    // Update the save directory and restart monitoring if active
    const wasMonitoring = this.isMonitoring;

    if (wasMonitoring) {
      await this.stopMonitoring();
    }

    // Re-initialize directories with the new setting
    await this.initializeSaveDirectories();

    if (wasMonitoring) {
      await this.startMonitoring();
    }
  }

  getItems(): FileReaderResponse {
    return this.currentData;
  }

  fillInAvailableRunes(): void {
    // filling in all the runes into the "available runes"
    this.currentData.availableRunes = Object.keys(this.currentData.items).reduce(
      (acc: AvailableRunes, itemKey: string) => {
        const item = this.currentData.items[itemKey];
        if (runesSeed[itemKey]) {
          acc[itemKey] = item;
        }
        return acc;
      },
      {} as AvailableRunes,
    );
  }

  createManualItem(count: number): Item {
    return {
      inSaves: {
        'Manual entry': new Array(count).fill({} as ItemDetails),
      },
      name: '',
      type: '',
    };
  }

  private tickReader = async (): Promise<void> => {
    if (!this.grailDatabase) return;

    const settings = this.grailDatabase.getAllSettings();
    if (
      this.watchPath &&
      this.filesChanged &&
      !this.readingFiles &&
      settings.gameMode !== GameMode.Manual
    ) {
      console.log('re-reading files!');
      this.readingFiles = true;
      this.filesChanged = false;

      const directories = await this.findExistingSaveDirectories();
      await this.parseAllSaveDirectories(directories);

      this.readingFiles = false;
    }
  };

  async shutdown(): Promise<void> {
    await this.stopMonitoring();
  }
}

export { SaveFileMonitor };
export type { D2SaveFile, SaveFileEvent };
