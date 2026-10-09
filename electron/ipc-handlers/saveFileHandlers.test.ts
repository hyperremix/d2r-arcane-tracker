/** biome-ignore-all lint/suspicious/noExplicitAny: This file is testing private methods */
import type { Mock, MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

import { ipcMain } from 'electron';
import { D2ItemBuilder, D2SaveFileBuilder, D2SItemBuilder, HolyGrailItemBuilder } from '@/fixtures';
import type { GrailDatabase } from '../database/database';
import { createRendererBroadcaster } from '../ipc/broadcast';
import { EventBus } from '../services/EventBus';
import type { GrailProgressService } from '../services/grailProgressService';
import type { ItemDetectionService } from '../services/itemDetection';
import type { SaveFileMonitor } from '../services/saveFileMonitor';
import { SettingsService } from '../services/settingsService';
import {
  GameMode,
  type ItemDetectionEvent,
  type SaveFileEvent,
  type Settings,
} from '../types/grail';
import { initializeSaveFileHandlers as initialize } from './saveFileHandlers';

// Event handlers registered on the fake event bus
const eventHandlers = new Map<string, Array<(...args: any[]) => any>>();

// Settings-updated listeners registered by the handlers
type SettingsUpdatedListener = (settings: Record<string, unknown>) => void | Promise<void>;
const settingsUpdatedListeners: SettingsUpdatedListener[] = [];

const grailDatabase = {
  getAllSettings: vi.fn(),
  setSetting: vi.fn(),
  truncateUserData: vi.fn(),
  transaction: vi.fn((fn: () => unknown) => fn()),
};
/** Settings service whose change listeners the tests call directly, to await their work. */
class TestSettingsService extends SettingsService {
  override onUpdated(listener: (changes: Partial<Settings>) => void): () => void {
    settingsUpdatedListeners.push(listener as SettingsUpdatedListener);
    return vi.fn();
  }
}
const settingsService = new TestSettingsService(
  grailDatabase as unknown as GrailDatabase,
  new EventBus(),
);

// Mock data types
interface MockWebContents {
  isDestroyed: ReturnType<typeof vi.fn>;
  getType: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

interface MockEventBus {
  on: Mock<(...args: any[]) => any>;
  emit: Mock<(...args: any[]) => any>;
  off: Mock<(...args: any[]) => any>;
  clear: Mock<(...args: any[]) => any>;
  listenerCount: Mock<(...args: any[]) => any>;
}

interface MockSaveFileMonitor {
  startMonitoring: ReturnType<typeof vi.fn>;
  stopMonitoring: ReturnType<typeof vi.fn>;
  stopMonitoringIfActive: ReturnType<typeof vi.fn>;
  shutdown: ReturnType<typeof vi.fn>;
  getSaveFiles: ReturnType<typeof vi.fn>;
  isCurrentlyMonitoring: ReturnType<typeof vi.fn>;
  getSaveDirectory: ReturnType<typeof vi.fn>;
  getDefaultDirectory: ReturnType<typeof vi.fn>;
  updateSaveDirectory: ReturnType<typeof vi.fn>;
}

interface MockItemDetectionService {
  analyzeSaveFile: ReturnType<typeof vi.fn>;
}

function createMockEventBus(): MockEventBus {
  return {
    on: vi.fn((event: string, handler: (...args: any[]) => any) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event)?.push(handler);
      return vi.fn(); // Return unsubscribe function
    }),
    emit: vi.fn((event: string, payload: any) => {
      const handlers = eventHandlers.get(event) || [];
      for (const handler of handlers) {
        handler(payload);
      }
    }),
    off: vi.fn(),
    clear: vi.fn(() => {
      eventHandlers.clear();
    }),
    listenerCount: vi.fn((event: string) => {
      return eventHandlers.get(event)?.length || 0;
    }),
  };
}

describe('When saveFileHandlers is used', () => {
  let mockWebContents: MockWebContents[];
  let mockSaveFileMonitor: MockSaveFileMonitor;
  let mockItemDetectionService: MockItemDetectionService;
  let mockEventBus: MockEventBus;
  let mockGrailProgress: { recordSaveFile: ReturnType<typeof vi.fn> };

  const disposers: Array<() => void> = [];

  function initializeSaveFileHandlers() {
    const dispose = initialize({
      database: grailDatabase as unknown as GrailDatabase,
      settings: settingsService,
      eventBus: mockEventBus as unknown as EventBus,
      saveFileMonitor: mockSaveFileMonitor as unknown as SaveFileMonitor,
      itemDetection: mockItemDetectionService as unknown as ItemDetectionService,
      grailProgress: mockGrailProgress as unknown as GrailProgressService,
      broadcastToRenderers: createRendererBroadcaster(() => mockWebContents as any),
    });
    disposers.push(dispose);
    return dispose;
  }

  afterEach(() => {
    // Cancels the pending automatic monitoring start of every initialization
    for (const dispose of disposers.splice(0)) {
      dispose();
    }
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Clear event handlers map
    eventHandlers.clear();
    settingsUpdatedListeners.length = 0;

    mockEventBus = createMockEventBus();
    mockGrailProgress = { recordSaveFile: vi.fn() };

    // Setup mock web contents
    mockWebContents = [
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        getType: vi.fn().mockReturnValue('window'),
        send: vi.fn(),
      },
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        getType: vi.fn().mockReturnValue('window'),
        send: vi.fn(),
      },
    ];

    // Setup mock services
    mockSaveFileMonitor = {
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn(),
      stopMonitoringIfActive: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      getSaveFiles: vi.fn().mockResolvedValue([]),
      isCurrentlyMonitoring: vi.fn().mockReturnValue(false),
      getSaveDirectory: vi.fn().mockReturnValue('/test/save/dir'),
      getDefaultDirectory: vi.fn().mockReturnValue('/default/save/dir'),
      updateSaveDirectory: vi.fn().mockResolvedValue(undefined),
    };

    mockItemDetectionService = {
      analyzeSaveFile: vi.fn().mockResolvedValue([]),
    };

    // Setup default database mocks
    grailDatabase.getAllSettings.mockReturnValue({ saveDir: '/test/save/dir' });
  });

  describe('If initializeSaveFileHandlers is called', () => {
    it('Then it subscribes to the save file, item detection and monitoring events', () => {
      // Act
      initializeSaveFileHandlers();

      // Assert
      expect(mockEventBus.on).toHaveBeenCalledWith('save-file-event', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('monitoring-started', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('monitoring-stopped', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('monitoring-error', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('item-detection', expect.any(Function));
    });

    it('Then should set up IPC handlers', () => {
      // Act
      initializeSaveFileHandlers();

      // Assert
      expect(ipcMain.handle).toHaveBeenCalledWith('saveFile:getSaveFiles', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'saveFile:getMonitoringStatus',
        expect.any(Function),
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'saveFile:updateSaveDirectory',
        expect.any(Function),
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'saveFile:restoreDefaultDirectory',
        expect.any(Function),
      );
    });

    it('When the returned dispose function is called, Then every event subscription is removed', () => {
      // Arrange
      const dispose = initializeSaveFileHandlers();
      const unsubscribers = mockEventBus.on.mock.results.map((result) => result.value);

      // Act
      dispose();

      // Assert
      expect(unsubscribers).toHaveLength(5);
      for (const unsubscribe of unsubscribers) {
        expect(unsubscribe).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('If save-file-event is handled', () => {
    it('Then should forward event to all web contents', () => {
      // Arrange
      const mockEvent: SaveFileEvent = {
        type: 'modified',
        file: D2SaveFileBuilder.new()
          .withName('TestCharacter')
          .withPath('/path/to/test.d2s')
          .build(),
      };

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('save-file-event', mockEvent);

      // Assert
      expect(mockWebContents[0].send).toHaveBeenCalledWith('save-file-event', mockEvent);
      expect(mockWebContents[1].send).toHaveBeenCalledWith('save-file-event', mockEvent);
    });

    it('Then the parsed items stay in the main process and are not sent to renderers', () => {
      // Arrange
      const parsedItems = [{ fingerprint: 'fp-1' }] as unknown as SaveFileEvent['parsedItems'];
      const file = D2SaveFileBuilder.new().withName('TestCharacter').build();
      const mockEvent: SaveFileEvent = { type: 'modified', file, parsedItems, silent: false };

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('save-file-event', mockEvent);

      // Assert
      expect(mockWebContents[0].send).toHaveBeenCalledWith('save-file-event', {
        type: 'modified',
        file,
        silent: false,
      });
      expect(mockItemDetectionService.analyzeSaveFile).toHaveBeenCalledWith(
        file,
        parsedItems,
        false,
        undefined,
      );
    });

    it('Then should skip destroyed web contents', () => {
      // Arrange
      mockWebContents[0].isDestroyed.mockReturnValue(true);
      const mockEvent: SaveFileEvent = {
        type: 'modified',
        file: D2SaveFileBuilder.new().withName('TestCharacter').build(),
      };

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('save-file-event', mockEvent);

      // Assert
      expect(mockWebContents[0].send).not.toHaveBeenCalled();
      expect(mockWebContents[1].send).toHaveBeenCalledWith('save-file-event', mockEvent);
    });

    it('Then should analyze save file for modifications', () => {
      // Arrange
      const mockEvent: SaveFileEvent = {
        type: 'modified',
        file: D2SaveFileBuilder.new()
          .withName('TestCharacter')
          .withPath('/path/to/test.d2s')
          .build(),
      };

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('save-file-event', mockEvent);

      // Assert
      expect(mockItemDetectionService.analyzeSaveFile).toHaveBeenCalledWith(
        mockEvent.file,
        [],
        mockEvent.silent,
        mockEvent.isInitialScan,
      );
    });

    it('Then should not analyze save file for non-modification events', () => {
      // Arrange
      const mockEvent: SaveFileEvent = {
        type: 'created',
        file: D2SaveFileBuilder.new().withName('TestCharacter').build(),
      };

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('save-file-event', mockEvent);

      // Assert
      expect(mockItemDetectionService.analyzeSaveFile).not.toHaveBeenCalled();
    });

    it('Then the character and the items found in the modified save file are recorded together', async () => {
      // Arrange
      const mockSaveFile = D2SaveFileBuilder.new().withName('TestCharacter').build();
      const foundItem = {
        type: 'item-found',
        item: D2ItemBuilder.new().withCharacterName('TestCharacter').build(),
        grailItem: HolyGrailItemBuilder.new().withId('shako').build(),
      } as ItemDetectionEvent;
      mockItemDetectionService.analyzeSaveFile.mockResolvedValue([foundItem]);
      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('save-file-event', { type: 'modified', file: mockSaveFile });

      // Assert
      await vi.waitFor(() =>
        expect(mockGrailProgress.recordSaveFile).toHaveBeenCalledWith(mockSaveFile, [foundItem]),
      );
    });

    it('Then the character of a created save file is recorded without analyzing items', async () => {
      // Arrange
      const mockSaveFile = D2SaveFileBuilder.new().withName('TestCharacter').build();
      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('save-file-event', { type: 'created', file: mockSaveFile });

      // Assert
      await vi.waitFor(() =>
        expect(mockGrailProgress.recordSaveFile).toHaveBeenCalledWith(mockSaveFile, []),
      );
    });
  });

  describe('If item-detection event is handled', () => {
    it('Then should forward event to all web contents', () => {
      // Arrange
      const d2sItem = D2SItemBuilder.new()
        .withId('test-item')
        .asUniqueHelm()
        .withLevel(62)
        .withSocketCount(2)
        .build();

      const mockEvent: ItemDetectionEvent = {
        type: 'item-found',
        item: D2ItemBuilder.new()
          .withId('test-item')
          .withName(d2sItem.name || 'Test Item')
          .withType(d2sItem.type || d2sItem.type_name || d2sItem.code || 'helms')
          .withQuality(d2sItem.quality === 5 ? 'unique' : 'normal')
          .withLevel(d2sItem.level || 62)
          .withEthereal(d2sItem.ethereal === 1)
          .withSockets(d2sItem.socket_count || d2sItem.socketed || 2)
          .withCharacterName('TestCharacter')
          .withLocation(
            d2sItem.location === 'equipped'
              ? 'equipment'
              : d2sItem.location === 'stash'
                ? 'stash'
                : 'inventory',
          )
          .build(),
        grailItem: HolyGrailItemBuilder.new()
          .withId('shako')
          .withName('shako')
          .withType('unique')
          .withArmorSubCategory('helms')
          .build(),
      };

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('item-detection', mockEvent);

      // Assert
      expect(mockWebContents[0].send).toHaveBeenCalledWith('item-detection-event', mockEvent);
      expect(mockWebContents[1].send).toHaveBeenCalledWith('item-detection-event', mockEvent);
    });
  });

  describe('If monitoring status events are handled', () => {
    it('Then should forward monitoring-started event', () => {
      // Arrange
      const mockData = {
        directory: '/test/save/dir',
        saveFileCount: 5,
      };

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('monitoring-started', mockData);

      // Assert
      expect(mockWebContents[0].send).toHaveBeenCalledWith('monitoring-status-changed', {
        status: 'started',
        directory: mockData.directory,
        saveFileCount: mockData.saveFileCount,
      });
    });

    it('Then should forward monitoring-stopped event', () => {
      // Arrange
      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('monitoring-stopped', {});

      // Assert
      expect(mockWebContents[0].send).toHaveBeenCalledWith('monitoring-status-changed', {
        status: 'stopped',
      });
    });

    it('Then should forward monitoring-error event', () => {
      // Arrange
      const mockError = {
        type: 'directory-not-found',
        message: 'Directory not found',
        directory: '/invalid/path',
        saveFileCount: 0,
      };

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('monitoring-error', mockError);

      // Assert
      expect(mockWebContents[0].send).toHaveBeenCalledWith('monitoring-status-changed', {
        status: 'error',
        error: mockError.message,
        errorType: mockError.type,
        directory: mockError.directory,
        saveFileCount: mockError.saveFileCount,
      });
    });
  });

  describe('If IPC handlers are called', () => {
    const originalPlatform = process.platform;
    let consoleSpies: MockInstance[] = [];

    const silenceConsole = (method: 'error' | 'warn') => {
      const spy = vi.spyOn(console, method).mockImplementation(() => undefined);
      consoleSpies.push(spy);
      return spy;
    };

    beforeEach(() => {
      initializeSaveFileHandlers();
    });

    afterEach(() => {
      for (const spy of consoleSpies) {
        spy.mockRestore();
      }
      consoleSpies = [];
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('Then saveFile:getSaveFiles should return save files', async () => {
      // Arrange
      const mockSaveFiles = [
        D2SaveFileBuilder.new().withName('TestChar1').build(),
        D2SaveFileBuilder.new().withName('TestChar2').build(),
      ];
      mockSaveFileMonitor.getSaveFiles.mockResolvedValue(mockSaveFiles as any);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'saveFile:getSaveFiles')?.[1] as any;

      // Act
      const result = await handler();

      // Assert
      expect(result).toEqual(mockSaveFiles);
    });

    it('Then saveFile:getMonitoringStatus should return status', async () => {
      // Arrange
      mockSaveFileMonitor.isCurrentlyMonitoring.mockReturnValue(true);
      mockSaveFileMonitor.getSaveDirectory.mockReturnValue('/test/save/dir');

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'saveFile:getMonitoringStatus')?.[1] as any;

      // Act
      const result = await handler();

      // Assert
      expect(result).toEqual({
        isMonitoring: true,
        directory: '/test/save/dir',
      });
    });

    const getHandler = (channel: string) =>
      vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === channel)?.[1] as any;

    it('Then saveFile:getDefaultDirectory should return the platform default', async () => {
      // Arrange
      mockSaveFileMonitor.getDefaultDirectory.mockReturnValue('/default/save/dir');
      const handler = getHandler('saveFile:getDefaultDirectory');

      // Act
      const result = await handler();

      // Assert
      expect(result).toBe('/default/save/dir');
      expect(grailDatabase.truncateUserData).not.toHaveBeenCalled();
    });

    it('When saveFile:stopMonitoring is invoked, Then the monitor stops and success is reported', async () => {
      // Arrange
      const handler = getHandler('saveFile:stopMonitoring');

      // Act
      const result = await handler(null);

      // Assert
      expect(mockSaveFileMonitor.stopMonitoring).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it('When saveFile:startMonitoring is invoked, Then the monitor starts and success is reported', async () => {
      // Arrange
      const handler = getHandler('saveFile:startMonitoring');
      mockSaveFileMonitor.startMonitoring.mockClear();

      // Act
      const result = await handler(null);

      // Assert
      expect(mockSaveFileMonitor.startMonitoring).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it('If stopping the monitor fails, Then saveFile:stopMonitoring rejects', async () => {
      // Arrange
      silenceConsole('error');
      mockSaveFileMonitor.stopMonitoring.mockRejectedValue(new Error('watcher close failed'));
      const handler = getHandler('saveFile:stopMonitoring');

      // Act & Assert
      await expect(handler(null)).rejects.toThrow('watcher close failed');
    });

    it('Then saveFile:inspectDirectory should reject non-string input without touching settings', async () => {
      // Arrange
      const handler = getHandler('saveFile:inspectDirectory');

      // Act & Assert
      await expect(handler(null, { path: '/new/save/dir' })).rejects.toThrow(
        'Invalid save directory: expected a string',
      );
      expect(grailDatabase.setSetting).not.toHaveBeenCalled();
      expect(mockSaveFileMonitor.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('Then saveFile:inspectDirectory should report a relative path as invalid without applying it', async () => {
      // Arrange
      const handler = getHandler('saveFile:inspectDirectory');

      // Act
      const result = await handler(null, 'relative/save/dir');

      // Assert
      expect(result).toEqual({ status: 'invalidPath', saveFileCount: 0 });
      expect(grailDatabase.setSetting).not.toHaveBeenCalled();
      expect(grailDatabase.truncateUserData).not.toHaveBeenCalled();
      expect(mockSaveFileMonitor.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('Then saveFile:updateSaveDirectory should truncate user data when the directory changes', async () => {
      // Arrange
      const newSaveDir = '/new/save/dir';
      const handler = getHandler('saveFile:updateSaveDirectory');

      // Act
      const result = await handler(null, newSaveDir);

      // Assert
      expect(grailDatabase.truncateUserData).toHaveBeenCalledTimes(1);
      expect(grailDatabase.truncateUserData).toHaveBeenCalledWith(newSaveDir);
      expect(mockSaveFileMonitor.updateSaveDirectory).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('Then saveFile:updateSaveDirectory should persist the new directory in the truncate call instead of a separate write', async () => {
      // Arrange
      const handler = getHandler('saveFile:updateSaveDirectory');

      // Act
      await handler(null, '/new/save/dir');

      // Assert
      expect(grailDatabase.truncateUserData).toHaveBeenCalledWith('/new/save/dir');
      expect(grailDatabase.setSetting).not.toHaveBeenCalled();
    });

    it('Then saveFile:updateSaveDirectory should keep the old setting and monitor if truncating fails', async () => {
      // Arrange
      grailDatabase.truncateUserData.mockImplementationOnce(() => {
        throw new Error('FOREIGN KEY constraint failed');
      });
      silenceConsole('error');
      const handler = getHandler('saveFile:updateSaveDirectory');

      // Act
      const act = handler(null, '/new/save/dir');

      // Assert
      await expect(act).rejects.toThrow('FOREIGN KEY constraint failed');
      expect(grailDatabase.setSetting).not.toHaveBeenCalled();
      expect(mockSaveFileMonitor.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('Then saveFile:updateSaveDirectory should not restart the monitor if writing the setting fails for an unchanged directory', async () => {
      // Arrange
      grailDatabase.getAllSettings.mockReturnValue({ saveDir: '/test/save/dir' });
      grailDatabase.setSetting.mockImplementationOnce(() => {
        throw new Error('database or disk is full');
      });
      silenceConsole('error');
      const handler = getHandler('saveFile:updateSaveDirectory');

      // Act
      const act = handler(null, '/test/save/dir/');

      // Assert
      await expect(act).rejects.toThrow('database or disk is full');
      expect(grailDatabase.truncateUserData).not.toHaveBeenCalled();
      expect(mockSaveFileMonitor.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('Then saveFile:updateSaveDirectory should not truncate user data when the directory is unchanged', async () => {
      // Arrange
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue({
        saveDir: '/test/save/dir',
      } as any);
      const handler = getHandler('saveFile:updateSaveDirectory');

      // Act
      const result = await handler(null, '/test/save/dir/');

      // Assert
      expect(grailDatabase.truncateUserData).not.toHaveBeenCalled();
      expect(grailDatabase.setSetting).toHaveBeenCalledWith('saveDir', '/test/save/dir/');
      expect(mockSaveFileMonitor.updateSaveDirectory).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('Then saveFile:updateSaveDirectory should not truncate when no setting exists and the platform default is selected', async () => {
      // Arrange
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue({ saveDir: '' } as any);
      mockSaveFileMonitor.getDefaultDirectory.mockReturnValue('/default/save/dir');
      const handler = getHandler('saveFile:updateSaveDirectory');

      // Act
      await handler(null, '/default/save/dir');

      // Assert
      expect(grailDatabase.truncateUserData).not.toHaveBeenCalled();
      expect(grailDatabase.setSetting).toHaveBeenCalledWith('saveDir', '/default/save/dir');
    });

    it('Then saveFile:updateSaveDirectory should not truncate user data when the current directory is unknown', async () => {
      // Arrange
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue({ saveDir: '' } as any);
      mockSaveFileMonitor.getDefaultDirectory.mockReturnValue('');
      const warnSpy = silenceConsole('warn');
      const handler = getHandler('saveFile:updateSaveDirectory');

      // Act
      const result = await handler(null, '/new/save/dir');

      // Assert
      expect(grailDatabase.truncateUserData).not.toHaveBeenCalled();
      expect(grailDatabase.setSetting).toHaveBeenCalledWith('saveDir', '/new/save/dir');
      expect(mockSaveFileMonitor.updateSaveDirectory).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
      expect(result).toEqual({ success: true });
    });

    it('Then saveFile:updateSaveDirectory should compare paths case-insensitively on win32', async () => {
      // Arrange
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue({ saveDir: '/test/save/dir' } as any);
      const handler = getHandler('saveFile:updateSaveDirectory');

      // Act
      await handler(null, '/Test/Save/DIR');

      // Assert
      expect(grailDatabase.truncateUserData).not.toHaveBeenCalled();
      expect(grailDatabase.setSetting).toHaveBeenCalledWith('saveDir', '/Test/Save/DIR');
    });

    it('Then saveFile:updateSaveDirectory should compare paths case-sensitively on other platforms', async () => {
      // Arrange
      Object.defineProperty(process, 'platform', { value: 'linux' });
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue({ saveDir: '/test/save/dir' } as any);
      const handler = getHandler('saveFile:updateSaveDirectory');

      // Act
      await handler(null, '/Test/Save/DIR');

      // Assert
      expect(grailDatabase.truncateUserData).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['an empty string', ''],
      ['whitespace only', '   '],
      ['a relative path', 'relative/save/dir'],
      ['a number', 42],
      ['undefined', undefined],
      ['an object', { path: '/new/save/dir' }],
    ])('Then saveFile:updateSaveDirectory should reject %s without touching data', async (_label, input) => {
      // Arrange
      const handler = getHandler('saveFile:updateSaveDirectory');
      silenceConsole('error');

      // Act
      const act = handler(null, input);

      // Assert
      await expect(act).rejects.toThrow('Invalid save directory');
      expect(grailDatabase.setSetting).not.toHaveBeenCalled();
      expect(grailDatabase.truncateUserData).not.toHaveBeenCalled();
      expect(mockSaveFileMonitor.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('Then saveFile:restoreDefaultDirectory should truncate user data when the default differs', async () => {
      // Arrange
      const defaultDir = '/default/save/dir';
      mockSaveFileMonitor.getDefaultDirectory.mockReturnValue(defaultDir);
      const handler = getHandler('saveFile:restoreDefaultDirectory');

      // Act
      const result = await handler();

      // Assert
      expect(grailDatabase.truncateUserData).toHaveBeenCalledTimes(1);
      expect(grailDatabase.truncateUserData).toHaveBeenCalledWith(defaultDir);
      expect(mockSaveFileMonitor.updateSaveDirectory).toHaveBeenCalled();
      expect(result).toEqual({ success: true, defaultDirectory: defaultDir });
    });

    it('Then saveFile:restoreDefaultDirectory should not truncate user data when already using the default', async () => {
      // Arrange
      const defaultDir = '/default/save/dir';
      mockSaveFileMonitor.getDefaultDirectory.mockReturnValue(defaultDir);
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue({ saveDir: defaultDir } as any);
      const handler = getHandler('saveFile:restoreDefaultDirectory');

      // Act
      const result = await handler();

      // Assert
      expect(grailDatabase.truncateUserData).not.toHaveBeenCalled();
      expect(mockSaveFileMonitor.updateSaveDirectory).toHaveBeenCalled();
      expect(result).toEqual({ success: true, defaultDirectory: defaultDir });
    });
  });

  describe('If save file monitoring is auto-started', () => {
    let warnSpy: MockInstance | undefined;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      warnSpy?.mockRestore();
      warnSpy = undefined;
      vi.useRealTimers();
    });

    it.each([
      GameMode.Both,
      GameMode.Softcore,
      GameMode.Hardcore,
    ])('When the game mode is %s, Then monitoring starts after the startup delay', async (gameMode) => {
      // Arrange
      grailDatabase.getAllSettings.mockReturnValue({ gameMode } as any);
      initializeSaveFileHandlers();

      // Act
      await vi.advanceTimersByTimeAsync(1000);

      // Assert
      expect(mockSaveFileMonitor.startMonitoring).toHaveBeenCalledTimes(1);
    });

    it('When the persisted game mode is Manual, Then monitoring does not start', async () => {
      // Arrange
      grailDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Manual,
      } as any);
      initializeSaveFileHandlers();

      // Act
      await vi.advanceTimersByTimeAsync(1000);

      // Assert
      expect(mockSaveFileMonitor.startMonitoring).not.toHaveBeenCalled();
    });

    it('If the settings cannot be read, Then monitoring still starts', async () => {
      // Arrange
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      grailDatabase.getAllSettings.mockImplementation(() => {
        throw new Error('database unavailable');
      });
      initializeSaveFileHandlers();

      // Act
      await vi.advanceTimersByTimeAsync(1000);

      // Assert
      expect(mockSaveFileMonitor.startMonitoring).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the game mode is changed while the app is running', () => {
    interface Deferred {
      promise: Promise<void>;
      resolve: () => void;
    }
    const createDeferred = (): Deferred => {
      let resolve!: () => void;
      const promise = new Promise<void>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    };

    const getRegisteredHandler = (channel: string) =>
      vi.mocked(ipcMain.handle).mock.calls.find((call) => call[0] === channel)?.[1] as any;

    // Returns a promise that settles once every listener has finished processing the update
    const emitSettingsUpdated = (settings: Record<string, unknown>): Promise<unknown> =>
      Promise.all(settingsUpdatedListeners.map((listener) => listener(settings)));

    it('When switching to Manual, Then monitoring is stopped if active', async () => {
      // Arrange
      grailDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Both,
      } as any);
      initializeSaveFileHandlers();

      // Act
      await emitSettingsUpdated({ gameMode: GameMode.Manual });

      // Assert
      expect(mockSaveFileMonitor.stopMonitoringIfActive).toHaveBeenCalledTimes(1);
    });

    it('When switching to Manual while the monitor is still starting, Then the stop is still requested', async () => {
      // Arrange
      grailDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Both,
      } as any);
      mockSaveFileMonitor.isCurrentlyMonitoring.mockReturnValue(false);
      initializeSaveFileHandlers();

      // Act
      await emitSettingsUpdated({ gameMode: GameMode.Manual });

      // Assert
      expect(mockSaveFileMonitor.stopMonitoringIfActive).toHaveBeenCalledTimes(1);
    });

    it('When switching from Manual to an automatic mode, Then monitoring resumes once', async () => {
      // Arrange
      grailDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Manual,
      } as any);
      initializeSaveFileHandlers();
      mockSaveFileMonitor.startMonitoring.mockClear();

      // Act
      await Promise.all([
        emitSettingsUpdated({ gameMode: GameMode.Softcore }),
        emitSettingsUpdated({ gameMode: GameMode.Softcore }),
      ]);

      // Assert
      expect(mockSaveFileMonitor.startMonitoring).toHaveBeenCalledTimes(1);
    });

    it('When the mode flips auto -> Manual -> auto during an in-flight start, Then the resume start is still requested', async () => {
      // Arrange
      grailDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Both,
      } as any);
      initializeSaveFileHandlers();
      mockSaveFileMonitor.startMonitoring.mockClear();
      const inFlightStart = createDeferred();
      mockSaveFileMonitor.startMonitoring.mockReturnValueOnce(inFlightStart.promise);
      const startRequest = getRegisteredHandler('saveFile:startMonitoring')(null);

      // Act
      await emitSettingsUpdated({ gameMode: GameMode.Manual });
      const resume = emitSettingsUpdated({ gameMode: GameMode.Softcore });
      inFlightStart.resolve();
      await Promise.all([startRequest, resume]);

      // Assert
      expect(mockSaveFileMonitor.startMonitoring).toHaveBeenCalledTimes(2);
      expect(mockSaveFileMonitor.stopMonitoringIfActive).toHaveBeenCalledTimes(1);
    });

    it('When switching between automatic modes, Then monitoring is left untouched', async () => {
      // Arrange
      grailDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Both,
      } as any);
      initializeSaveFileHandlers();
      mockSaveFileMonitor.startMonitoring.mockClear();

      // Act
      await emitSettingsUpdated({ gameMode: GameMode.Hardcore });

      // Assert
      expect(mockSaveFileMonitor.startMonitoring).not.toHaveBeenCalled();
      expect(mockSaveFileMonitor.stopMonitoring).not.toHaveBeenCalled();
      expect(mockSaveFileMonitor.stopMonitoringIfActive).not.toHaveBeenCalled();
    });

    it('When unrelated settings change, Then monitoring is left untouched', async () => {
      // Arrange
      grailDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Manual,
      } as any);
      initializeSaveFileHandlers();
      mockSaveFileMonitor.startMonitoring.mockClear();

      // Act
      await emitSettingsUpdated({ theme: 'dark' });

      // Assert
      expect(mockSaveFileMonitor.startMonitoring).not.toHaveBeenCalled();
      expect(mockSaveFileMonitor.stopMonitoring).not.toHaveBeenCalled();
      expect(mockSaveFileMonitor.stopMonitoringIfActive).not.toHaveBeenCalled();
    });

    it('When monitoring is started explicitly after leaving Manual mode, Then the monitor starts', async () => {
      // Arrange
      grailDatabase.getAllSettings.mockReturnValue({
        gameMode: GameMode.Both,
      } as any);
      initializeSaveFileHandlers();
      mockSaveFileMonitor.startMonitoring.mockClear();
      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'saveFile:startMonitoring')?.[1] as any;

      // Act
      const result = await handler(null);

      // Assert
      expect(mockSaveFileMonitor.startMonitoring).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });
  });
});
