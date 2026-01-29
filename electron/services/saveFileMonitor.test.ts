/** biome-ignore-all lint/suspicious/noExplicitAny: This file is testing private methods */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the d2s library
vi.mock('@dschu012/d2s', () => ({
  read: vi.fn(),
  getConstantData: vi.fn(),
  setConstantData: vi.fn(),
}));

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
  getItemIdForD2SItem: vi.fn(),
  isRuneId: vi.fn(),
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

import { existsSync, readdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { app } from 'electron';
import { D2SaveFileBuilder } from '@/fixtures';
import { getItemIdForD2SItem, isRuneId } from '../items/indexes';
import { GameMode } from '../types/grail';
import { isRune, simplifyItemName } from '../utils/objects';
import { EventBus } from './EventBus';
import { SaveFileMonitor } from './saveFileMonitor';

// Mock database interface
interface MockGrailDatabase {
  getAllSettings: ReturnType<typeof vi.fn>;
  setSetting: ReturnType<typeof vi.fn>;
}

const createMockDatabase = (): MockGrailDatabase => ({
  getAllSettings: vi.fn(),
  setSetting: vi.fn(),
});

describe('When SaveFileMonitor is used', () => {
  let monitor: SaveFileMonitor;
  let mockDatabase: MockGrailDatabase;
  let eventBus: EventBus;

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
    vi.mocked(getItemIdForD2SItem).mockReturnValue('test-item-id');
    vi.mocked(isRuneId).mockReturnValue(false);
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
    it('Then should not restart monitoring if was not monitoring', async () => {
      // Arrange
      const stopSpy = vi.spyOn(monitor, 'stopMonitoring');
      const startSpy = vi.spyOn(monitor, 'startMonitoring');

      // Act
      await monitor.updateSaveDirectory();

      // Assert
      expect(stopSpy).not.toHaveBeenCalled();
      expect(startSpy).not.toHaveBeenCalled();
    });
  });

  describe('If getItems is called', () => {
    it('Then should return current data', () => {
      // Act
      const items = monitor.getItems();

      // Assert
      expect(items).toEqual({
        items: {},
        ethItems: {},
        stats: {},
        availableRunes: {},
      });
    });
  });

  describe('If fillInAvailableRunes is called', () => {
    it('Then should call the method without errors', () => {
      // Act & Assert
      expect(() => monitor.fillInAvailableRunes()).not.toThrow();
    });
  });

  describe('If createManualItem is called', () => {
    it('Then should create manual item with specified count', () => {
      // Act
      const item = monitor.createManualItem(3);

      // Assert
      expect(item).toEqual({
        inSaves: {
          'Manual entry': [{}, {}, {}],
        },
        name: '',
        type: '',
      });
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
      it('Then should return Shared Stash Hardcore regardless of filename', () => {
        // Arrange
        const filePath = '/test/SharedStashSoftcoreV2.d2i';

        // Act
        const result = (monitor as any).getSaveNameFromPath(filePath, true);

        // Assert
        expect(result).toBe('Shared Stash Hardcore'); // Uses parameter, not filename
      });
    });

    describe('If getSaveNameFromPath is called with hardcore=false parameter', () => {
      it('Then should return Shared Stash Softcore regardless of filename', () => {
        // Arrange
        const filePath = '/test/SharedStashHardcoreV2.d2i';

        // Act
        const result = (monitor as any).getSaveNameFromPath(filePath, false);

        // Assert
        expect(result).toBe('Shared Stash Softcore'); // Uses parameter, not filename
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
      const items = await (monitor as any).parseSave('TestChar', Buffer.from('test'), '.d2s');

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
      const items = await (monitor as any).parseSave('TestChar', Buffer.from('test'), '.d2s');

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
      const items = await (monitor as any).parseSave('TestChar', Buffer.from('test'), '.d2s');

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
      const items = await (monitor as any).parseSave('TestChar', Buffer.from('test'), '.d2s');

      // Assert - should have no runeword items
      const runewordItems = items.filter((item: any) => item.type === 'runeword');
      expect(runewordItems).toHaveLength(0);
    });
  });
});
