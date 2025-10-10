/** biome-ignore-all lint/suspicious/noExplicitAny: This file is testing private methods */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  webContents: {
    getAllWebContents: vi.fn(),
  },
}));

// Mock database
vi.mock('../database/database', () => ({
  grailDatabase: {
    getCharacterByName: vi.fn(),
    getCharacterBySaveFilePath: vi.fn(),
    getProgressByItem: vi.fn(),
    getCharacterProgress: vi.fn(),
    upsertCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    upsertProgress: vi.fn(),
    upsertCharactersBatch: vi.fn(),
    upsertProgressBatch: vi.fn(),
    getAllItems: vi.fn(),
    setSetting: vi.fn(),
    truncateUserData: vi.fn(),
  },
}));

// Mock DatabaseBatchWriter
vi.mock('../services/DatabaseBatchWriter', () => {
  // Create the mock instance once at module level
  const mockInstance = {
    queueCharacter: vi.fn(),
    queueProgress: vi.fn(),
    flush: vi.fn(),
    clear: vi.fn(),
    getCharacterQueueSize: vi.fn(),
    getProgressQueueSize: vi.fn(),
  };

  return {
    DatabaseBatchWriter: vi.fn().mockImplementation(() => mockInstance),
  };
});

// Create a shared event handlers map that persists across test instances
const eventHandlers = new Map<string, Array<(...args: any[]) => any>>();

// Mock EventBus with a working implementation
vi.mock('../services/EventBus', () => {
  // Create the mock instance once at module level
  const mockInstance = {
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

  return {
    EventBus: vi.fn().mockImplementation(() => mockInstance),
  };
});

// Mock services
vi.mock('../services/itemDetection', () => ({
  ItemDetectionService: vi.fn().mockImplementation(() => ({
    enable: vi.fn(),
    disable: vi.fn(),
    setGrailItems: vi.fn(),
    analyzeSaveFile: vi.fn(),
  })),
}));

vi.mock('../services/saveFileMonitor', () => ({
  SaveFileMonitor: vi.fn().mockImplementation(() => ({
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    getSaveFiles: vi.fn(),
    isCurrentlyMonitoring: vi.fn(),
    getSaveDirectory: vi.fn(),
    getDefaultDirectory: vi.fn(),
    updateSaveDirectory: vi.fn(),
  })),
}));

import { ipcMain, webContents } from 'electron';
import {
  CharacterBuilder,
  D2ItemBuilder,
  D2SaveFileBuilder,
  D2SItemBuilder,
  HolyGrailItemBuilder,
} from '@/fixtures';
import { grailDatabase } from '../database/database';
import { DatabaseBatchWriter } from '../services/DatabaseBatchWriter';
import { EventBus } from '../services/EventBus';
import { ItemDetectionService } from '../services/itemDetection';
import { SaveFileMonitor } from '../services/saveFileMonitor';
import type { ItemDetectionEvent, SaveFileEvent } from '../types/grail';
import { closeSaveFileMonitor, initializeSaveFileHandlers } from './saveFileHandlers';

// Mock data types
interface MockWebContents {
  isDestroyed: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

interface MockEventBus {
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  listenerCount: ReturnType<typeof vi.fn>;
}

interface MockDatabaseBatchWriter {
  queueCharacter: ReturnType<typeof vi.fn>;
  queueProgress: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  getCharacterQueueSize: ReturnType<typeof vi.fn>;
  getProgressQueueSize: ReturnType<typeof vi.fn>;
}

interface MockSaveFileMonitor {
  startMonitoring: ReturnType<typeof vi.fn>;
  stopMonitoring: ReturnType<typeof vi.fn>;
  getSaveFiles: ReturnType<typeof vi.fn>;
  isCurrentlyMonitoring: ReturnType<typeof vi.fn>;
  getSaveDirectory: ReturnType<typeof vi.fn>;
  getDefaultDirectory: ReturnType<typeof vi.fn>;
  updateSaveDirectory: ReturnType<typeof vi.fn>;
}

interface MockItemDetectionService {
  enable: ReturnType<typeof vi.fn>;
  disable: ReturnType<typeof vi.fn>;
  setGrailItems: ReturnType<typeof vi.fn>;
  analyzeSaveFile: ReturnType<typeof vi.fn>;
}

describe('When saveFileHandlers is used', () => {
  let mockWebContents: MockWebContents[];
  let mockSaveFileMonitor: MockSaveFileMonitor;
  let mockItemDetectionService: MockItemDetectionService;
  let mockEventBus: MockEventBus;
  let mockBatchWriter: MockDatabaseBatchWriter;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Clear event handlers map
    eventHandlers.clear();

    // Get the mock instances (created by the mocks)
    mockEventBus = new (EventBus as any)();
    mockBatchWriter = new (DatabaseBatchWriter as any)();

    // Setup mock web contents
    mockWebContents = [
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        send: vi.fn(),
      },
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        send: vi.fn(),
      },
    ];

    vi.mocked(webContents.getAllWebContents).mockReturnValue(mockWebContents as any);

    // Setup mock services
    mockSaveFileMonitor = {
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn(),
      getSaveFiles: vi.fn().mockResolvedValue([]),
      isCurrentlyMonitoring: vi.fn().mockReturnValue(false),
      getSaveDirectory: vi.fn().mockReturnValue('/test/save/dir'),
      getDefaultDirectory: vi.fn().mockReturnValue('/default/save/dir'),
      updateSaveDirectory: vi.fn().mockResolvedValue(undefined),
    };

    mockItemDetectionService = {
      enable: vi.fn(),
      disable: vi.fn(),
      setGrailItems: vi.fn(),
      analyzeSaveFile: vi.fn(),
    };

    // Setup service mocks
    vi.mocked(SaveFileMonitor).mockImplementation(() => mockSaveFileMonitor as any);
    vi.mocked(ItemDetectionService).mockImplementation(() => mockItemDetectionService as any);

    // Setup default database mocks
    vi.mocked(grailDatabase.getCharacterByName).mockReturnValue(undefined);
    vi.mocked(grailDatabase.getCharacterBySaveFilePath).mockReturnValue(undefined);
    vi.mocked(grailDatabase.getProgressByItem).mockReturnValue([]);
    vi.mocked(grailDatabase.getCharacterProgress).mockReturnValue(null);
    vi.mocked(grailDatabase.getAllItems).mockReturnValue([]);
  });

  describe('If initializeSaveFileHandlers is called', () => {
    it('Then should initialize services and set up event handlers', () => {
      // Act
      initializeSaveFileHandlers();

      // Assert
      expect(EventBus).toHaveBeenCalled();
      expect(SaveFileMonitor).toHaveBeenCalledWith(mockEventBus, grailDatabase);
      expect(ItemDetectionService).toHaveBeenCalledWith(mockEventBus);
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

    it('Then should load grail items into detection service', () => {
      // Arrange
      const mockItems = HolyGrailItemBuilder.new()
        .withId('shako')
        .withName('shako')
        .withType('unique')
        .withArmorSubCategory('helms')
        .withEtherealType('none')
        .buildMany(1);

      vi.mocked(grailDatabase.getAllItems).mockReturnValue(mockItems as any);

      // Act
      initializeSaveFileHandlers();

      // Assert
      expect(mockItemDetectionService.setGrailItems).toHaveBeenCalledWith([
        {
          id: 'shako-0',
          name: 'shako 1',
          link: 'https://example.com/default-item',
          code: undefined,
          type: 'unique',
          category: 'armor',
          subCategory: 'helms',
          treasureClass: 'normal',
          setName: undefined,
          etherealType: 'none',
        },
      ]);
    });

    it('Then should handle grail items loading errors gracefully', () => {
      // Arrange
      vi.mocked(grailDatabase.getAllItems).mockImplementation(() => {
        throw new Error('Database error');
      });

      // Act & Assert
      expect(() => initializeSaveFileHandlers()).not.toThrow();
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
        mockEvent.extractedItems,
        mockEvent.silent,
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

    it('Then should handle automatic grail progress for item-found events', () => {
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

      const mockCharacter = CharacterBuilder.new()
        .withId('char-1')
        .withName('TestCharacter')
        .build();

      vi.mocked(grailDatabase.getCharacterByName).mockReturnValue(mockCharacter as any);
      vi.mocked(grailDatabase.getProgressByItem).mockReturnValue([]);

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('item-detection', mockEvent);

      // Assert
      expect(mockBatchWriter.queueProgress).toHaveBeenCalled();
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
    beforeEach(() => {
      initializeSaveFileHandlers();
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

    it('Then saveFile:updateSaveDirectory should update directory', async () => {
      // Arrange
      const newSaveDir = '/new/save/dir';

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'saveFile:updateSaveDirectory')?.[1] as any;

      // Act
      const result = await handler(null, newSaveDir);

      // Assert
      expect(grailDatabase.setSetting).toHaveBeenCalledWith('saveDir', newSaveDir);
      expect(grailDatabase.truncateUserData).toHaveBeenCalled();
      expect(mockSaveFileMonitor.updateSaveDirectory).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('Then saveFile:restoreDefaultDirectory should restore default', async () => {
      // Arrange
      const defaultDir = '/default/save/dir';
      mockSaveFileMonitor.getDefaultDirectory.mockReturnValue(defaultDir);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'saveFile:restoreDefaultDirectory')?.[1] as any;

      // Act
      const result = await handler();

      // Assert
      expect(grailDatabase.setSetting).toHaveBeenCalledWith('saveDir', defaultDir);
      expect(grailDatabase.truncateUserData).toHaveBeenCalled();
      expect(mockSaveFileMonitor.updateSaveDirectory).toHaveBeenCalled();
      expect(result).toEqual({ success: true, defaultDirectory: defaultDir });
    });
  });

  describe('If closeSaveFileMonitor is called', () => {
    it('Then should stop monitoring', () => {
      // Arrange
      initializeSaveFileHandlers();

      // Act
      closeSaveFileMonitor();

      // Assert
      expect(mockBatchWriter.flush).toHaveBeenCalled();
      expect(mockSaveFileMonitor.stopMonitoring).toHaveBeenCalled();
    });

    it('Then should handle case when monitor is not initialized', () => {
      // Act & Assert
      expect(() => closeSaveFileMonitor()).not.toThrow();
      expect(mockBatchWriter.flush).toHaveBeenCalled();
    });
  });

  describe('If helper functions work with builders', () => {
    it('Then should work with D2SaveFileBuilder for character creation', () => {
      // Arrange
      const mockSaveFile = D2SaveFileBuilder.new()
        .asAmazon()
        .atLevel(85)
        .inHell()
        .asHardcore()
        .asExpansion()
        .withName('AmazonTest')
        .withPath('/path/to/amazon.d2s')
        .build();

      const mockCharacter = CharacterBuilder.new()
        .withId('char-1')
        .withName('AmazonTest')
        .withCharacterClass('amazon')
        .withLevel(85)
        .withDifficulty('hell')
        .withHardcore(true)
        .withExpansion(true)
        .withSaveFilePath('/path/to/amazon.d2s')
        .build();

      vi.mocked(grailDatabase.getCharacterBySaveFilePath).mockReturnValue(mockCharacter as any);

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('save-file-event', { type: 'modified', file: mockSaveFile });

      // Assert
      expect(mockBatchWriter.queueCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'char-1',
          characterClass: 'Amazon',
          level: 85,
          difficulty: 'hell',
          hardcore: true,
          expansion: true,
          saveFilePath: '/path/to/amazon.d2s',
        }),
      );
    });

    it('Then should work with HolyGrailItemBuilder for item detection', () => {
      // Arrange
      const mockGrailItem = HolyGrailItemBuilder.new()
        .withId('windforce')
        .withName('windforce')
        .withType('unique')
        .withWeaponSubCategory('bows')
        .withEtherealType('none')
        .build();

      const d2sItem = D2SItemBuilder.new()
        .withId('test-item')
        .asUniqueBow()
        .withLevel(64)
        .withSocketCount(0)
        .build();

      const mockEvent: ItemDetectionEvent = {
        type: 'item-found',
        item: D2ItemBuilder.new()
          .withId('test-item')
          .withName(d2sItem.name || 'Test Item')
          .withType(d2sItem.type || d2sItem.type_name || d2sItem.code || 'bows')
          .withQuality(d2sItem.quality === 5 ? 'unique' : 'normal')
          .withLevel(d2sItem.level || 64)
          .withEthereal(d2sItem.ethereal === 1)
          .withSockets(d2sItem.socket_count || d2sItem.socketed || 0)
          .withCharacterName('TestCharacter')
          .withLocation(
            d2sItem.location === 'equipped'
              ? 'equipment'
              : d2sItem.location === 'stash'
                ? 'stash'
                : 'inventory',
          )
          .build(),
        grailItem: mockGrailItem,
      };

      const mockCharacter = CharacterBuilder.new()
        .withId('char-1')
        .withName('TestCharacter')
        .build();

      vi.mocked(grailDatabase.getCharacterByName).mockReturnValue(mockCharacter as any);
      vi.mocked(grailDatabase.getProgressByItem).mockReturnValue([]);

      initializeSaveFileHandlers();

      // Act
      mockEventBus.emit('item-detection', mockEvent);

      // Assert
      expect(mockBatchWriter.queueProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId: 'char-1',
          itemId: 'windforce',
          manuallyAdded: false,
        }),
      );
    });
  });
});
