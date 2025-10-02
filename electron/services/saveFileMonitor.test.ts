/** biome-ignore-all lint/suspicious/noExplicitAny: This file is testing private methods */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

    // Create monitor instance
    monitor = new SaveFileMonitor(mockDatabase as any);
  });

  describe('If constructor is called', () => {
    it('Then should initialize with default values', () => {
      // Arrange & Act
      const newMonitor = new SaveFileMonitor();

      // Assert
      expect(newMonitor).toBeInstanceOf(SaveFileMonitor);
      expect(newMonitor.isCurrentlyMonitoring()).toBe(false);
      // The save directory will be initialized to the platform default
      expect(newMonitor.getSaveDirectory()).toBeTruthy();
    });

    it('Then should initialize with database', () => {
      // Arrange & Act
      const newMonitor = new SaveFileMonitor(mockDatabase as any);

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
    it('Then should return Windows path on win32', () => {
      // Arrange
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.mocked(app.getPath).mockReturnValue('C:\\Users\\test\\Documents');

      // Act
      const path = monitor.getDefaultDirectory();

      // Assert
      expect(path).toContain('Diablo II Resurrected');
      expect(app.getPath).toHaveBeenCalledWith('documents');
    });

    it('Then should return macOS path on darwin', () => {
      // Arrange
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      vi.mocked(app.getPath).mockReturnValue('/Users/test');

      // Act
      const path = monitor.getDefaultDirectory();

      // Assert
      expect(path).toContain('Library');
      expect(path).toContain('Application Support');
      expect(path).toContain('Blizzard Entertainment');
      expect(app.getPath).toHaveBeenCalledWith('home');
    });

    it('Then should return Linux path on other platforms', () => {
      // Arrange
      Object.defineProperty(process, 'platform', { value: 'linux' });
      vi.mocked(app.getPath).mockReturnValue('/home/test');

      // Act
      const path = monitor.getDefaultDirectory();

      // Assert
      expect(path).toContain('.wine');
      expect(path).toContain('drive_c');
      expect(path).toContain('Saved Games');
      expect(app.getPath).toHaveBeenCalledWith('home');
    });
  });

  describe('If startMonitoring is called', () => {
    it('Then should emit error when directory does not exist', async () => {
      // Arrange
      vi.mocked(existsSync).mockReturnValue(false);

      const eventSpy = vi.fn();
      monitor.on('monitoring-error', eventSpy);

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
      monitor.on('monitoring-started', eventSpy);

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
      monitor.on('monitoring-stopped', eventSpy);

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
      const newMonitor = new SaveFileMonitor();

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
        .inHell()
        .asHardcore()
        .asExpansion()
        .withName('AmazonTest')
        .withPath('/path/to/amazon.d2s')
        .build();

      const barbarianSaveFile = D2SaveFileBuilder.new()
        .asBarbarian()
        .atLevel(90)
        .inNightmare()
        .asSoftcore()
        .asClassic()
        .withName('BarbarianTest')
        .withPath('/path/to/barbarian.d2s')
        .build();

      // Act & Assert
      expect(amazonSaveFile.characterClass).toBe('Amazon');
      expect(amazonSaveFile.level).toBe(85);
      expect(amazonSaveFile.difficulty).toBe('hell');
      expect(amazonSaveFile.hardcore).toBe(true);
      expect(amazonSaveFile.expansion).toBe(true);

      expect(barbarianSaveFile.characterClass).toBe('Barbarian');
      expect(barbarianSaveFile.level).toBe(90);
      expect(barbarianSaveFile.difficulty).toBe('nightmare');
      expect(barbarianSaveFile.hardcore).toBe(false);
      expect(barbarianSaveFile.expansion).toBe(false);
    });

    it('Then should work with multiple save files using buildMany', async () => {
      // Arrange
      const saveFiles = D2SaveFileBuilder.new()
        .asSorceress()
        .atLevel(80)
        .inHell()
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
        expect(saveFile.difficulty).toBe('hell');
        expect(saveFile.hardcore).toBe(true);
        expect(saveFile.expansion).toBe(true);
      });
    });
  });
});
