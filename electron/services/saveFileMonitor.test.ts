/** biome-ignore-all lint/suspicious/noExplicitAny: This file is testing private methods */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the d2s library. Keep the real remaining exports (e.g. enhanceItems): with isolate:false,
// modernStashParser is cached with this mock and reused by modernStashParser.test.ts.
vi.mock('@dschu012/d2s', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dschu012/d2s')>();
  return {
    ...actual,
    read: vi.fn(),
    getConstantData: vi.fn(),
    setConstantData: vi.fn(),
  };
});

vi.mock('@dschu012/d2s/lib/d2/stash', () => ({
  read: vi.fn(),
}));

// Mock fs modules
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(),
    stat: vi.fn(),
  };
});

// Mock chokidar
vi.mock('chokidar', () => ({
  default: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    close: vi.fn(),
  })),
}));

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
  },
}));

// Mock items indexes
vi.mock('../items/indexes', () => ({
  runewordsByNameSimple: {
    lore: { id: 'lore', name: 'Lore' },
    enigma: { id: 'enigma', name: 'Enigma' },
    beast: { id: 'beast', name: 'Beast' },
    infinity: { id: 'infinity', name: 'Infinity' },
  },
}));

// Mock utils
vi.mock('../utils/objects', () => ({
  isRune: vi.fn(),
  simplifyItemName: vi.fn(),
}));

vi.mock('../utils/grailItemUtils', () => ({
  getGrailItemId: vi.fn(),
}));

import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import chokidar from 'chokidar';
import { app } from 'electron';
import { D2SaveFileBuilder } from '@/fixtures';
import { GameMode } from '../types/grail';
import { getGrailItemId } from '../utils/grailItemUtils';
import { isRune, simplifyItemName } from '../utils/objects';
import { EventBus } from './EventBus';
import * as modernStashParser from './modernStashParser';
import { SaveFileMonitor } from './saveFileMonitor';

const MODERN_STASH_FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
);

// Mock database interface
interface MockGrailDatabase {
  getAllSettings: ReturnType<typeof vi.fn>;
  setSetting: ReturnType<typeof vi.fn>;
  getSaveFileState: ReturnType<typeof vi.fn>;
  upsertSaveFileState: ReturnType<typeof vi.fn>;
  getCharacterByName: ReturnType<typeof vi.fn>;
  getAllSaveFileStates: ReturnType<typeof vi.fn>;
  deleteSaveFileState: ReturnType<typeof vi.fn>;
  reconcileVaultItemsForScan: ReturnType<typeof vi.fn>;
  getVaultSourceFilePathsPresentInLatestScan: ReturnType<typeof vi.fn>;
  markVaultItemsMissingForSourceFiles: ReturnType<typeof vi.fn>;
}

const createMockDatabase = (): MockGrailDatabase => ({
  getAllSettings: vi.fn(),
  setSetting: vi.fn(),
  getSaveFileState: vi.fn(),
  upsertSaveFileState: vi.fn(),
  getCharacterByName: vi.fn(),
  getAllSaveFileStates: vi.fn(),
  deleteSaveFileState: vi.fn(),
  reconcileVaultItemsForScan: vi.fn(),
  getVaultSourceFilePathsPresentInLatestScan: vi.fn(() => []),
  markVaultItemsMissingForSourceFiles: vi.fn(),
});

describe('When SaveFileMonitor is used', () => {
  let monitor: SaveFileMonitor;
  let mockDatabase: MockGrailDatabase;
  let eventBus: EventBus;
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['test.d2s', 'test2.d2s'] as any);
    vi.mocked(readFile).mockResolvedValue(Buffer.from('mock file content'));
    vi.mocked(stat).mockResolvedValue({
      mtime: new Date('2024-01-01'),
    } as any);
    vi.mocked(app.getPath).mockImplementation((path) => {
      if (path === 'documents') return '/Users/test/Documents';
      if (path === 'home') return '/Users/test';
      return '/mock/path';
    });
    vi.mocked(d2s.getConstantData).mockImplementation(() => {
      throw new Error('Not found');
    });
    vi.mocked(d2s.setConstantData).mockImplementation(() => {
      // Do nothing
    });
    vi.mocked(d2s.read).mockResolvedValue({
      header: {
        status: {
          hardcore: false,
        },
      },
      items: [],
      merc_items: [],
      corpse_items: [],
    } as any);
    vi.mocked(d2stash.read).mockResolvedValue({
      hardcore: false,
      pages: [{ items: [] }],
    } as any);
    vi.mocked(getGrailItemId).mockReturnValue('test-item-id');
    vi.mocked(isRune).mockReturnValue(false);
    vi.mocked(simplifyItemName).mockReturnValue('test-item');

    // Create mock database
    mockDatabase = createMockDatabase();
    vi.mocked(mockDatabase.getAllSettings).mockReturnValue({
      saveDir: '/test/save/dir',
      gameMode: GameMode.Softcore,
    });

    // Create EventBus instance
    eventBus = new EventBus();

    // Create monitor instance with EventBus
    monitor = new SaveFileMonitor(eventBus, mockDatabase as any);
  });

  describe('If constructor is called', () => {
    it('Then should initialize with default values', () => {
      // Arrange
      const testEventBus = new EventBus();

      // Act
      const newMonitor = new SaveFileMonitor(testEventBus);

      // Assert
      expect(newMonitor).toBeInstanceOf(SaveFileMonitor);
      expect(newMonitor.isCurrentlyMonitoring()).toBe(false);
      // The save directory will be initialized to the platform default
      expect(newMonitor.getSaveDirectory()).toBeTruthy();
    });

    it('Then should initialize with database', () => {
      // Arrange
      const testEventBus = new EventBus();

      // Act
      const newMonitor = new SaveFileMonitor(testEventBus, mockDatabase as any);

      // Assert
      expect(newMonitor).toBeInstanceOf(SaveFileMonitor);
      expect(newMonitor.isCurrentlyMonitoring()).toBe(false);
    });

    it('Then should initialize D2S constants', () => {
      // Assert
      expect(d2s.getConstantData).toHaveBeenCalledWith(96);
      expect(d2s.getConstantData).toHaveBeenCalledWith(97);
      expect(d2s.getConstantData).toHaveBeenCalledWith(98);
      expect(d2s.getConstantData).toHaveBeenCalledWith(99);
      expect(d2s.getConstantData).toHaveBeenCalledWith(0);
      expect(d2s.getConstantData).toHaveBeenCalledWith(1);
      expect(d2s.getConstantData).toHaveBeenCalledWith(2);
    });
  });

  describe('If getDefaultDirectory is called', () => {
    it('Then should return', () => {
      // Arrange
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.mocked(app.getPath).mockReturnValue('C:\\Users\\test\\Documents');

      // Act
      const path = monitor.getDefaultDirectory();

      // Assert
      expect(path).toContain('Diablo II Resurrected');
      expect(app.getPath).toHaveBeenCalledWith('home');
    });
  });

  describe('If startMonitoring is called', () => {
    it('Then should emit error when directory does not exist', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);

      const eventSpy = vi.fn();
      eventBus.on('monitoring-error', eventSpy);

      // Act
      await monitor.startMonitoring();

      // Assert
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith({
        type: 'directory-not-found',
        message: 'Save directory does not exist: /test/save/dir',
        directory: '/test/save/dir',
      });
    });

    it('Then should watch an existing directory that has no save files yet', async () => {
      // Arrange
      const emptyDir = await mkdtemp(join(tmpdir(), 'arcane-empty-'));
      tempDirs.push(emptyDir);
      vi.mocked(mockDatabase.getAllSettings).mockReturnValue({
        saveDir: emptyDir,
        gameMode: GameMode.Softcore,
      });
      const watchSpy = vi.fn(() => ({ on: vi.fn().mockReturnThis(), close: vi.fn() }));
      (chokidar as any).watch = watchSpy;
      const startedSpy = vi.fn();
      eventBus.on('monitoring-started', startedSpy);

      // Act
      await monitor.startMonitoring();

      // Assert
      expect(watchSpy).toHaveBeenCalledTimes(1);
      expect(monitor.isCurrentlyMonitoring()).toBe(true);
      expect(startedSpy).toHaveBeenCalledWith(expect.objectContaining({ saveFileCount: 0 }));
    });

    it('Then should not watch a directory that cannot be read', async () => {
      // Arrange
      // A regular file used as the save directory exists but cannot be listed (readdir throws).
      const unreadableDir = await mkdtemp(join(tmpdir(), 'arcane-unreadable-'));
      tempDirs.push(unreadableDir);
      const notADirectory = join(unreadableDir, 'not-a-directory');
      await writeFile(notADirectory, 'content');
      vi.mocked(mockDatabase.getAllSettings).mockReturnValue({
        saveDir: notADirectory,
        gameMode: GameMode.Softcore,
      });
      const watchSpy = vi.fn();
      (chokidar as any).watch = watchSpy;
      const errorSpy = vi.fn();
      eventBus.on('monitoring-error', errorSpy);

      // Act
      await monitor.startMonitoring();

      // Assert
      expect(watchSpy).not.toHaveBeenCalled();
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'directory-read-error',
          directory: notADirectory,
        }),
      );
    });

    it('Then should not watch a directory that does not exist', async () => {
      // Arrange
      const missingDir = join(tmpdir(), 'arcane-missing-dir-that-does-not-exist');
      vi.mocked(mockDatabase.getAllSettings).mockReturnValue({
        saveDir: missingDir,
        gameMode: GameMode.Softcore,
      });
      const watchSpy = vi.fn();
      (chokidar as any).watch = watchSpy;

      // Act
      await monitor.startMonitoring();

      // Assert
      expect(watchSpy).not.toHaveBeenCalled();
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
    });

    it('Then should not start monitoring if already monitoring', async () => {
      // Arrange
      // Mock the monitor to think it's already monitoring
      (monitor as any).isMonitoring = true;

      const eventSpy = vi.fn();
      eventBus.on('monitoring-started', eventSpy);

      // Act
      await monitor.startMonitoring();

      // Assert
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('If stopMonitoring is called', () => {
    it('Then should stop monitoring and emit event', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['test.d2s'] as any);
      await monitor.startMonitoring();

      const eventSpy = vi.fn();
      eventBus.on('monitoring-stopped', eventSpy);

      // Act
      await monitor.stopMonitoring();

      // Assert
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('Then should handle stopping when not monitoring', async () => {
      // Act & Assert
      await expect(monitor.stopMonitoring()).resolves.not.toThrow();
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
    });
  });

  describe('If getSaveFiles is called', () => {
    it('Then should return empty array when no save directory', async () => {
      // Arrange
      const testEventBus = new EventBus();
      const newMonitor = new SaveFileMonitor(testEventBus);

      // Act
      const files = await newMonitor.getSaveFiles();

      // Assert
      expect(files).toEqual([]);
    });

    it('Then should include .d2s files regardless of extension case', async () => {
      // Arrange
      const saveDir = await mkdtemp(join(tmpdir(), 'arcane-saves-'));
      tempDirs.push(saveDir);
      await Promise.all(
        ['Hero.D2S', 'Other.d2s', 'notes.txt'].map((name) =>
          writeFile(join(saveDir, name), 'content'),
        ),
      );
      vi.mocked(mockDatabase.getAllSettings).mockReturnValue({
        saveDir,
        gameMode: GameMode.Softcore,
      });
      await (monitor as any).initializeSaveDirectories();
      const parseSpy = vi
        .spyOn(monitor as any, 'parseSaveFile')
        .mockImplementation(async (filePath: unknown) => ({ name: String(filePath) }));

      // Act
      const files = await monitor.getSaveFiles();

      // Assert
      expect(files).toHaveLength(2);
      expect(parseSpy).toHaveBeenCalledTimes(2);
    });

    it('Then should handle parsing errors gracefully', async () => {
      // Arrange
      vi.mocked(readFile).mockRejectedValue(new Error('Parse error'));

      // Act
      const files = await monitor.getSaveFiles();

      // Assert
      expect(files).toEqual([]);
    });
  });

  describe('If updateSaveDirectory is called', () => {
    it('Then should always start monitoring regardless of previous state', async () => {
      // Arrange
      const stopSpy = vi.spyOn(monitor, 'stopMonitoring');
      const startSpy = vi.spyOn(monitor, 'startMonitoring');

      // Act
      await monitor.updateSaveDirectory();

      // Assert - stopMonitoring not called since we weren't monitoring, but startMonitoring always called
      expect(stopSpy).not.toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledOnce();
    });

    it('Then should stop and restart monitoring if already active', async () => {
      // Arrange
      const stopSpy = vi.spyOn(monitor, 'stopMonitoring');
      const startSpy = vi.spyOn(monitor, 'startMonitoring');
      (monitor as any).isMonitoring = true;

      // Act
      await monitor.updateSaveDirectory();

      // Assert - both stop and start called when monitoring was active
      expect(stopSpy).toHaveBeenCalledOnce();
      expect(startSpy).toHaveBeenCalledOnce();
    });
  });

  describe('If shutdown is called', () => {
    it('Then should stop monitoring', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['test.d2s'] as any);
      await monitor.startMonitoring();

      const stopSpy = vi.spyOn(monitor, 'stopMonitoring');

      // Act
      await monitor.shutdown();

      // Assert
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('If character class parsing is used', () => {
    it('Then should return correct character class for valid ID', () => {
      // Act & Assert
      expect((monitor as any).getCharacterClass(0)).toBe('amazon');
      expect((monitor as any).getCharacterClass(1)).toBe('sorceress');
      expect((monitor as any).getCharacterClass(2)).toBe('necromancer');
      expect((monitor as any).getCharacterClass(3)).toBe('paladin');
      expect((monitor as any).getCharacterClass(4)).toBe('barbarian');
      expect((monitor as any).getCharacterClass(5)).toBe('druid');
      expect((monitor as any).getCharacterClass(6)).toBe('assassin');
    });

    it('Then should return unknown for invalid character class ID', () => {
      // Act & Assert
      expect((monitor as any).getCharacterClass(99)).toBe('unknown');
      expect((monitor as any).getCharacterClass(-1)).toBe('unknown');
    });
  });

  describe('If parseSaveFile is called for legacy shared stash files', () => {
    let saveDir: string;

    beforeEach(() => {
      saveDir = mkdtempSync(join(tmpdir(), 'save-monitor-stash-'));
    });

    afterEach(() => {
      rmSync(saveDir, { recursive: true, force: true });
    });

    it.each([
      '.sss',
      '.d2x',
    ])('Then a %s file is described as a shared stash instead of a character', async (extension) => {
      // Arrange
      const filePath = join(saveDir, `SharedStashSoftCoreV2${extension}`);
      writeFileSync(filePath, Buffer.alloc(1024, 0xff));

      // Act
      const saveFile = await (monitor as any).parseSaveFile(filePath);

      // Assert
      expect(saveFile?.characterClass).toBe('shared_stash');
      expect(saveFile?.name).toBe('SharedStashSoftCoreV2');
      expect(saveFile?.level).toBe(1);
    });

    it('Then the hardcore flag of a legacy stash comes from its parsed header', async () => {
      // Arrange
      const filePath = join(saveDir, 'SharedStash.sss');
      writeFileSync(filePath, Buffer.alloc(1024));
      vi.mocked(d2stash.read).mockResolvedValue({ hardcore: true, pages: [] } as any);

      // Act
      const saveFile = await (monitor as any).parseSaveFile(filePath);

      // Assert
      expect(saveFile?.characterClass).toBe('shared_stash');
      expect(saveFile?.hardcore).toBe(true);
    });
  });

  describe('If save file parsing works with D2SaveFileBuilder', () => {
    it('Then should work with different character types using builder', async () => {
      // Arrange
      const amazonSaveFile = D2SaveFileBuilder.new()
        .asAmazon()
        .atLevel(85)
        .asHardcore()
        .asExpansion()
        .withName('AmazonTest')
        .withPath('/path/to/amazon.d2s')
        .build();

      const barbarianSaveFile = D2SaveFileBuilder.new()
        .asBarbarian()
        .atLevel(90)
        .asSoftcore()
        .asClassic()
        .withName('BarbarianTest')
        .withPath('/path/to/barbarian.d2s')
        .build();

      // Act & Assert
      expect(amazonSaveFile.characterClass).toBe('Amazon');
      expect(amazonSaveFile.level).toBe(85);
      expect(amazonSaveFile.hardcore).toBe(true);
      expect(amazonSaveFile.expansion).toBe(true);

      expect(barbarianSaveFile.characterClass).toBe('Barbarian');
      expect(barbarianSaveFile.level).toBe(90);
      expect(barbarianSaveFile.hardcore).toBe(false);
      expect(barbarianSaveFile.expansion).toBe(false);
    });

    it('Then should work with multiple save files using buildMany', async () => {
      // Arrange
      const saveFiles = D2SaveFileBuilder.new()
        .asSorceress()
        .atLevel(80)
        .asHardcore()
        .asExpansion()
        .withName('SorceressTest')
        .withPath('/path/to/sorceress.d2s')
        .buildMany(3);

      // Act & Assert
      expect(saveFiles).toHaveLength(3);
      expect(saveFiles[0].name).toBe('SorceressTest-0');
      expect(saveFiles[1].name).toBe('SorceressTest-1');
      expect(saveFiles[2].name).toBe('SorceressTest-2');
      expect(saveFiles[0].path).toBe('/path/to/sorceress-0.d2s');
      expect(saveFiles[1].path).toBe('/path/to/sorceress-1.d2s');
      expect(saveFiles[2].path).toBe('/path/to/sorceress-2.d2s');
      // All should have the same properties except name and path
      saveFiles.forEach((saveFile) => {
        expect(saveFile.characterClass).toBe('Sorceress');
        expect(saveFile.level).toBe(80);
        expect(saveFile.hardcore).toBe(true);
        expect(saveFile.expansion).toBe(true);
      });
    });
  });

  describe('When file changes are debounced', () => {
    let monitor: SaveFileMonitor;
    let mockDatabase: MockGrailDatabase;
    let eventBus: EventBus;

    beforeEach(() => {
      vi.useFakeTimers();
      eventBus = new EventBus();
      mockDatabase = createMockDatabase();
      mockDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Softcore,
        saveFileDirectory: '/test/saves',
      });
      monitor = new SaveFileMonitor(eventBus, mockDatabase as any);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.clearAllMocks();
    });

    it('Then should not parse immediately after file change', async () => {
      // Arrange
      const parseAllSpy = vi.spyOn(monitor as any, 'parseAllSaveDirectories');
      (monitor as any).fileChangeCounter = 1;
      (monitor as any).lastProcessedChangeCounter = 0;
      (monitor as any).lastFileChangeTime = Date.now();
      (monitor as any).watchPath = '/test/saves';

      // Act - advance time by only 300ms (less than 500ms debounce)
      await vi.advanceTimersByTimeAsync(300);

      // Assert - should NOT have parsed yet
      expect(parseAllSpy).not.toHaveBeenCalled();
    });

    it('Then should parse after debounce delay', async () => {
      // Arrange
      const parseAllSpy = vi
        .spyOn(monitor as any, 'parseAllSaveDirectories')
        .mockResolvedValue(undefined);
      vi.spyOn(monitor as any, 'findExistingSaveDirectories').mockResolvedValue(['/test/saves']);
      (monitor as any).fileChangeCounter = 1;
      (monitor as any).lastProcessedChangeCounter = 0;
      (monitor as any).lastFileChangeTime = Date.now();
      (monitor as any).watchPath = '/test/saves';

      // Act - advance time by 600ms (more than 500ms debounce)
      await vi.advanceTimersByTimeAsync(600);

      // Assert - should have parsed
      expect(parseAllSpy).toHaveBeenCalled();
    });

    it('Then should batch multiple rapid changes into single parse', async () => {
      // Arrange
      const parseAllSpy = vi
        .spyOn(monitor as any, 'parseAllSaveDirectories')
        .mockResolvedValue(undefined);
      vi.spyOn(monitor as any, 'findExistingSaveDirectories').mockResolvedValue(['/test/saves']);
      (monitor as any).watchPath = '/test/saves';
      (monitor as any).lastProcessedChangeCounter = 0;

      // Get initial time from mocked timers
      const startTime = Date.now();

      // Act - Simulate 3 rapid file changes (each within debounce period)
      (monitor as any).fileChangeCounter = 1;
      (monitor as any).lastFileChangeTime = startTime;
      await vi.advanceTimersByTimeAsync(100); // Change 1

      (monitor as any).fileChangeCounter = 2;
      (monitor as any).lastFileChangeTime = startTime + 100;
      await vi.advanceTimersByTimeAsync(100); // Change 2

      (monitor as any).fileChangeCounter = 3;
      (monitor as any).lastFileChangeTime = startTime + 200;
      await vi.advanceTimersByTimeAsync(100); // Change 3 (total 300ms)

      // Now wait for debounce period (500ms from last change at 200ms) + tick cycle
      // Last change was at 200ms, debounce = 500ms, so needs to wait until 700ms+
      // Tick reader runs every 500ms (at 500ms, 1000ms, etc.)
      // So we need to advance to at least 1000ms total to catch the tick at 1000ms
      await vi.advanceTimersByTimeAsync(800); // Total 300 + 800 = 1100ms

      // Assert - should only parse ONCE despite 3 changes
      expect(parseAllSpy).toHaveBeenCalledTimes(1);
    });

    it('Then should bypass debounce for initial parsing', async () => {
      // Arrange
      const parseAllSpy = vi
        .spyOn(monitor as any, 'parseAllSaveDirectories')
        .mockResolvedValue(undefined);
      vi.spyOn(monitor as any, 'findExistingSaveDirectories').mockResolvedValue(['/test/saves']);
      (monitor as any).fileChangeCounter = 1;
      (monitor as any).lastProcessedChangeCounter = 0;
      (monitor as any).lastFileChangeTime = Date.now();
      (monitor as any).watchPath = '/test/saves';
      (monitor as any).isInitialParsing = true; // Set initial parsing flag

      // Act - advance time by only 500ms (less than debounce)
      await vi.advanceTimersByTimeAsync(500);

      // Assert - should parse immediately despite debounce
      expect(parseAllSpy).toHaveBeenCalled();
    });

    it('Then should bypass debounce for force parse', async () => {
      // Arrange
      const parseAllSpy = vi
        .spyOn(monitor as any, 'parseAllSaveDirectories')
        .mockResolvedValue(undefined);
      vi.spyOn(monitor as any, 'findExistingSaveDirectories').mockResolvedValue(['/test/saves']);
      (monitor as any).fileChangeCounter = 1;
      (monitor as any).lastProcessedChangeCounter = 0;
      (monitor as any).lastFileChangeTime = Date.now();
      (monitor as any).watchPath = '/test/saves';
      (monitor as any).forceParseAll = true; // Set force parse flag

      // Act - advance time by only 500ms (less than debounce)
      await vi.advanceTimersByTimeAsync(500);

      // Assert - should parse immediately despite debounce
      expect(parseAllSpy).toHaveBeenCalled();
    });

    it('Then should respect manual mode even with debounce elapsed', async () => {
      // Arrange
      const parseAllSpy = vi
        .spyOn(monitor as any, 'parseAllSaveDirectories')
        .mockResolvedValue(undefined);
      mockDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Manual, // Manual mode
        saveFileDirectory: '/test/saves',
      });
      (monitor as any).fileChangeCounter = 1;
      (monitor as any).lastProcessedChangeCounter = 0;
      (monitor as any).lastFileChangeTime = Date.now();
      (monitor as any).watchPath = '/test/saves';

      // Act - advance time past debounce period
      await vi.advanceTimersByTimeAsync(2500);

      // Assert - should NOT parse in manual mode
      expect(parseAllSpy).not.toHaveBeenCalled();
    });

    it('Then should handle race condition when changes occur during processing', async () => {
      // Arrange
      let parseCount = 0;
      const parseAllSpy = vi
        .spyOn(monitor as any, 'parseAllSaveDirectories')
        .mockImplementation(async () => {
          parseCount++;
          // Simulate a file change happening during parsing
          if (parseCount === 1) {
            (monitor as any).fileChangeCounter++;
            (monitor as any).lastFileChangeTime = Date.now();
          }
        });
      vi.spyOn(monitor as any, 'findExistingSaveDirectories').mockResolvedValue(['/test/saves']);
      (monitor as any).fileChangeCounter = 1;
      (monitor as any).lastProcessedChangeCounter = 0;
      (monitor as any).lastFileChangeTime = Date.now();
      (monitor as any).watchPath = '/test/saves';

      // Act - wait for debounce and first parse
      await vi.advanceTimersByTimeAsync(2500);

      // Wait for debounce again to process the change that occurred during first parse
      await vi.advanceTimersByTimeAsync(2500);

      // Assert - should have parsed TWICE (once for initial change, once for change during processing)
      expect(parseAllSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('When concurrent file parsing is used', () => {
    let monitor: SaveFileMonitor;
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
      monitor = new SaveFileMonitor(eventBus);
    });

    it('Then should execute all tasks with concurrency limit', async () => {
      // Arrange
      let maxConcurrent = 0;
      let currentConcurrent = 0;
      const taskCount = 10;
      const limit = 3;

      const tasks = Array.from({ length: taskCount }, (_, i) => {
        return async () => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          // Simulate async work
          await new Promise((resolve) => setTimeout(resolve, 10));
          currentConcurrent--;
          return i;
        };
      });

      // Act
      const results = await (monitor as any).executeConcurrently(tasks, limit);

      // Assert
      expect(results).toHaveLength(taskCount);
      expect(maxConcurrent).toBeLessThanOrEqual(limit);
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('Then should preserve result order', async () => {
      // Arrange
      const tasks = [
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'first';
        },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'second';
        },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return 'third';
        },
      ];

      // Act
      const results = await (monitor as any).executeConcurrently(tasks, 5);

      // Assert - results should be in original order despite different completion times
      expect(results).toEqual(['first', 'second', 'third']);
    });

    it('Then should handle errors in individual tasks gracefully', async () => {
      // Arrange
      const tasks = [
        async () => 'success1',
        async () => {
          throw new Error('Task failed');
        },
        async () => 'success2',
      ];

      // Act
      const results = await (monitor as any).executeConcurrently(tasks, 5);

      // Assert - successful tasks should complete, failed task returns undefined
      expect(results[0]).toBe('success1');
      expect(results[1]).toBeUndefined();
      expect(results[2]).toBe('success2');
    });

    it('Then should work with limit greater than task count', async () => {
      // Arrange
      const tasks = [async () => 1, async () => 2, async () => 3];

      // Act
      const results = await (monitor as any).executeConcurrently(tasks, 10);

      // Assert
      expect(results).toEqual([1, 2, 3]);
    });

    it('Then should work with limit of 1 (sequential execution)', async () => {
      // Arrange
      let maxConcurrent = 0;
      let currentConcurrent = 0;
      const tasks = Array.from({ length: 5 }, (_, i) => {
        return async () => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          await new Promise((resolve) => setTimeout(resolve, 10));
          currentConcurrent--;
          return i;
        };
      });

      // Act
      const results = await (monitor as any).executeConcurrently(tasks, 1);

      // Assert - should execute sequentially (max 1 at a time)
      expect(maxConcurrent).toBe(1);
      expect(results).toEqual([0, 1, 2, 3, 4]);
    });

    it('Then should work with empty task array', async () => {
      // Arrange
      const tasks: Array<() => Promise<number>> = [];

      // Act
      const results = await (monitor as any).executeConcurrently(tasks, 5);

      // Assert
      expect(results).toEqual([]);
    });
  });

  describe('When configurable intervals are used', () => {
    let monitor: SaveFileMonitor;
    let mockDatabase: MockGrailDatabase;
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
      mockDatabase = createMockDatabase();
    });

    it('Then should use default intervals when settings not provided', () => {
      // Arrange
      mockDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Softcore,
        saveFileDirectory: '/test/saves',
      });

      // Act
      monitor = new SaveFileMonitor(eventBus, mockDatabase as any);

      // Assert - verify defaults used (check via method calls)
      const tickInterval = (monitor as any).getTickReaderInterval();
      expect(tickInterval).toBe(500); // DEFAULT_TICK_INTERVAL
    });

    it('Then should use custom tick reader interval from settings', () => {
      // Arrange
      mockDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Softcore,
        saveFileDirectory: '/test/saves',
        tickReaderIntervalMs: 1000, // Custom value
      });

      // Act
      monitor = new SaveFileMonitor(eventBus, mockDatabase as any);

      // Assert
      const tickInterval = (monitor as any).getTickReaderInterval();
      expect(tickInterval).toBe(1000);
    });

    it('Then should validate and reject invalid tick reader interval', () => {
      // Arrange
      mockDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Softcore,
        saveFileDirectory: '/test/saves',
        tickReaderIntervalMs: 50, // Too low (min is 100)
      });

      // Act
      monitor = new SaveFileMonitor(eventBus, mockDatabase as any);

      // Assert - should fall back to default
      const tickInterval = (monitor as any).getTickReaderInterval();
      expect(tickInterval).toBe(500); // DEFAULT_TICK_INTERVAL
    });

    it('Then should validate interval with max constraint', () => {
      // Arrange
      mockDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Softcore,
        saveFileDirectory: '/test/saves',
        tickReaderIntervalMs: 10000, // Too high (max is 5000)
      });

      // Act
      monitor = new SaveFileMonitor(eventBus, mockDatabase as any);

      // Assert - should fall back to default
      const tickInterval = (monitor as any).getTickReaderInterval();
      expect(tickInterval).toBe(500); // DEFAULT_TICK_INTERVAL
    });

    it('Then should validate interval and allow valid custom value', () => {
      // Arrange
      const validInterval = 250;
      mockDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Softcore,
        saveFileDirectory: '/test/saves',
        tickReaderIntervalMs: validInterval,
      });

      // Act
      monitor = new SaveFileMonitor(eventBus, mockDatabase as any);

      // Assert
      const tickInterval = (monitor as any).getTickReaderInterval();
      expect(tickInterval).toBe(validInterval);
    });

    it('Then should use default when database not available', () => {
      // Arrange & Act
      monitor = new SaveFileMonitor(eventBus); // No database

      // Assert
      const tickInterval = (monitor as any).getTickReaderInterval();
      expect(tickInterval).toBe(500); // DEFAULT_TICK_INTERVAL
    });

    it('Then should validate debounce delay from settings', () => {
      // Arrange
      mockDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Softcore,
        saveFileDirectory: '/test/saves',
        fileChangeDebounceMs: 3000, // Custom debounce
      });
      monitor = new SaveFileMonitor(eventBus, mockDatabase as any);

      // Act
      const validated = (monitor as any).validateInterval(3000, 500, 10000, 2000);

      // Assert
      expect(validated).toBe(3000);
    });
  });

  describe('When stash header parsing is used', () => {
    describe('If getSaveNameFromPath is called with hardcore=true parameter', () => {
      it('Then should return legacy Shared Stash Hardcore for legacy file versions', () => {
        // Arrange
        const filePath = '/test/SharedStashSoftcoreV2.d2i';

        // Act
        const result = (monitor as any).getSaveNameFromPath(filePath, true, 99);

        // Assert
        expect(result).toBe('Shared Stash Hardcore');
      });
    });

    describe('If getSaveNameFromPath is called with hardcore=false parameter', () => {
      it('Then should return modern Shared Stash Softcore for modern file versions', () => {
        // Arrange
        const filePath = '/test/SharedStashHardcoreV2.d2i';

        // Act
        const result = (monitor as any).getSaveNameFromPath(filePath, false, 105);

        // Assert
        expect(result).toBe('Modern Shared Stash Softcore');
      });
    });

    describe('If getSaveNameFromPath is called with hardcore=true and modern version', () => {
      it('Then should return modern Shared Stash Hardcore', () => {
        // Arrange
        const filePath = '/test/SharedStashSoftcoreV2.d2i';

        // Act
        const result = (monitor as any).getSaveNameFromPath(filePath, true, 105);

        // Assert
        expect(result).toBe('Modern Shared Stash Hardcore');
      });
    });

    describe('If getSaveNameFromPath is called without hardcore parameter for hardcore stash', () => {
      it('Then should fallback to filename detection', () => {
        // Arrange
        const filePath = '/test/SharedStashHardcoreV2.d2i';

        // Act
        const result = (monitor as any).getSaveNameFromPath(filePath);

        // Assert
        expect(result).toBe('Shared Stash Hardcore'); // Falls back to filename
      });
    });

    describe('If getSaveNameFromPath is called without hardcore parameter for softcore stash', () => {
      it('Then should fallback to filename detection', () => {
        // Arrange
        const filePath = '/test/SharedStashSoftcoreV2.d2i';

        // Act
        const result = (monitor as any).getSaveNameFromPath(filePath);

        // Assert
        expect(result).toBe('Shared Stash Softcore'); // Falls back to filename
      });
    });

    describe('If getSaveNameFromPath is called with non-.d2i file', () => {
      it('Then should return filename without extension', () => {
        // Arrange
        const filePath = '/test/MyCharacter.d2s';

        // Act
        const result = (monitor as any).getSaveNameFromPath(filePath);

        // Assert
        expect(result).toBe('MyCharacter');
      });
    });

    describe('If getSaveNameFromPath is called with an uppercase extension', () => {
      it('Then should strip the extension case-insensitively', () => {
        // Arrange
        const filePath = '/test/Hero.D2S';

        // Act
        const result = (monitor as any).getSaveNameFromPath(filePath);

        // Assert
        expect(result).toBe('Hero');
      });
    });

    describe('If parseSaveFile is called with an uppercase .D2S extension', () => {
      it('Then should use the filename without extension as the character name', async () => {
        // Arrange
        const saveDir = await mkdtemp(join(tmpdir(), 'arcane-case-'));
        tempDirs.push(saveDir);
        const filePath = join(saveDir, 'Hero.D2S');
        await writeFile(filePath, 'content');

        // Act
        const result = await (monitor as any).parseSaveFile(filePath);

        // Assert
        expect(result.name).toBe('Hero');
      });

      it('Then should keep naming lowercase .d2s files unchanged', async () => {
        // Arrange
        const saveDir = await mkdtemp(join(tmpdir(), 'arcane-case-'));
        tempDirs.push(saveDir);
        const filePath = join(saveDir, 'Hero.d2s');
        await writeFile(filePath, 'content');

        // Act
        const result = await (monitor as any).parseSaveFile(filePath);

        // Assert
        expect(result.name).toBe('Hero');
      });
    });

    describe('If getSaveNameFromPath is called with hardcore parameter on non-.d2i file', () => {
      it('Then should ignore hardcore parameter', () => {
        // Arrange
        const filePath = '/test/MyCharacter.d2s';

        // Act
        const result = (monitor as any).getSaveNameFromPath(filePath, true);

        // Assert
        expect(result).toBe('MyCharacter'); // Hardcore parameter only applies to .d2i files
      });
    });

    describe('If backup-like stash filenames are evaluated', () => {
      it('Then backup-like .d2i files should be excluded from parsing', () => {
        // Arrange
        const fileNames = [
          'Barb.d2s',
          'SharedStashSoftCoreV2.d2i',
          'SharedStashSoftCoreV2_Backup.d2i',
          'SharedStashSoftCoreV2.bak.d2i',
          'notes.txt',
        ];

        // Act
        const included = fileNames.map((name) => (monitor as any).shouldIncludeSaveFile(name));

        // Assert
        expect(included).toEqual([true, true, false, false, false]);
      });
    });
  });

  describe('When runeword parsing validates names', () => {
    let monitor: SaveFileMonitor;
    let mockDatabase: MockGrailDatabase;
    let eventBus: EventBus;

    beforeEach(() => {
      vi.clearAllMocks();

      // Setup simplifyItemName to return lowercase with no spaces
      vi.mocked(simplifyItemName).mockImplementation((name: string) =>
        name.toLowerCase().replace(/[^a-z0-9]/gi, ''),
      );

      eventBus = new EventBus();
      mockDatabase = createMockDatabase();
      mockDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Softcore,
        saveDir: '/test/saves',
      });
      monitor = new SaveFileMonitor(eventBus, mockDatabase as any);
    });

    it('Then should accept valid runeword names from known runewords', async () => {
      // Arrange
      vi.mocked(d2s.read).mockResolvedValue({
        header: {
          status: {
            hardcore: false,
          },
        },
        items: [
          {
            runeword_name: 'Enigma',
            type: 'armor',
          },
        ],
        merc_items: [],
        corpse_items: [],
      } as any);

      // Act
      const { items } = await (monitor as any).parseSave(
        'TestChar',
        'TestChar.d2s',
        Buffer.from('test'),
        '.d2s',
      );

      // Assert
      const runewordItems = items.filter((item: any) => item.type === 'runeword');
      expect(runewordItems).toHaveLength(1);
    });

    it('Then should reject unknown/invalid runeword names', async () => {
      // Arrange
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      vi.mocked(d2s.read).mockResolvedValue({
        header: {
          status: {
            hardcore: false,
          },
        },
        items: [
          {
            runeword_name: 'FakeRuneword',
            type: 'armor',
          },
        ],
        merc_items: [],
        corpse_items: [],
      } as any);

      // Act
      const { items } = await (monitor as any).parseSave(
        'TestChar',
        'TestChar.d2s',
        Buffer.from('test'),
        '.d2s',
      );

      // Assert
      const runewordItems = items.filter((item: any) => item.type === 'runeword');
      expect(runewordItems).toHaveLength(0);

      warnSpy.mockRestore();
    });

    it('Then should fix known parser bug Love -> Lore and accept it', async () => {
      // Arrange
      vi.mocked(d2s.read).mockResolvedValue({
        header: {
          status: {
            hardcore: false,
          },
        },
        items: [
          {
            runeword_name: 'Love', // Parser bug - should be corrected to "Lore"
            type: 'helm',
          },
        ],
        merc_items: [],
        corpse_items: [],
      } as any);

      // Act
      const { items } = await (monitor as any).parseSave(
        'TestChar',
        'TestChar.d2s',
        Buffer.from('test'),
        '.d2s',
      );

      // Assert
      const runewordItems = items.filter((item: any) => item.type === 'runeword');
      expect(runewordItems).toHaveLength(1);
    });

    it('Then should not add items without runeword_name', async () => {
      // Arrange
      vi.mocked(d2s.read).mockResolvedValue({
        header: {
          status: {
            hardcore: false,
          },
        },
        items: [
          {
            type: 'armor',
            // No runeword_name
          },
        ],
        merc_items: [],
        corpse_items: [],
      } as any);

      // Act
      const { items } = await (monitor as any).parseSave(
        'TestChar',
        'TestChar.d2s',
        Buffer.from('test'),
        '.d2s',
      );

      // Assert - should have no runeword items
      const runewordItems = items.filter((item: any) => item.type === 'runeword');
      expect(runewordItems).toHaveLength(0);
    });
  });

  describe('If spatial inventory parsing is executed', () => {
    it('Then createParsedInventoryItem maps spatial metadata and prefers canonical grail filename over parser inv_file', () => {
      // Arrange
      vi.mocked(getGrailItemId).mockReturnValue('harlequincrest');
      const item = {
        name: 'Battle Hammer',
        type: 'mace',
        code: 'uap',
        quality: 5,
        ethereal: false,
        socket_count: 2,
        position_x: 3,
        position_y: 1,
        inv_width: 2,
        inv_height: 3,
        equipped_id: 4,
        location_id: 1,
        inv_file: 'invhamm',
      } as any;

      // Act
      const parsed = (monitor as any).createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item,
        fallbackLocation: 'inventory',
        isSocketedItem: true,
      });

      // Assert
      expect(parsed.locationContext).toBe('equipped');
      expect(parsed.gridX).toBe(3);
      expect(parsed.gridY).toBe(1);
      expect(parsed.gridWidth).toBe(2);
      expect(parsed.gridHeight).toBe(3);
      expect(parsed.equippedSlotId).toBe(4);
      expect(parsed.iconFileName).toBe('cap_hat.png');
      expect(parsed.fingerprintInputs.iconFileName).toBe('invhamm.png');
      expect(parsed.isSocketedItem).toBe(true);
    });

    it('Then canonical code-based icon is preferred over parser inv_file when both exist', () => {
      // Arrange
      vi.mocked(getGrailItemId).mockReturnValue(null);
      const item = {
        name: 'Shako',
        type: 'helm',
        code: 'uap',
        quality: 5,
        inv_file: 'invhamm',
      } as any;

      // Act
      const parsed = (monitor as any).createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item,
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(parsed.iconFileName).toBe('cap_hat.png');
      expect(parsed.fingerprintInputs.iconFileName).toBe('invhamm.png');
    });

    it('Then magic items keep their generated prefix/suffix display name', () => {
      // Arrange
      vi.mocked(getGrailItemId).mockReturnValue(null);
      const item = {
        name: 'Ring',
        type_name: 'Ring',
        type: 'rin',
        code: 'rin',
        quality: 2,
        magic_prefix_name: 'Viper',
        magic_suffix_name: 'of the Fox',
      } as any;

      // Act
      const parsed = (monitor as any).createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item,
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(parsed.itemName).toBe('Viper Ring of the Fox');
    });

    it('Then rare items keep their generated rare name parts', () => {
      // Arrange
      vi.mocked(getGrailItemId).mockReturnValue(null);
      const item = {
        name: 'Ring',
        type_name: 'Ring',
        type: 'rin',
        code: 'rin',
        quality: 3,
        rare_name: 'Stone',
        rare_name2: 'Master',
      } as any;

      // Act
      const parsed = (monitor as any).createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item,
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(parsed.itemName).toBe('Stone Master');
    });

    it('Then location_id 2 maps to unknown belt coordinates in a 4x4 belt board space', () => {
      // Arrange
      vi.mocked(getGrailItemId).mockReturnValue(null);
      const item = {
        name: 'Super Healing Potion',
        type: 'potion',
        code: 'hp5',
        quality: 1,
        location_id: 2,
        position_x: 5,
        position_y: 0,
        inv_width: 1,
        inv_height: 1,
      } as any;

      // Act
      const parsed = (monitor as any).createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item,
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(parsed.locationContext).toBe('unknown');
      expect(parsed.gridX).toBe(1);
      expect(parsed.gridY).toBe(1);
      expect(parsed.gridWidth).toBe(1);
      expect(parsed.gridHeight).toBe(1);
    });

    it('Then d2s location_id 0 alt_position_id 5 maps to personal stash tab 0', () => {
      // Arrange
      vi.mocked(getGrailItemId).mockReturnValue(null);
      const item = {
        name: 'Grand Charm',
        type: 'charm',
        code: 'cm3',
        quality: 1,
        location_id: 0,
        alt_position_id: 5,
        position_x: 12,
        position_y: 3,
        inv_width: 1,
        inv_height: 3,
      } as any;

      // Act
      const parsed = (monitor as any).createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item,
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(parsed.locationContext).toBe('stash');
      expect(parsed.stashTab).toBe(0);
    });

    it('Then d2s alt_position_id 1 remains inventory even when outside canonical bounds', () => {
      // Arrange
      vi.mocked(getGrailItemId).mockReturnValue(null);
      const inBoundsItem = {
        name: 'Tome of Town Portal',
        type: 'book',
        code: 'tbk',
        quality: 1,
        location_id: 0,
        alt_position_id: 1,
        position_x: 0,
        position_y: 2,
        inv_width: 1,
        inv_height: 2,
      } as any;
      const outOfBoundsItem = {
        name: 'Grand Charm',
        type: 'charm',
        code: 'cm3',
        quality: 1,
        location_id: 0,
        alt_position_id: 1,
        position_x: 4,
        position_y: 6,
        inv_width: 1,
        inv_height: 3,
      } as any;

      // Act
      const inBoundsParsed = (monitor as any).createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item: inBoundsItem,
        fallbackLocation: 'inventory',
      });
      const outOfBoundsParsed = (monitor as any).createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item: outOfBoundsItem,
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(inBoundsParsed.locationContext).toBe('inventory');
      expect(inBoundsParsed.stashTab).toBeUndefined();
      expect(outOfBoundsParsed.locationContext).toBe('inventory');
      expect(outOfBoundsParsed.stashTab).toBeUndefined();
    });

    it('Then unknown items derive a snake_case filename fallback from type_name when parser icon is absent', () => {
      // Arrange
      vi.mocked(getGrailItemId).mockReturnValue(null);
      const item = {
        type: 'misc',
        quality: 1,
        type_name: 'Grand Charm',
      } as any;

      // Act
      const parsed = (monitor as any).createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item,
        fallbackLocation: 'inventory',
      });

      // Assert
      expect(parsed.iconFileName).toBe('grand_charm.png');
    });

    it('Then socketed child items can be excluded from UI snapshot arrays', () => {
      // Arrange
      const createParsedInventoryItem = (monitor as any).createParsedInventoryItem.bind(monitor);
      const parent = createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item: {
          name: 'Parent Item',
          type: 'armor',
          code: 'uap',
          quality: 5,
        },
        fallbackLocation: 'inventory',
        isSocketedItem: false,
      });
      const socketedChild = createParsedInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item: {
          name: 'Socketed Child',
          type: 'jewel',
          code: 'jew',
          quality: 1,
        },
        fallbackLocation: 'inventory',
        isSocketedItem: true,
      });
      const allItems = [parent, socketedChild];

      // Act
      const snapshotItems = allItems.filter((item: any) => !item.isSocketedItem);

      // Assert
      expect(snapshotItems).toHaveLength(1);
      expect(snapshotItems[0]?.isSocketedItem).toBe(false);
      expect(allItems.some((item) => item.isSocketedItem)).toBe(true);
    });
  });

  describe('If inventory reconciliation helpers are executed', () => {
    it('Then unchanged inventory snapshots are preserved when only one file is reparsed', async () => {
      // Arrange
      const oldSnapshotA = {
        snapshotId: 'a-old',
        characterName: 'A',
        sourceFileType: 'd2s',
        sourceFilePath: '/test/save/dir/a.d2s',
        capturedAt: new Date('2024-01-01T00:00:00.000Z'),
        items: [{ fingerprint: 'fp-a-old', isSocketedItem: false }],
      };
      const oldSnapshotB = {
        snapshotId: 'b-old',
        characterName: 'B',
        sourceFileType: 'd2s',
        sourceFilePath: '/test/save/dir/b.d2s',
        capturedAt: new Date('2024-01-01T00:00:00.000Z'),
        items: [{ fingerprint: 'fp-b-old', isSocketedItem: false }],
      };
      const newSnapshotA = {
        snapshotId: 'a-new',
        characterName: 'A',
        sourceFileType: 'd2s',
        sourceFilePath: '/test/save/dir/a.d2s',
        capturedAt: new Date('2024-01-02T00:00:00.000Z'),
        items: [{ fingerprint: 'fp-a-new', isSocketedItem: false }],
      };

      (monitor as any).inventorySnapshots = [oldSnapshotA, oldSnapshotB];

      vi.spyOn(monitor as any, 'filterFilesToParse').mockResolvedValue(['/test/save/dir/a.d2s']);
      vi.spyOn(monitor as any, 'executeConcurrently').mockResolvedValue([
        {
          saveName: 'A',
          success: true,
          inventorySnapshot: newSnapshotA,
        },
      ]);
      vi.spyOn(monitor as any, 'emitSaveFileEvents').mockResolvedValue(undefined);

      // Act
      await (monitor as any).parseFiles(['/test/save/dir/a.d2s', '/test/save/dir/b.d2s'], false);
      const snapshots = (monitor as any).inventorySnapshots;

      // Assert
      expect(snapshots).toHaveLength(2);
      expect(snapshots.some((snapshot: any) => snapshot.snapshotId === 'a-new')).toBe(true);
      expect(snapshots.some((snapshot: any) => snapshot.snapshotId === 'b-old')).toBe(true);
    });

    it('Then stale snapshots are pruned when no files need reparsing', async () => {
      // Arrange
      const oldSnapshotA = {
        snapshotId: 'a-old',
        characterName: 'A',
        sourceFileType: 'd2s',
        sourceFilePath: '/test/save/dir/a.d2s',
        capturedAt: new Date('2024-01-01T00:00:00.000Z'),
        items: [{ fingerprint: 'fp-a-old', isSocketedItem: false }],
      };
      const oldSnapshotB = {
        snapshotId: 'b-old',
        characterName: 'B',
        sourceFileType: 'd2s',
        sourceFilePath: '/test/save/dir/b.d2s',
        capturedAt: new Date('2024-01-01T00:00:00.000Z'),
        items: [{ fingerprint: 'fp-b-old', isSocketedItem: false }],
      };

      (monitor as any).inventorySnapshots = [oldSnapshotA, oldSnapshotB];
      vi.spyOn(monitor as any, 'filterFilesToParse').mockResolvedValue([]);
      const emitSpy = vi.spyOn(monitor as any, 'emitSaveFileEvents').mockResolvedValue(undefined);

      // Act
      await (monitor as any).parseFiles(['/test/save/dir/a.d2s'], false);
      const snapshots = (monitor as any).inventorySnapshots;

      // Assert
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]?.snapshotId).toBe('a-old');
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('Then all files are parsed when snapshots are empty even if only one file changed', async () => {
      // Arrange
      const snapshotA = {
        snapshotId: 'a-new',
        characterName: 'A',
        sourceFileType: 'd2s',
        sourceFilePath: '/test/save/dir/a.d2s',
        capturedAt: new Date('2024-01-02T00:00:00.000Z'),
        items: [{ fingerprint: 'fp-a-new', isSocketedItem: false }],
      };
      const snapshotB = {
        snapshotId: 'b-new',
        characterName: 'B',
        sourceFileType: 'd2s',
        sourceFilePath: '/test/save/dir/b.d2s',
        capturedAt: new Date('2024-01-02T00:00:00.000Z'),
        items: [{ fingerprint: 'fp-b-new', isSocketedItem: false }],
      };

      (monitor as any).inventorySnapshots = [];
      vi.spyOn(monitor as any, 'filterFilesToParse').mockResolvedValue(['/test/save/dir/a.d2s']);
      const executeSpy = vi.spyOn(monitor as any, 'executeConcurrently').mockResolvedValue([
        {
          saveName: 'A',
          success: true,
          inventorySnapshot: snapshotA,
        },
        {
          saveName: 'B',
          success: true,
          inventorySnapshot: snapshotB,
        },
      ]);
      const emitSpy = vi.spyOn(monitor as any, 'emitSaveFileEvents').mockResolvedValue(undefined);

      // Act
      await (monitor as any).parseFiles(['/test/save/dir/a.d2s', '/test/save/dir/b.d2s'], false);

      // Assert
      expect((executeSpy.mock.calls[0]?.[0] as unknown[]).length).toBe(2);
      expect(emitSpy).toHaveBeenCalledWith(
        [
          { filePath: '/test/save/dir/a.d2s', saveName: 'A' },
          { filePath: '/test/save/dir/b.d2s', saveName: 'B' },
        ],
        expect.any(Object),
      );
      expect((monitor as any).inventorySnapshots).toHaveLength(2);
    });

    it('Then each successfully parsed file reconciles vault presence scoped to that file', async () => {
      // Arrange
      const snapshotA = {
        snapshotId: 'a-new',
        characterName: 'A',
        sourceFileType: 'd2s',
        sourceFilePath: '/test/save/dir/a.d2s',
        capturedAt: new Date('2024-01-02T00:00:00.000Z'),
        items: [{ fingerprint: 'fp-a-visible', isSocketedItem: false }],
      };
      vi.spyOn(monitor as any, 'filterFilesToParse').mockResolvedValue(['/test/save/dir/a.d2s']);
      vi.spyOn(monitor as any, 'executeConcurrently').mockResolvedValue([
        {
          saveName: 'A',
          success: true,
          inventorySnapshot: snapshotA,
          parseStatus: 'parsed',
          presentFingerprints: ['fp-a-visible', 'fp-a-socketed'],
          presentIdentityKeys: ['key-a-visible', 'key-a-socketed'],
        },
      ]);
      vi.spyOn(monitor as any, 'emitSaveFileEvents').mockResolvedValue(undefined);

      // Act
      await (monitor as any).parseFiles(['/test/save/dir/a.d2s', '/test/save/dir/b.d2s'], false);

      // Assert
      expect(mockDatabase.reconcileVaultItemsForScan).toHaveBeenCalledTimes(1);
      expect(mockDatabase.reconcileVaultItemsForScan).toHaveBeenCalledWith({
        sourceFileType: 'd2s',
        sourceFilePath: '/test/save/dir/a.d2s',
        presentFingerprints: ['fp-a-visible', 'fp-a-socketed'],
        presentIdentityKeys: ['key-a-visible', 'key-a-socketed'],
        lastSeenAt: snapshotA.capturedAt,
      });
    });

    it('Then a file that failed to parse never marks its vault rows as missing', async () => {
      // Arrange
      vi.spyOn(monitor as any, 'filterFilesToParse').mockResolvedValue(['/test/save/dir/a.d2s']);
      vi.spyOn(monitor as any, 'executeConcurrently').mockResolvedValue([
        { saveName: 'A', success: false, inventorySnapshot: undefined },
      ]);
      vi.spyOn(monitor as any, 'emitSaveFileEvents').mockResolvedValue(undefined);

      // Act
      await (monitor as any).parseFiles(['/test/save/dir/a.d2s'], false);

      // Assert
      expect(mockDatabase.reconcileVaultItemsForScan).not.toHaveBeenCalled();
    });

    it('Then unchanged files are not reconciled when no file needs reparsing', async () => {
      // Arrange
      (monitor as any).inventorySnapshots = [
        {
          snapshotId: 'a-old',
          characterName: 'A',
          sourceFileType: 'd2s',
          sourceFilePath: '/test/save/dir/a.d2s',
          capturedAt: new Date('2024-01-01T00:00:00.000Z'),
          items: [],
        },
      ];
      vi.spyOn(monitor as any, 'filterFilesToParse').mockResolvedValue([]);

      // Act
      await (monitor as any).parseFiles(['/test/save/dir/a.d2s'], false);

      // Assert
      expect(mockDatabase.reconcileVaultItemsForScan).not.toHaveBeenCalled();
    });

    it('Then a reconciliation database error does not break the scan or the snapshots', async () => {
      // Arrange
      const snapshotA = {
        snapshotId: 'a-new',
        characterName: 'A',
        sourceFileType: 'd2s',
        sourceFilePath: '/test/save/dir/a.d2s',
        capturedAt: new Date('2024-01-02T00:00:00.000Z'),
        items: [{ fingerprint: 'fp-a', isSocketedItem: false }],
      };
      mockDatabase.reconcileVaultItemsForScan.mockImplementation(() => {
        throw new Error('database is locked');
      });
      vi.spyOn(monitor as any, 'filterFilesToParse').mockResolvedValue(['/test/save/dir/a.d2s']);
      vi.spyOn(monitor as any, 'executeConcurrently').mockResolvedValue([
        { saveName: 'A', success: true, parseStatus: 'parsed', inventorySnapshot: snapshotA },
      ]);
      const emitSpy = vi.spyOn(monitor as any, 'emitSaveFileEvents').mockResolvedValue(undefined);

      // Act
      await (monitor as any).parseFiles(['/test/save/dir/a.d2s'], false);

      // Assert
      expect((monitor as any).inventorySnapshots).toHaveLength(1);
      expect(emitSpy).toHaveBeenCalled();
    });

    it('Then processSingleFile reports the fingerprints of every item including socketed ones', async () => {
      // Arrange
      const saveDir = mkdtempSync(join(tmpdir(), 'save-monitor-'));
      const savePath = join(saveDir, 'Hero.d2s');
      writeFileSync(savePath, Buffer.from('mock file content'));
      vi.spyOn(monitor as any, 'parseSave').mockResolvedValue({
        status: 'parsed',
        items: [
          {
            fingerprint: 'fp-parent',
            itemName: 'Shako',
            characterName: 'Hero',
            isSocketedItem: false,
            rawParsedItem: { name: 'Shako' },
          },
          {
            fingerprint: 'fp-socketed',
            itemName: 'Ist Rune',
            characterName: 'Hero',
            isSocketedItem: true,
            rawParsedItem: { name: 'Ist Rune' },
          },
        ],
      });
      vi.spyOn(monitor as any, 'updateSaveFileState').mockResolvedValue(undefined);

      // Act
      const parseResult = await (monitor as any).processSingleFile(savePath, {
        items: {},
        ethItems: {},
        stats: {},
        availableRunes: {},
      });
      rmSync(saveDir, { recursive: true, force: true });

      // Assert
      expect(parseResult.presentFingerprints).toEqual(['fp-parent', 'fp-socketed']);
      expect(parseResult.inventorySnapshot?.items).toHaveLength(1);
    });

    it('Then a moved item keeps its presence identity while its fingerprint changes', () => {
      // Arrange
      vi.mocked(getGrailItemId).mockReturnValue(null);
      const itemAt = (x: number, y: number) =>
        ({
          name: 'Ring of Fire',
          type: 'ring',
          code: 'rin',
          quality: 4,
          id: 987654,
          location_id: 0,
          alt_position_id: 5,
          position_x: x,
          position_y: y,
          inv_width: 1,
          inv_height: 1,
        }) as any;
      const parse = (item: any) =>
        (monitor as any).createParsedInventoryItem({
          filePath: '/tmp/SharedStash.d2i',
          saveName: 'Shared',
          sourceFileType: 'd2i',
          item,
          fallbackLocation: 'stash',
          stashTab: 0,
        });

      // Act
      const before = parse(itemAt(1, 1));
      const after = parse(itemAt(6, 4));

      // Assert
      expect(after.fingerprint).not.toBe(before.fingerprint);
      expect((monitor as any).createPresenceIdentityKey(after)).toBe(
        (monitor as any).createPresenceIdentityKey(before),
      );
    });

    it('Then items that differ only by their game item id have different presence identities', () => {
      // Arrange
      vi.mocked(getGrailItemId).mockReturnValue(null);
      const ring = (id: number) =>
        ({
          name: 'Ring of Fire',
          type: 'ring',
          code: 'rin',
          quality: 4,
          id,
          position_x: 1,
          position_y: 1,
          inv_width: 1,
          inv_height: 1,
        }) as any;
      const parse = (item: any) =>
        (monitor as any).createParsedInventoryItem({
          filePath: '/tmp/SharedStash.d2i',
          saveName: 'Shared',
          sourceFileType: 'd2i',
          item,
          fallbackLocation: 'stash',
          stashTab: 0,
        });

      // Act
      const first = (monitor as any).createPresenceIdentityKey(parse(ring(1)));
      const second = (monitor as any).createPresenceIdentityKey(parse(ring(2)));

      // Assert
      expect(first).not.toBe(second);
    });

    it('Then processSingleFile reports one identity key per fingerprint, in the same order', async () => {
      // Arrange
      const saveDir = mkdtempSync(join(tmpdir(), 'save-monitor-'));
      const savePath = join(saveDir, 'Hero.d2s');
      writeFileSync(savePath, Buffer.from('mock file content'));
      const parsedItems = [
        {
          fingerprint: 'fp-parent',
          itemName: 'Shako',
          itemCode: 'uap',
          quality: 'unique',
          sourceFileType: 'd2s',
          characterName: 'Hero',
          isSocketedItem: false,
          rawParsedItem: { name: 'Shako', id: 11 },
        },
        {
          fingerprint: 'fp-socketed',
          itemName: 'Ist Rune',
          itemCode: 'r24',
          quality: 'normal',
          sourceFileType: 'd2s',
          characterName: 'Hero',
          isSocketedItem: true,
          rawParsedItem: { name: 'Ist Rune' },
        },
      ];
      vi.spyOn(monitor as any, 'parseSave').mockResolvedValue({
        status: 'parsed',
        items: parsedItems,
      });
      vi.spyOn(monitor as any, 'updateSaveFileState').mockResolvedValue(undefined);

      // Act
      const parseResult = await (monitor as any).processSingleFile(savePath, {
        items: {},
        ethItems: {},
        stats: {},
        availableRunes: {},
      });
      rmSync(saveDir, { recursive: true, force: true });

      // Assert
      expect(parseResult.presentIdentityKeys).toEqual(
        parsedItems.map((item) => (monitor as any).createPresenceIdentityKey(item)),
      );
      expect(parseResult.presentIdentityKeys).toHaveLength(parseResult.presentFingerprints.length);
    });

    it('Then createFingerprint returns deterministic output for the same inputs', () => {
      // Arrange
      const item = {
        fingerprintInputs: {
          sourceFileType: 'd2s',
          characterName: 'Sorc',
          locationContext: 'inventory',
          itemCode: 'uap',
          quality: 'unique',
          ethereal: false,
          socketCount: 0,
          stashTab: 1,
          itemName: 'Shako',
        },
      };

      // Act
      const first = (monitor as any).createFingerprint(item);
      const second = (monitor as any).createFingerprint(item);

      // Assert
      expect(first).toBe(second);
      expect(first.length).toBeGreaterThan(0);
    });
  });

  describe('When modern v105 shared stash files are parsed', () => {
    it('Then parseSave returns modern shared and resource tabs with strict stack counts', async () => {
      // Arrange
      const fixtureBuffer = readFileSync(MODERN_STASH_FIXTURE_PATH);

      // Act
      const { items: parsedItems } = await (monitor as any).parseSave(
        'Shared Stash Softcore',
        MODERN_STASH_FIXTURE_PATH,
        fixtureBuffer,
        '.d2i',
      );

      // Assert
      expect(parsedItems.length).toBeGreaterThan(0);
      expect(parsedItems.some((item: any) => item.locationContext === 'stash')).toBe(true);
      expect(parsedItems.some((item: any) => item.stashTabKind !== undefined)).toBe(true);
      expect(parsedItems.some((item: any) => item.stashTab === 5)).toBe(true);
      expect(parsedItems.some((item: any) => item.stashTab === 6)).toBe(true);
      expect(parsedItems.some((item: any) => item.stashTab === 7)).toBe(true);
      expect(parsedItems.every((item: any) => (item.stackCount ?? 1) >= 1)).toBe(true);
      expect(
        parsedItems
          .filter((item: any) => !item.isSocketedItem && item.locationContext === 'stash')
          .every(
            (item: any) =>
              typeof item.gridWidth === 'number' &&
              item.gridWidth > 0 &&
              typeof item.gridHeight === 'number' &&
              item.gridHeight > 0,
          ),
      ).toBe(true);
    }, 20000);

    it('Then processSingleFile marks modern snapshots as writable and records source file version', async () => {
      // Arrange
      const fixtureBuffer = readFileSync(MODERN_STASH_FIXTURE_PATH);
      vi.spyOn(monitor as any, 'parseSave').mockResolvedValue({ items: [], status: 'parsed' });
      vi.spyOn(monitor as any, 'updateSaveFileState').mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(fixtureBuffer);

      // Act
      const parseResult = await (monitor as any).processSingleFile(MODERN_STASH_FIXTURE_PATH, {
        items: {},
        ethItems: {},
        stats: {},
        availableRunes: {},
      });

      // Assert
      expect(parseResult.success).toBe(true);
      // Modern stash shared tabs are now writable — drag-and-drop is enabled
      expect(parseResult.inventorySnapshot?.readOnly).toBe(false);
      expect(parseResult.inventorySnapshot?.sourceFileVersion).toBe(105);
      expect(parseResult.saveName).toBe('Modern Shared Stash Softcore');
    });

    it('Then processSingleFile stamps every snapshot item with the stored character id', async () => {
      // Arrange
      const saveDir = mkdtempSync(join(tmpdir(), 'save-monitor-'));
      const savePath = join(saveDir, 'Hero.d2s');
      writeFileSync(savePath, Buffer.from('mock file content'));
      mockDatabase.getCharacterByName.mockReturnValue({ id: 'char-1', name: 'Hero' });
      vi.spyOn(monitor as any, 'parseSave').mockResolvedValue({
        status: 'parsed',
        items: [
          {
            itemName: 'Shako',
            characterName: 'Hero',
            isSocketedItem: false,
            rawParsedItem: { name: 'Shako' },
          },
        ],
      });
      vi.spyOn(monitor as any, 'updateSaveFileState').mockResolvedValue(undefined);

      // Act
      const parseResult = await (monitor as any).processSingleFile(savePath, {
        items: {},
        ethItems: {},
        stats: {},
        availableRunes: {},
      });
      rmSync(saveDir, { recursive: true, force: true });

      // Assert
      expect(parseResult.inventorySnapshot?.characterId).toBe('char-1');
      expect(parseResult.inventorySnapshot?.items.map((item: any) => item.characterId)).toEqual([
        'char-1',
      ]);
    });
  });

  describe('When vault rows reference save files that no longer exist', () => {
    // These tests use real files: the monitor reads file metadata through node:fs/promises directly.
    let saveDir: string;
    let goneFile: string;

    beforeEach(() => {
      saveDir = mkdtempSync(join(tmpdir(), 'save-monitor-orphans-'));
      goneFile = join(saveDir, 'Gone.d2s');
      mockDatabase.getVaultSourceFilePathsPresentInLatestScan.mockReturnValue([goneFile]);
    });

    afterEach(() => {
      chmodSync(saveDir, 0o700);
      rmSync(saveDir, { recursive: true, force: true });
    });

    it('Then rows of a file that is truly absent are marked missing', async () => {
      // Arrange
      const scannedFiles = [join(saveDir, 'Other.d2s')];

      // Act
      await (monitor as any).markOrphanedVaultRowsMissing(scannedFiles);

      // Assert
      expect(mockDatabase.markVaultItemsMissingForSourceFiles).toHaveBeenCalledWith([goneFile]);
    });

    it('Then a file that still exists is left alone', async () => {
      // Arrange
      writeFileSync(goneFile, 'save');

      // Act
      await (monitor as any).markOrphanedVaultRowsMissing([]);

      // Assert
      expect(mockDatabase.markVaultItemsMissingForSourceFiles).not.toHaveBeenCalled();
    });

    // chmod 000 only blocks stat() for unprivileged POSIX users: root ignores the mode and Windows
    // has no POSIX permission bits, so the test would pass without checking anything there.
    const canRestrictDirectoryAccess =
      process.platform !== 'win32' && (process.getuid?.() ?? 0) !== 0;

    it.skipIf(!canRestrictDirectoryAccess)(
      'Then a file that cannot be inspected right now does not count as deleted',
      async () => {
        // Arrange
        writeFileSync(goneFile, 'save');
        chmodSync(saveDir, 0o000);

        try {
          // Act
          await (monitor as any).markOrphanedVaultRowsMissing([]);

          // Assert
          expect(mockDatabase.markVaultItemsMissingForSourceFiles).not.toHaveBeenCalled();
        } finally {
          chmodSync(saveDir, 0o700);
        }
      },
    );

    it('Then an unavailable save directory does not count as deleted files', async () => {
      // Arrange
      const missingDirectoryFile = join(saveDir, 'unmounted', 'Gone.d2s');
      mockDatabase.getVaultSourceFilePathsPresentInLatestScan.mockReturnValue([
        missingDirectoryFile,
      ]);

      // Act
      await (monitor as any).markOrphanedVaultRowsMissing([]);

      // Assert
      expect(mockDatabase.markVaultItemsMissingForSourceFiles).not.toHaveBeenCalled();
    });

    it('Then a file that was just scanned is never marked missing', async () => {
      // Arrange
      const scannedFiles = [goneFile];

      // Act
      await (monitor as any).markOrphanedVaultRowsMissing(scannedFiles);

      // Assert
      expect(mockDatabase.markVaultItemsMissingForSourceFiles).not.toHaveBeenCalled();
    });

    it('Then a database error does not break the scan', async () => {
      // Arrange
      mockDatabase.markVaultItemsMissingForSourceFiles.mockImplementation(() => {
        throw new Error('database is locked');
      });

      // Act
      const run = (monitor as any).markOrphanedVaultRowsMissing([]);

      // Assert
      await expect(run).resolves.toBeUndefined();
    });

    it('Then every scan checks for deleted files, even when no file needs reparsing', async () => {
      // Arrange
      const otherFile = join(saveDir, 'Other.d2s');
      vi.spyOn(monitor as any, 'filterFilesToParse').mockResolvedValue([]);
      (monitor as any).inventorySnapshots = [
        {
          snapshotId: 'o-old',
          characterName: 'Other',
          sourceFileType: 'd2s',
          sourceFilePath: otherFile,
          capturedAt: new Date('2024-01-01T00:00:00.000Z'),
          items: [],
        },
      ];

      // Act
      await (monitor as any).parseFiles([otherFile], false);

      // Assert
      expect(mockDatabase.markVaultItemsMissingForSourceFiles).toHaveBeenCalledWith([goneFile]);
    });
  });

  describe('When a scan produces no items for a save file', () => {
    let saveDir: string;

    beforeEach(() => {
      saveDir = mkdtempSync(join(tmpdir(), 'save-monitor-scan-'));
    });

    afterEach(() => {
      rmSync(saveDir, { recursive: true, force: true });
    });

    async function scanFile(fileName: string, buffer: Buffer): Promise<string> {
      const filePath = join(saveDir, fileName);
      writeFileSync(filePath, buffer);
      vi.spyOn(monitor as any, 'filterFilesToParse').mockResolvedValue([filePath]);
      vi.spyOn(monitor as any, 'updateSaveFileState').mockResolvedValue(undefined);
      vi.spyOn(monitor as any, 'emitSaveFileEvents').mockResolvedValue(undefined);
      await (monitor as any).parseFiles([filePath], false);
      return filePath;
    }

    describe('If a character is skipped because of a game mode mismatch', () => {
      it('Then its vault rows are not reconciled', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          saveDir: '/test/save/dir',
          gameMode: GameMode.Softcore,
        });
        vi.mocked(d2s.read).mockResolvedValue({
          header: { status: { hardcore: true } },
          items: [{ id: 1 }],
          merc_items: [],
          corpse_items: [],
        } as any);

        // Act
        await scanFile('Hero.d2s', Buffer.from('mock'));

        // Assert
        expect(mockDatabase.reconcileVaultItemsForScan).not.toHaveBeenCalled();
      });
    });

    describe('If a classic shared stash is skipped because of a game mode mismatch', () => {
      it('Then its vault rows are not reconciled', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          saveDir: '/test/save/dir',
          gameMode: GameMode.Hardcore,
        });
        vi.mocked(d2stash.read).mockResolvedValue({
          hardcore: false,
          pages: [{ items: [{ id: 1 }] }],
        } as any);

        // Act
        await scanFile('shared.sss', Buffer.from('mock'));

        // Assert
        expect(mockDatabase.reconcileVaultItemsForScan).not.toHaveBeenCalled();
      });
    });

    describe('If a modern shared stash is skipped because of a game mode mismatch', () => {
      it('Then its vault rows are not reconciled', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          saveDir: '/test/save/dir',
          gameMode: GameMode.Hardcore,
        });

        // Act
        await scanFile('ModernSharedStashSoftCoreV2.d2i', readFileSync(MODERN_STASH_FIXTURE_PATH));

        // Assert
        expect(mockDatabase.reconcileVaultItemsForScan).not.toHaveBeenCalled();
      });
    });

    describe('If a v105+ shared stash parse error is swallowed', () => {
      it('Then its vault rows are not reconciled', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          saveDir: '/test/save/dir',
          gameMode: GameMode.Both,
        });
        // The header is valid (version 105 is read), but parsing the items throws.
        const modernParseSpy = vi
          .spyOn(modernStashParser, 'parseModernStash')
          .mockRejectedValueOnce(new Error('corrupt sector'));
        const processSpy = vi.spyOn(monitor as any, 'parseSave');

        // Act
        await scanFile('ModernSharedStashSoftCoreV2.d2i', readFileSync(MODERN_STASH_FIXTURE_PATH));

        // Assert
        const outcome = await processSpy.mock.results[0]?.value;
        expect(modernParseSpy).toHaveBeenCalledTimes(1);
        expect(outcome.status).toBe('errored');
        expect(outcome.items).toEqual([]);
        expect(mockDatabase.reconcileVaultItemsForScan).not.toHaveBeenCalled();
      });
    });

    describe('If a v105+ shared stash is cut off inside a sector', () => {
      it('Then it is reported as errored without falling back to the legacy stash parser', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          saveDir: '/test/save/dir',
          gameMode: GameMode.Both,
        });
        const truncated = readFileSync(MODERN_STASH_FIXTURE_PATH).subarray(0, 3000);
        vi.mocked(d2stash.read).mockClear();
        const parseSaveSpy = vi.spyOn(monitor as any, 'parseSave');

        // Act
        await scanFile('ModernSharedStashSoftCoreV2.d2i', truncated);

        // Assert
        const outcome = await parseSaveSpy.mock.results[0]?.value;
        expect(outcome.status).toBe('errored');
        expect(outcome.items).toEqual([]);
        expect(d2stash.read).not.toHaveBeenCalled();
        expect(mockDatabase.reconcileVaultItemsForScan).not.toHaveBeenCalled();
      });
    });

    describe('If a v105+ shared stash is only partially parsed', () => {
      it('Then its vault rows are not reconciled but the items read so far stay visible', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          saveDir: '/test/save/dir',
          gameMode: GameMode.Both,
        });
        const complete = await modernStashParser.parseModernStash(
          readFileSync(MODERN_STASH_FIXTURE_PATH),
        );
        vi.spyOn(modernStashParser, 'parseModernStash').mockResolvedValueOnce({
          ...complete,
          partial: true,
        });
        const parseSaveSpy = vi.spyOn(monitor as any, 'parseSave');

        // Act
        await scanFile('ModernSharedStashSoftCoreV2.d2i', readFileSync(MODERN_STASH_FIXTURE_PATH));

        // Assert
        const outcome = await parseSaveSpy.mock.results[0]?.value;
        expect(outcome.status).toBe('partial');
        expect(outcome.items.length).toBeGreaterThanOrEqual(complete.items.length);
        expect(mockDatabase.reconcileVaultItemsForScan).not.toHaveBeenCalled();
        expect((monitor as any).inventorySnapshots[0].items.length).toBeGreaterThan(0);
      });
    });

    describe('If the file is parsed successfully but really contains no items', () => {
      it('Then its vault rows are reconciled against an empty item list', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          saveDir: '/test/save/dir',
          gameMode: GameMode.Both,
        });

        // Act
        const filePath = await scanFile('Hero.d2s', Buffer.from('mock'));

        // Assert
        expect(mockDatabase.reconcileVaultItemsForScan).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceFileType: 'd2s',
            sourceFilePath: filePath,
            presentFingerprints: [],
          }),
        );
      });
    });

    describe('If a modern shared stash is parsed successfully', () => {
      it('Then its vault rows are reconciled with the fingerprints of the parsed items', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          saveDir: '/test/save/dir',
          gameMode: GameMode.Both,
        });

        // Act
        await scanFile('ModernSharedStashSoftCoreV2.d2i', readFileSync(MODERN_STASH_FIXTURE_PATH));

        // Assert
        const scan = mockDatabase.reconcileVaultItemsForScan.mock.calls[0]?.[0];
        expect(scan.presentFingerprints.length).toBeGreaterThan(0);
      });
    });
  });

  describe('When item counts are read from parsed saves', () => {
    it('Then getAvailableRunesCount sums rune quantities instead of entry counts', () => {
      // Arrange
      vi.mocked(isRune).mockReturnValue(true);
      vi.mocked(getGrailItemId).mockReturnValue('el');
      const runeEntry = (stackCount?: number) => ({
        rawParsedItem: { type: 'r01' },
        isSocketedItem: false,
        stackCount,
      });
      (monitor as any).inventorySnapshots = [
        { items: [runeEntry(3), runeEntry(2)] },
        { items: [runeEntry()] },
      ];

      // Act
      const counts = monitor.getAvailableRunesCount();

      // Assert
      expect(counts).toEqual({ el: 6 });
    });
  });

  describe('When a save contains runes socketed into items', () => {
    let saveDir: string;

    beforeEach(() => {
      saveDir = mkdtempSync(join(tmpdir(), 'save-monitor-runes-'));
    });

    afterEach(() => {
      rmSync(saveDir, { recursive: true, force: true });
    });

    describe('If a socketed item holds an embedded rune and a loose rune sits in the inventory', () => {
      it('Then only the loose rune counts as an available rune', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          saveDir: '/test/save/dir',
          gameMode: GameMode.Both,
        });
        vi.mocked(isRune).mockImplementation((item) => /^r\d\d$/.test(item.type ?? ''));
        vi.mocked(getGrailItemId).mockImplementation((item) =>
          (item as { type?: string }).type === 'r01'
            ? 'el'
            : (item as { type?: string }).type === 'r02'
              ? 'eld'
              : null,
        );
        vi.mocked(d2s.read).mockResolvedValue({
          header: { status: { hardcore: false } },
          items: [
            { type: 'r01' },
            {
              type: 'armor',
              unique_name: "Tyrael's Might",
              socketed: 1,
              socketed_items: [{ type: 'r02' }],
            },
          ],
          merc_items: [],
          corpse_items: [],
        } as any);
        const filePath = join(saveDir, 'Hero.d2s');
        writeFileSync(filePath, Buffer.from('mock'));
        vi.spyOn(monitor as any, 'filterFilesToParse').mockResolvedValue([filePath]);
        vi.spyOn(monitor as any, 'updateSaveFileState').mockResolvedValue(undefined);
        vi.spyOn(monitor as any, 'emitSaveFileEvents').mockResolvedValue(undefined);

        // Act
        await (monitor as any).parseFiles([filePath], false);

        // Assert
        expect(monitor.getAvailableRunesCount()).toEqual({ el: 1 });
      });
    });
  });
});
