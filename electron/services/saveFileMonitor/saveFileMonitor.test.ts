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

// Mock chokidar
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      close: vi.fn(),
    })),
  },
}));

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
  },
}));

import { chmodSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import { app } from 'electron';
import { D2SaveFileBuilder } from '@/fixtures';
import { GameMode, type ParsedInventoryItem, type SaveFileEvent } from '../../types/grail';
import * as d2sConstants from '../d2s/constants';
import { EventBus } from '../EventBus';
import { createItemFingerprint, normalizeInventoryItem } from '../itemNormalizer';
import * as modernStashParser from '../modernStashParser';
import { SaveFileMonitor } from './saveFileMonitor';
import * as saveFileParser from './saveFileParser';
import { parseSaveContent } from './saveFileParser';
import { createPresenceIdentityKey } from './vaultPresenceReconciler';

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

/** Makes `processSingleFile` return the given results, one per parsed file in call order. */
const mockParseResults = (target: SaveFileMonitor, results: unknown[]) => {
  const spy = vi.spyOn(target as any, 'processSingleFile');
  for (const result of results) {
    spy.mockResolvedValueOnce(result);
  }
  return spy;
};

/** Fake chokidar watcher that records `on` handlers so tests can trigger events such as 'ready'. */
const createFakeWatcher = (watched: Record<string, string[]>) => {
  const handlers = new Map<string, () => void>();
  const watcher = {
    closed: false,
    on: vi.fn(function (this: unknown, event: string, handler: () => void) {
      handlers.set(event, handler);
      return this;
    }),
    close: vi.fn(),
    getWatched: vi.fn(() => watched),
  };
  vi.spyOn(chokidar, 'watch').mockImplementation(() => watcher as unknown as FSWatcher);
  return { watcher, handlers };
};

describe('When SaveFileMonitor is used', () => {
  let monitor: SaveFileMonitor;
  let mockDatabase: MockGrailDatabase;
  let eventBus: EventBus;
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
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

    it('Then should ensure the D2S constants are registered', () => {
      // Arrange
      // Spies on the shared constants module instead of the mocked d2s registry: which registry
      // the module is bound to depends on which test file loaded it first (isolate:false).
      const ensureSpy = vi.spyOn(d2sConstants, 'ensureD2sConstants');

      // Act
      const newMonitor = new SaveFileMonitor(new EventBus(), mockDatabase as any);

      // Assert
      expect(newMonitor).toBeInstanceOf(SaveFileMonitor);
      expect(ensureSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the tick reader is started', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('Then construction starts no timer and start runs exactly one until shutdown', async () => {
      // Arrange
      vi.useFakeTimers();
      const newMonitor = new SaveFileMonitor(new EventBus(), mockDatabase as any);
      const timersAfterConstruction = vi.getTimerCount();

      // Act
      newMonitor.start();
      newMonitor.start();
      const timersAfterStart = vi.getTimerCount();
      await newMonitor.shutdown();

      // Assert
      expect(timersAfterConstruction).toBe(0);
      expect(timersAfterStart).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
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
      // A path under a fresh temp dir that is never created, so it cannot exist on any machine.
      const parentDir = await mkdtemp(join(tmpdir(), 'arcane-missing-parent-'));
      tempDirs.push(parentDir);
      const missingDir = join(parentDir, 'does-not-exist');
      vi.mocked(mockDatabase.getAllSettings).mockReturnValue({
        saveDir: missingDir,
        gameMode: GameMode.Softcore,
      });
      const eventSpy = vi.fn();
      eventBus.on('monitoring-error', eventSpy);

      // Act
      await monitor.startMonitoring();

      // Assert
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith({
        type: 'directory-not-found',
        message: `Save directory does not exist: ${missingDir}`,
        directory: missingDir,
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
      const watchSpy = vi
        .spyOn(chokidar, 'watch')
        .mockImplementation(
          () => ({ on: vi.fn().mockReturnThis(), close: vi.fn() }) as unknown as FSWatcher,
        );
      const startedSpy = vi.fn();
      eventBus.on('monitoring-started', startedSpy);

      // Act
      await monitor.startMonitoring();

      // Assert
      expect(watchSpy).toHaveBeenCalledTimes(1);
      expect(monitor.isCurrentlyMonitoring()).toBe(true);
      expect(startedSpy).toHaveBeenCalledWith(expect.objectContaining({ saveFileCount: 0 }));
    });

    it('Then should report the watched paths once the watcher is ready', async () => {
      // Arrange
      const watchedDir = await mkdtemp(join(tmpdir(), 'arcane-ready-'));
      tempDirs.push(watchedDir);
      vi.mocked(mockDatabase.getAllSettings).mockReturnValue({
        saveDir: watchedDir,
        gameMode: GameMode.Softcore,
      });
      const { watcher: fakeWatcher, handlers } = createFakeWatcher({
        [watchedDir]: ['a.d2s', 'b.d2s'],
      });
      await monitor.startMonitoring();

      // Act
      handlers.get('ready')?.();

      // Assert
      expect(fakeWatcher.getWatched).toHaveBeenCalledTimes(1);
    });

    it('Then should not query a watcher that was closed before it became ready', async () => {
      // Arrange
      const watchedDir = await mkdtemp(join(tmpdir(), 'arcane-ready-closed-'));
      tempDirs.push(watchedDir);
      vi.mocked(mockDatabase.getAllSettings).mockReturnValue({
        saveDir: watchedDir,
        gameMode: GameMode.Softcore,
      });
      const { watcher: fakeWatcher, handlers } = createFakeWatcher({});
      await monitor.startMonitoring();
      fakeWatcher.closed = true;

      // Act
      handlers.get('ready')?.();

      // Assert
      expect(fakeWatcher.getWatched).not.toHaveBeenCalled();
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
      const watchSpy = vi.spyOn(chokidar, 'watch');
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
      const watchSpy = vi.spyOn(chokidar, 'watch');

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

  describe('If start and stop are requested while another is in flight', () => {
    interface Deferred<T> {
      promise: Promise<T>;
      resolve: (value: T) => void;
    }
    const createDeferred = <T>(): Deferred<T> => {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    };

    let originalWatch: unknown;
    let closeSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const saveDir = await mkdtemp(join(tmpdir(), 'arcane-serial-'));
      tempDirs.push(saveDir);
      vi.mocked(mockDatabase.getAllSettings).mockReturnValue({
        saveDir,
        gameMode: GameMode.Softcore,
      });
      originalWatch = (chokidar as any).watch;
      closeSpy = vi.fn().mockResolvedValue(undefined);
      (chokidar as any).watch = vi.fn(() => ({ on: vi.fn().mockReturnThis(), close: closeSpy }));
    });

    afterEach(() => {
      (chokidar as any).watch = originalWatch;
    });

    it('When a stop is requested during the initial parse, Then monitoring ends up stopped', async () => {
      // Arrange
      const parse = createDeferred<boolean>();
      const parseSpy = vi.fn(() => parse.promise);
      (monitor as any).parseSaveDirectory = parseSpy;
      const start = monitor.startMonitoring();
      await vi.waitFor(() => expect(parseSpy).toHaveBeenCalledTimes(1));

      // Act
      const stop = monitor.stopMonitoring();
      parse.resolve(true);
      await Promise.all([start, stop]);

      // Assert
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('When a start is requested while a stop is closing the watcher, Then monitoring ends up started', async () => {
      // Arrange
      (monitor as any).parseSaveDirectory = vi.fn().mockResolvedValue(true);
      await monitor.startMonitoring();
      const close = createDeferred<undefined>();
      closeSpy.mockReturnValueOnce(close.promise);
      const stop = monitor.stopMonitoring();
      await vi.waitFor(() => expect(closeSpy).toHaveBeenCalledTimes(1));

      // Act
      const resume = monitor.startMonitoring();
      close.resolve(undefined);
      await Promise.all([stop, resume]);

      // Assert
      expect(monitor.isCurrentlyMonitoring()).toBe(true);
    });

    it('When stopMonitoringIfActive is called during the initial parse, Then monitoring ends up stopped', async () => {
      // Arrange
      const parse = createDeferred<boolean>();
      const parseSpy = vi.fn(() => parse.promise);
      (monitor as any).parseSaveDirectory = parseSpy;
      const start = monitor.startMonitoring();
      await vi.waitFor(() => expect(parseSpy).toHaveBeenCalledTimes(1));

      // Act
      const stop = monitor.stopMonitoringIfActive();
      parse.resolve(true);
      await Promise.all([start, stop]);

      // Assert
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
    });

    it('When stopMonitoringIfActive is called while not monitoring, Then no stopped event is emitted', async () => {
      // Arrange
      const stoppedSpy = vi.fn();
      eventBus.on('monitoring-stopped', stoppedSpy);

      // Act
      await monitor.stopMonitoringIfActive();

      // Assert
      expect(stoppedSpy).not.toHaveBeenCalled();
    });

    it('When an operation fails, Then later operations still run', async () => {
      // Arrange
      (monitor as any).parseSaveDirectory = vi
        .fn()
        .mockRejectedValueOnce(new Error('parse crashed'))
        .mockResolvedValue(true);
      await expect(monitor.startMonitoring()).rejects.toThrow('parse crashed');

      // Act
      await monitor.startMonitoring();

      // Assert
      expect(monitor.isCurrentlyMonitoring()).toBe(true);
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
      // A directory named like a save file is listed but cannot be read as a file.
      const saveDir = await mkdtemp(join(tmpdir(), 'arcane-unparsable-'));
      tempDirs.push(saveDir);
      await mkdir(join(saveDir, 'Broken.d2s'));
      vi.mocked(mockDatabase.getAllSettings).mockReturnValue({
        saveDir,
        gameMode: GameMode.Softcore,
      });
      await (monitor as any).initializeSaveDirectories();
      const brokenPath = join(saveDir, 'Broken.d2s');
      const parseSpy = vi.spyOn(monitor as any, 'parseSaveFile');

      // Act
      const files = await monitor.getSaveFiles();

      // Assert
      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(parseSpy).toHaveBeenCalledWith(brokenPath);
      await expect(parseSpy.mock.results[0]?.value).resolves.toBeNull();
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

    it('When the game mode is Manual, Then should not start monitoring', async () => {
      // Arrange
      mockDatabase.getAllSettings.mockReturnValue({
        saveDir: '/test/save/dir',
        gameMode: GameMode.Manual,
      });
      const startSpy = vi.spyOn(monitor, 'startMonitoring');

      // Act
      await monitor.updateSaveDirectory();

      // Assert
      expect(startSpy).not.toHaveBeenCalled();
      expect(monitor.isCurrentlyMonitoring()).toBe(false);
      expect(monitor.getSaveDirectory()).toBe('/test/save/dir');
    });

    it('When the game mode is Manual and monitoring is active, Then should stop it without restarting', async () => {
      // Arrange
      mockDatabase.getAllSettings.mockReturnValue({
        saveDir: '/test/save/dir',
        gameMode: GameMode.Manual,
      });
      const stopSpy = vi.spyOn(monitor, 'stopMonitoring');
      const startSpy = vi.spyOn(monitor, 'startMonitoring');
      (monitor as any).isMonitoring = true;

      // Act
      await monitor.updateSaveDirectory();

      // Assert
      expect(stopSpy).toHaveBeenCalledOnce();
      expect(startSpy).not.toHaveBeenCalled();
    });
  });

  describe('If shutdown is called', () => {
    it('Then should stop monitoring', async () => {
      // Arrange
      await monitor.startMonitoring();

      const stopSpy = vi.spyOn(monitor, 'stopMonitoring');

      // Act
      await monitor.shutdown();

      // Assert
      expect(stopSpy).toHaveBeenCalled();
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
      monitor.start();
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
      (monitor as any).isMonitoring = true;

      // Act - request a forced parse without advancing time
      await monitor.refreshSaveFiles();

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

  describe('When a manual refresh is requested', () => {
    let monitor: SaveFileMonitor;
    let mockDatabase: MockGrailDatabase;
    let eventBus: EventBus;

    const startWatching = (target: SaveFileMonitor) => {
      (target as any).isMonitoring = true;
      (target as any).watchPath = '/test/saves';
    };

    beforeEach(() => {
      vi.useFakeTimers();
      eventBus = new EventBus();
      mockDatabase = createMockDatabase();
      mockDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Softcore,
        saveDir: '/test/saves',
      });
      mockDatabase.getAllSaveFileStates.mockReturnValue([]);
      monitor = new SaveFileMonitor(eventBus, mockDatabase as any);
      // Runs the tick reader every 500 ms; the monitor's shutdown() in afterEach stops it.
      monitor.start();
      vi.spyOn(monitor as any, 'findExistingSaveDirectories').mockResolvedValue(['/test/saves']);
    });

    afterEach(async () => {
      await monitor.shutdown();
      vi.useRealTimers();
    });

    describe('If manual game mode is active', () => {
      it('Then the refresh resolves without parsing and does not leave the force flag set', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          gameMode: GameMode.Manual,
          saveDir: '/test/saves',
        });
        const parseAllSpy = vi.spyOn(monitor as any, 'parseAllSaveDirectories');
        startWatching(monitor);

        // Act
        await monitor.refreshSaveFiles();

        // Assert
        expect(parseAllSpy).not.toHaveBeenCalled();
        expect((monitor as any).forceParseAll).toBe(false);
        expect((monitor as any).pendingForcedParse).toBeUndefined();
      });
    });

    describe('If manual mode is left after a skipped refresh', () => {
      it('Then the next change-driven parse is not forced', async () => {
        // Arrange
        mockDatabase.getAllSettings.mockReturnValue({
          gameMode: GameMode.Manual,
          saveDir: '/test/saves',
        });
        startWatching(monitor);
        await monitor.refreshSaveFiles();
        mockDatabase.getAllSettings.mockReturnValue({
          gameMode: GameMode.Softcore,
          saveDir: '/test/saves',
        });
        const forcedDuringParse: boolean[] = [];
        vi.spyOn(monitor as any, 'parseAllSaveDirectories').mockImplementation(async () => {
          forcedDuringParse.push((monitor as any).forceParseAll);
          return true;
        });
        (monitor as any).fileChangeCounter++;
        (monitor as any).lastFileChangeTime = Date.now();

        // Act
        await vi.advanceTimersByTimeAsync(1500);

        // Assert
        expect(forcedDuringParse).toEqual([false]);
      });
    });

    describe('If the save directory holds no save files', () => {
      it('Then the refresh resolves and the force flag is reset', async () => {
        // Arrange
        const emptyDir = mkdtempSync(join(tmpdir(), 'arcane-refresh-empty-'));
        tempDirs.push(emptyDir);
        vi.spyOn(monitor as any, 'findExistingSaveDirectories').mockResolvedValue([emptyDir]);
        const parseFilesSpy = vi.spyOn(monitor as any, 'parseFiles');
        startWatching(monitor);

        // Act
        await monitor.refreshSaveFiles();

        // Assert
        expect(parseFilesSpy).not.toHaveBeenCalled();
        expect((monitor as any).forceParseAll).toBe(false);
        expect((monitor as any).readingFiles).toBe(false);
      });
    });

    describe('If no grail database is available', () => {
      it('Then the refresh resolves without parsing', async () => {
        // Arrange
        const monitorWithoutDatabase = new SaveFileMonitor(eventBus);
        const parseAllSpy = vi.spyOn(monitorWithoutDatabase as any, 'parseAllSaveDirectories');
        startWatching(monitorWithoutDatabase);

        // Act
        await monitorWithoutDatabase.refreshSaveFiles();

        // Assert
        expect(parseAllSpy).not.toHaveBeenCalled();
        expect((monitorWithoutDatabase as any).forceParseAll).toBe(false);
        await monitorWithoutDatabase.shutdown();
      });
    });

    describe('If the forced parse fails', () => {
      it('Then the refresh rejects and the monitor can parse again', async () => {
        // Arrange
        vi.spyOn(monitor as any, 'parseAllSaveDirectories').mockRejectedValue(
          new Error('disk error'),
        );
        startWatching(monitor);

        // Act
        const refresh = monitor.refreshSaveFiles();

        // Assert
        await expect(refresh).rejects.toThrow('disk error');
        expect((monitor as any).forceParseAll).toBe(false);
        expect((monitor as any).readingFiles).toBe(false);
      });
    });

    describe('If the forced parse succeeds', () => {
      it('Then every file is parsed as forced and the emitted events are not silent', async () => {
        // Arrange
        const saveDir = mkdtempSync(join(tmpdir(), 'arcane-refresh-'));
        tempDirs.push(saveDir);
        const heroPath = join(saveDir, 'Hero.d2s');
        writeFileSync(heroPath, Buffer.from('mock'));
        vi.spyOn(monitor as any, 'findExistingSaveDirectories').mockResolvedValue([saveDir]);
        // The stored state is newer than the file, so only a forced parse reads it again.
        mockDatabase.getSaveFileState.mockReturnValue({
          lastModified: new Date('2999-01-01'),
        });
        (monitor as any).inventorySnapshots = [{ sourceFilePath: heroPath }];
        const forcedDuringParse: boolean[] = [];
        const parseFiles = (monitor as any).parseFiles.bind(monitor);
        vi.spyOn(monitor as any, 'parseFiles').mockImplementation(async (...args: unknown[]) => {
          forcedDuringParse.push((monitor as any).forceParseAll);
          return parseFiles(...args);
        });
        const events: Array<{ silent?: boolean }> = [];
        eventBus.on('save-file-event', (event) => {
          events.push(event);
        });
        startWatching(monitor);

        // Act
        await monitor.refreshSaveFiles();

        // Assert
        expect(forcedDuringParse).toEqual([true]);
        expect(events).toHaveLength(1);
        expect(events[0].silent).toBe(false);
        expect((monitor as any).forceParseAll).toBe(false);
      });
    });

    describe('If reading the settings fails before the parse starts', () => {
      it('Then the refresh rejects instead of waiting forever', async () => {
        // Arrange
        startWatching(monitor);
        mockDatabase.getAllSettings.mockImplementation(() => {
          throw new Error('database is locked');
        });

        // Act
        const refresh = monitor.refreshSaveFiles();

        // Assert
        await expect(refresh).rejects.toThrow('database is locked');
        expect((monitor as any).pendingForcedParse).toBeUndefined();
      });
    });

    describe('If a refresh is requested while files are already being read', () => {
      it('Then the refresh waits for its own forced parse after the running one', async () => {
        // Arrange
        let finishRunningParse: () => void = () => undefined;
        const forcedDuringParse: boolean[] = [];
        vi.spyOn(monitor as any, 'parseAllSaveDirectories').mockImplementation(async () => {
          forcedDuringParse.push((monitor as any).forceParseAll);
          if (forcedDuringParse.length === 1) {
            await new Promise<void>((resolve) => {
              finishRunningParse = resolve;
            });
          }
          return true;
        });
        startWatching(monitor);
        (monitor as any).fileChangeCounter++;
        await vi.advanceTimersByTimeAsync(1500);
        let refreshed = false;

        // Act
        const refresh = monitor.refreshSaveFiles().then(() => {
          refreshed = true;
        });
        await vi.advanceTimersByTimeAsync(0);
        const refreshedBeforeRunningParseEnded = refreshed;
        finishRunningParse();
        await vi.advanceTimersByTimeAsync(1000);
        await refresh;

        // Assert
        expect(refreshedBeforeRunningParseEnded).toBe(false);
        expect(forcedDuringParse).toEqual([false, true]);
      });
    });

    describe('If the monitor shuts down before a requested refresh runs', () => {
      it('Then the refresh resolves', async () => {
        // Arrange
        startWatching(monitor);
        (monitor as any).readingFiles = true;
        const refresh = monitor.refreshSaveFiles();

        // Act
        await monitor.shutdown();

        // Assert
        await expect(refresh).resolves.toBeUndefined();
      });
    });

    describe('If a refresh is requested while the file watcher is closing during shutdown', () => {
      it('Then the refresh still settles once the shutdown completes', async () => {
        // Arrange
        let finishClosing: () => void = () => undefined;
        const closing = new Promise<void>((resolve) => {
          finishClosing = resolve;
        });
        (monitor as any).fileWatcher = { close: vi.fn(() => closing) };
        startWatching(monitor);
        (monitor as any).readingFiles = true;
        let refreshSettled = false;

        // Act
        const shutdown = monitor.shutdown();
        const refresh = monitor.refreshSaveFiles().then(
          () => {
            refreshSettled = true;
          },
          () => {
            refreshSettled = true;
          },
        );
        finishClosing();
        await shutdown;
        await vi.advanceTimersByTimeAsync(1000);

        // Assert
        expect(refreshSettled).toBe(true);
        await refresh;
        expect((monitor as any).pendingForcedParse).toBeUndefined();
      });
    });

    describe('If the file watcher fails to close during shutdown while a refresh is queued', () => {
      it('Then the refresh still settles and the shutdown rejects with the close error', async () => {
        // Arrange
        const closeError = new Error('watcher close failed');
        (monitor as any).fileWatcher = {
          close: vi.fn().mockRejectedValueOnce(closeError).mockResolvedValue(undefined),
        };
        startWatching(monitor);
        (monitor as any).readingFiles = true;
        let refreshSettled = false;

        // Act
        const shutdown = monitor.shutdown();
        const shutdownOutcome = shutdown.then(
          () => undefined,
          (error: unknown) => error,
        );
        const refresh = monitor.refreshSaveFiles().then(
          () => {
            refreshSettled = true;
          },
          () => {
            refreshSettled = true;
          },
        );
        const error = await shutdownOutcome;
        await vi.advanceTimersByTimeAsync(1000);

        // Assert
        expect(error).toBe(closeError);
        expect(refreshSettled).toBe(true);
        await refresh;
        expect((monitor as any).pendingForcedParse).toBeUndefined();
      });
    });

    describe('If monitoring is stopped while a refresh is queued behind a running read', () => {
      it('Then the refresh resolves on the next tick without parsing', async () => {
        // Arrange
        const parseAllSpy = vi.spyOn(monitor as any, 'parseAllSaveDirectories');
        startWatching(monitor);
        (monitor as any).readingFiles = true;
        let refreshed = false;
        const refresh = monitor.refreshSaveFiles().then(() => {
          refreshed = true;
        });
        await vi.advanceTimersByTimeAsync(0);
        const refreshedWhileMonitoring = refreshed;

        // Act
        await monitor.stopMonitoring();
        await vi.advanceTimersByTimeAsync(500);
        await refresh;

        // Assert
        expect(refreshedWhileMonitoring).toBe(false);
        expect(refreshed).toBe(true);
        expect(parseAllSpy).not.toHaveBeenCalled();
        expect((monitor as any).pendingForcedParse).toBeUndefined();
      });
    });

    describe('If refreshes are requested concurrently behind a running read', () => {
      it('Then they share one forced parse request and both settle after a single forced parse', async () => {
        // Arrange
        const forcedDuringParse: boolean[] = [];
        vi.spyOn(monitor as any, 'parseAllSaveDirectories').mockImplementation(async () => {
          forcedDuringParse.push((monitor as any).forceParseAll);
          return true;
        });
        startWatching(monitor);
        (monitor as any).readingFiles = true;

        // Act
        const first = monitor.refreshSaveFiles();
        const requestAfterFirst = (monitor as any).pendingForcedParse;
        const second = monitor.refreshSaveFiles();
        const requestAfterSecond = (monitor as any).pendingForcedParse;
        (monitor as any).readingFiles = false;
        await vi.advanceTimersByTimeAsync(500);
        await Promise.all([first, second]);

        // Assert
        expect(requestAfterFirst).toBeDefined();
        expect(requestAfterSecond).toBe(requestAfterFirst);
        expect(forcedDuringParse).toEqual([true]);
        expect((monitor as any).pendingForcedParse).toBeUndefined();
      });
    });
  });

  describe('When stash header parsing is used', () => {
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
  });

  describe('When runeword parsing validates names', () => {
    const readSoftcoreGameMode = () => GameMode.Softcore;

    beforeEach(() => {
      vi.clearAllMocks();
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
      const { items } = await parseSaveContent(
        {
          saveName: 'TestChar',
          filePath: 'TestChar.d2s',
          content: Buffer.from('test'),
          extension: '.d2s',
        },
        readSoftcoreGameMode,
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
      const { items } = await parseSaveContent(
        {
          saveName: 'TestChar',
          filePath: 'TestChar.d2s',
          content: Buffer.from('test'),
          extension: '.d2s',
        },
        readSoftcoreGameMode,
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
      const { items } = await parseSaveContent(
        {
          saveName: 'TestChar',
          filePath: 'TestChar.d2s',
          content: Buffer.from('test'),
          extension: '.d2s',
        },
        readSoftcoreGameMode,
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
      const { items } = await parseSaveContent(
        {
          saveName: 'TestChar',
          filePath: 'TestChar.d2s',
          content: Buffer.from('test'),
          extension: '.d2s',
        },
        readSoftcoreGameMode,
      );

      // Assert - should have no runeword items
      const runewordItems = items.filter((item: any) => item.type === 'runeword');
      expect(runewordItems).toHaveLength(0);
    });
  });

  describe('If spatial inventory parsing is executed', () => {
    it('Then createParsedInventoryItem maps spatial metadata and prefers canonical grail filename over parser inv_file', () => {
      // Arrange
      const item = {
        name: 'Battle Hammer',
        unique_name: 'Harlequin Crest',
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
      const parsed = normalizeInventoryItem({
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
      const item = {
        name: 'Shako',
        type: 'helm',
        code: 'uap',
        quality: 5,
        inv_file: 'invhamm',
      } as any;

      // Act
      const parsed = normalizeInventoryItem({
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
      const parsed = normalizeInventoryItem({
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
      const parsed = normalizeInventoryItem({
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
      const parsed = normalizeInventoryItem({
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
      const parsed = normalizeInventoryItem({
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
      const inBoundsParsed = normalizeInventoryItem({
        filePath: '/tmp/TestChar.d2s',
        saveName: 'TestChar',
        sourceFileType: 'd2s',
        item: inBoundsItem,
        fallbackLocation: 'inventory',
      });
      const outOfBoundsParsed = normalizeInventoryItem({
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
      const item = {
        type: 'misc',
        quality: 1,
        type_name: 'Grand Charm',
      } as any;

      // Act
      const parsed = normalizeInventoryItem({
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
      const createParsedInventoryItem = normalizeInventoryItem;
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
      mockParseResults(monitor, [
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
      const processSpy = mockParseResults(monitor, [
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
      expect(processSpy).toHaveBeenCalledTimes(2);
      expect(emitSpy).toHaveBeenCalledWith([
        expect.objectContaining({ saveName: 'A' }),
        expect.objectContaining({ saveName: 'B' }),
      ]);
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
      mockParseResults(monitor, [
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
      mockParseResults(monitor, [{ saveName: 'A', success: false, inventorySnapshot: undefined }]);
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
      mockParseResults(monitor, [
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
      vi.spyOn(saveFileParser, 'parseSaveContent').mockResolvedValueOnce({
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
      } as any);
      vi.spyOn(monitor as any, 'updateSaveFileState').mockResolvedValue(undefined);

      // Act
      const parseResult = await (monitor as any).processSingleFile(savePath);
      rmSync(saveDir, { recursive: true, force: true });

      // Assert
      expect(parseResult.presentFingerprints).toEqual(['fp-parent', 'fp-socketed']);
      expect(parseResult.inventorySnapshot?.items).toHaveLength(1);
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
      vi.spyOn(saveFileParser, 'parseSaveContent').mockResolvedValueOnce({
        status: 'parsed',
        items: parsedItems,
      } as any);
      vi.spyOn(monitor as any, 'updateSaveFileState').mockResolvedValue(undefined);

      // Act
      const parseResult = await (monitor as any).processSingleFile(savePath);
      rmSync(saveDir, { recursive: true, force: true });

      // Assert
      expect(parseResult.presentIdentityKeys).toEqual(
        parsedItems.map((item) => createPresenceIdentityKey(item as any)),
      );
      expect(parseResult.presentIdentityKeys).toHaveLength(parseResult.presentFingerprints.length);
    });

    it('Then createItemFingerprint returns deterministic output for the same inputs', () => {
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
      } as unknown as ParsedInventoryItem;

      // Act
      const first = createItemFingerprint(item);
      const second = createItemFingerprint(item);

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
      const { items: parsedItems } = await parseSaveContent(
        {
          saveName: 'Shared Stash Softcore',
          filePath: MODERN_STASH_FIXTURE_PATH,
          content: fixtureBuffer,
          extension: '.d2i',
        },
        () => GameMode.Softcore,
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
      vi.spyOn(saveFileParser, 'parseSaveContent').mockResolvedValueOnce({
        items: [],
        status: 'parsed',
      });
      vi.spyOn(monitor as any, 'updateSaveFileState').mockResolvedValue(undefined);

      // Act
      const parseResult = await (monitor as any).processSingleFile(MODERN_STASH_FIXTURE_PATH);

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
      vi.spyOn(saveFileParser, 'parseSaveContent').mockResolvedValueOnce({
        status: 'parsed',
        items: [
          {
            itemName: 'Shako',
            characterName: 'Hero',
            isSocketedItem: false,
            rawParsedItem: { name: 'Shako' },
          },
        ],
      } as any);
      vi.spyOn(monitor as any, 'updateSaveFileState').mockResolvedValue(undefined);

      // Act
      const parseResult = await (monitor as any).processSingleFile(savePath);
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
        const processSpy = vi.spyOn(saveFileParser, 'parseSaveContent');

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
        const parseSaveSpy = vi.spyOn(saveFileParser, 'parseSaveContent');

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
        const parseSaveSpy = vi.spyOn(saveFileParser, 'parseSaveContent');

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

  describe('When parsed save files are announced', () => {
    let saveDir: string;
    let events: SaveFileEvent[];

    beforeEach(() => {
      saveDir = mkdtempSync(join(tmpdir(), 'save-monitor-events-'));
      events = [];
      eventBus.on('save-file-event', (event) => {
        events.push(event);
      });
      mockDatabase.getAllSettings.mockReturnValue({
        saveDir,
        gameMode: GameMode.Both,
      });
    });

    afterEach(() => {
      rmSync(saveDir, { recursive: true, force: true });
    });

    describe('If a character save is parsed', () => {
      it('Then the event carries the parsed items and the header read from the same content', async () => {
        // Arrange
        const header = Buffer.alloc(800);
        header.writeUInt8(0x24, 36); // hardcore + expansion
        header.writeUInt8(1, 40); // sorceress
        header.writeUInt8(85, 43);
        const filePath = join(saveDir, 'Hero.d2s');
        writeFileSync(filePath, header);
        vi.mocked(d2s.read).mockResolvedValue({
          header: { status: { hardcore: true } },
          items: [{ type: 'uap', unique_name: 'Shako' }],
          merc_items: [],
          corpse_items: [],
        } as any);
        const parseSaveFileSpy = vi.spyOn(monitor as any, 'parseSaveFile');

        // Act
        await (monitor as any).parseFiles([filePath], false);

        // Assert
        expect(parseSaveFileSpy).not.toHaveBeenCalled();
        expect(events).toHaveLength(1);
        expect(events[0].file).toEqual(
          expect.objectContaining({
            name: 'Hero',
            path: filePath,
            characterClass: 'sorceress',
            level: 85,
            hardcore: true,
            expansion: true,
          }),
        );
        expect(events[0].parsedItems?.map((item) => item.rawParsedItem.unique_name)).toEqual([
          'Shako',
        ]);
      });

      it('Then the stored modification time is the one of the content that was parsed', async () => {
        // Arrange
        const filePath = join(saveDir, 'Hero.d2s');
        writeFileSync(filePath, Buffer.alloc(800));
        const contentTime = new Date('2024-05-01T10:00:00.000Z');
        utimesSync(filePath, contentTime, contentTime);

        // Act
        await (monitor as any).parseFiles([filePath], false);

        // Assert
        expect(mockDatabase.upsertSaveFileState).toHaveBeenCalledWith(
          expect.objectContaining({ filePath, lastModified: contentTime }),
        );
        expect(events[0].file.lastModified).toEqual(contentTime);
      });
    });

    describe('If a legacy shared stash is parsed', () => {
      it('Then the hardcore flag of the event comes from the parsed stash header', async () => {
        // Arrange
        const filePath = join(saveDir, 'SharedStash.sss');
        writeFileSync(filePath, Buffer.alloc(1024));
        vi.mocked(d2stash.read).mockResolvedValue({ hardcore: true, pages: [] } as any);

        // Act
        await (monitor as any).parseFiles([filePath], false);

        // Assert
        expect(vi.mocked(d2stash.read)).toHaveBeenCalledTimes(1);
        expect(events[0].file).toEqual(
          expect.objectContaining({ characterClass: 'shared_stash', hardcore: true }),
        );
      });
    });

    describe('If a modern shared stash is parsed', () => {
      it('Then the event describes the stash with its version and carries its items', async () => {
        // Arrange
        const filePath = join(saveDir, 'ModernSharedStashSoftCoreV2.d2i');
        writeFileSync(filePath, readFileSync(MODERN_STASH_FIXTURE_PATH));

        // Act
        await (monitor as any).parseFiles([filePath], false);

        // Assert
        expect(events[0].file).toEqual(
          expect.objectContaining({
            name: 'Modern Shared Stash Softcore',
            characterClass: 'shared_stash',
            hardcore: false,
            sourceFileVersion: 105,
          }),
        );
        expect(events[0].parsedItems?.length).toBeGreaterThan(0);
      });
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
        const events: SaveFileEvent[] = [];
        eventBus.on('save-file-event', (event) => {
          events.push(event);
        });

        // Act
        await (monitor as any).parseFiles([filePath], false);

        // Assert
        expect(monitor.getAvailableRunesCount()).toEqual({ el: 1 });
        const eventItemCodes = events[0]?.parsedItems?.map((item) => item.rawParsedItem.type);
        expect(eventItemCodes).toEqual(['r01', 'armor', 'r02']);
      });
    });
  });
});
