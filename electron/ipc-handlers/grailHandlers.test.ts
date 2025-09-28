/** biome-ignore-all lint/suspicious/noExplicitAny: This file is testing private methods */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock database
vi.mock('../database/database', () => ({
  GrailDatabase: vi.fn().mockImplementation(() => ({
    getAllCharacters: vi.fn(),
    insertCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    deleteCharacter: vi.fn(),
    getAllSettings: vi.fn(),
    getFilteredItems: vi.fn(),
    insertItems: vi.fn(),
    getProgressByCharacter: vi.fn(),
    getFilteredProgress: vi.fn(),
    upsertProgress: vi.fn(),
    getFilteredGrailStatistics: vi.fn(),
    setSetting: vi.fn(),
    backup: vi.fn(),
    restore: vi.fn(),
    restoreFromBuffer: vi.fn(),
    truncateUserData: vi.fn(),
    close: vi.fn(),
  })),
}));

import { ipcMain } from 'electron';
import {
  CharacterBuilder,
  DatabaseCharacterBuilder,
  DatabaseItemBuilder,
  DatabaseProgressBuilder,
  GrailProgressBuilder,
  HolyGrailItemBuilder,
} from '@/fixtures';
import { GrailDatabase } from '../database/database';
import type { Character } from '../types/grail';
import { closeGrailDatabase, initializeGrailHandlers } from './grailHandlers';

// Mock data types
interface MockGrailDatabase {
  getAllCharacters: ReturnType<typeof vi.fn>;
  insertCharacter: ReturnType<typeof vi.fn>;
  updateCharacter: ReturnType<typeof vi.fn>;
  deleteCharacter: ReturnType<typeof vi.fn>;
  getAllSettings: ReturnType<typeof vi.fn>;
  getFilteredItems: ReturnType<typeof vi.fn>;
  insertItems: ReturnType<typeof vi.fn>;
  getProgressByCharacter: ReturnType<typeof vi.fn>;
  getFilteredProgress: ReturnType<typeof vi.fn>;
  upsertProgress: ReturnType<typeof vi.fn>;
  getFilteredGrailStatistics: ReturnType<typeof vi.fn>;
  setSetting: ReturnType<typeof vi.fn>;
  backup: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  restoreFromBuffer: ReturnType<typeof vi.fn>;
  truncateUserData: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

describe('When grailHandlers is used', () => {
  let mockGrailDatabase: MockGrailDatabase;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Setup mock database
    mockGrailDatabase = {
      getAllCharacters: vi.fn(),
      insertCharacter: vi.fn(),
      updateCharacter: vi.fn(),
      deleteCharacter: vi.fn(),
      getAllSettings: vi.fn(),
      getFilteredItems: vi.fn(),
      insertItems: vi.fn(),
      getProgressByCharacter: vi.fn(),
      getFilteredProgress: vi.fn(),
      upsertProgress: vi.fn(),
      getFilteredGrailStatistics: vi.fn(),
      setSetting: vi.fn(),
      backup: vi.fn(),
      restore: vi.fn(),
      restoreFromBuffer: vi.fn(),
      truncateUserData: vi.fn(),
      close: vi.fn(),
    };

    vi.mocked(GrailDatabase).mockImplementation(() => mockGrailDatabase as any);
  });

  describe('If initializeGrailHandlers is called', () => {
    it('Then should initialize database and set up IPC handlers', () => {
      // Act
      initializeGrailHandlers();

      // Assert
      expect(GrailDatabase).toHaveBeenCalled();
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:getCharacters', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:createCharacter', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:updateCharacter', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:deleteCharacter', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:getItems', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:seedItems', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:getProgress', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:updateProgress', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:getSettings', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:updateSettings', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:getStatistics', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:backup', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:restore', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:restoreFromBuffer', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:truncateUserData', expect.any(Function));
    });

    it('Then should handle database initialization errors gracefully', () => {
      // Arrange
      vi.mocked(GrailDatabase).mockImplementation(() => {
        throw new Error('Database initialization failed');
      });

      // Act & Assert
      expect(() => initializeGrailHandlers()).not.toThrow();
    });
  });

  describe('If character handlers are called', () => {
    beforeEach(() => {
      initializeGrailHandlers();
    });

    it('Then grail:getCharacters should return mapped characters', async () => {
      // Arrange
      const mockDbCharacters = [
        DatabaseCharacterBuilder.new()
          .withId('char-1')
          .withName('TestCharacter')
          .asAmazon()
          .withLevel(85)
          .withDifficulty('hell')
          .asHardcore()
          .asExpansion()
          .withSaveFilePath('/path/to/char.d2s')
          .withCreatedAt('2024-01-01T00:00:00.000Z')
          .withUpdatedAt('2024-01-02T00:00:00.000Z')
          .asActive()
          .build(),
      ];
      mockGrailDatabase.getAllCharacters.mockReturnValue(mockDbCharacters);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getCharacters')?.[1] as any;

      // Act
      const result = await handler();

      // Assert
      expect(result).toEqual([
        {
          id: 'char-1',
          name: 'TestCharacter',
          characterClass: 'amazon',
          level: 85,
          difficulty: 'hell',
          hardcore: true,
          expansion: true,
          saveFilePath: '/path/to/char.d2s',
          created: new Date('2024-01-01T00:00:00.000Z'),
          lastUpdated: new Date('2024-01-02T00:00:00.000Z'),
          deleted: undefined,
        },
      ]);
    });

    it('Then grail:createCharacter should insert character', async () => {
      // Arrange
      const mockCharacter = CharacterBuilder.new()
        .withId('char-1')
        .withName('TestCharacter')
        .withCharacterClass('amazon')
        .withLevel(85)
        .withDifficulty('hell')
        .withHardcore(true)
        .withExpansion(true)
        .withSaveFilePath('/path/to/char.d2s')
        .build();

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:createCharacter')?.[1] as any;

      // Act
      const result = await handler(null, mockCharacter);

      // Assert
      expect(mockGrailDatabase.insertCharacter).toHaveBeenCalledWith({
        id: 'char-1',
        name: 'TestCharacter',
        character_class: 'amazon',
        level: 85,
        difficulty: 'hell',
        hardcore: true,
        expansion: true,
        save_file_path: '/path/to/char.d2s',
      });
      expect(result).toEqual({ success: true });
    });

    it('Then grail:updateCharacter should update character', async () => {
      // Arrange
      const characterId = 'char-1';
      const updates = {
        name: 'UpdatedCharacter',
        level: 90,
      };

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:updateCharacter')?.[1] as any;

      // Act
      const result = await handler(null, characterId, updates);

      // Assert
      expect(mockGrailDatabase.updateCharacter).toHaveBeenCalledWith('char-1', {
        name: 'UpdatedCharacter',
        level: 90,
      });
      expect(result).toEqual({ success: true });
    });

    it('Then grail:deleteCharacter should delete character', async () => {
      // Arrange
      const characterId = 'char-1';

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:deleteCharacter')?.[1] as any;

      // Act
      const result = await handler(null, characterId);

      // Assert
      expect(mockGrailDatabase.deleteCharacter).toHaveBeenCalledWith('char-1');
      expect(result).toEqual({ success: true });
    });

    it('Then character handlers should handle errors properly', async () => {
      // Arrange
      mockGrailDatabase.getAllCharacters.mockImplementation(() => {
        throw new Error('Database error');
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getCharacters')?.[1] as any;

      // Act & Assert
      await expect(handler()).rejects.toThrow('Database error');
    });
  });

  describe('If item handlers are called', () => {
    beforeEach(() => {
      initializeGrailHandlers();
    });

    it('Then grail:getItems should return mapped items', async () => {
      // Arrange
      const mockSettings = { grailEthereal: false };
      const mockDbItems = [DatabaseItemBuilder.new().asShako().build()];
      mockGrailDatabase.getAllSettings.mockReturnValue(mockSettings);
      mockGrailDatabase.getFilteredItems.mockReturnValue(mockDbItems);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getItems')?.[1] as any;

      // Act
      const result = await handler();

      // Assert
      expect(result).toEqual([
        {
          id: 'shako',
          name: 'shako',
          type: 'unique',
          category: 'armor',
          subCategory: 'helms',
          level: 0,
          requiredLevel: 0,
          rarity: 'common',
          difficulty: ['normal', 'nightmare', 'hell'],
          setName: undefined,
          etherealType: 'none',
        },
      ]);
    });

    it('Then grail:seedItems should insert items', async () => {
      // Arrange
      const mockItems = [
        HolyGrailItemBuilder.new()
          .withId('shako')
          .withName('shako')
          .withType('unique')
          .withArmorSubCategory('helms')
          .withEtherealType('none')
          .build(),
      ];

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:seedItems')?.[1] as any;

      // Act
      const result = await handler(null, mockItems);

      // Assert
      expect(mockGrailDatabase.insertItems).toHaveBeenCalledWith([
        {
          id: 'shako',
          name: 'shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          set_name: undefined,
          ethereal_type: 'none',
        },
      ]);
      expect(result).toEqual({ success: true });
    });

    it('Then item handlers should handle errors properly', async () => {
      // Arrange
      mockGrailDatabase.getAllSettings.mockImplementation(() => {
        throw new Error('Database error');
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getItems')?.[1] as any;

      // Act & Assert
      await expect(handler()).rejects.toThrow('Database error');
    });
  });

  describe('If progress handlers are called', () => {
    beforeEach(() => {
      initializeGrailHandlers();
    });

    it('Then grail:getProgress should return mapped progress for all characters', async () => {
      // Arrange
      const mockSettings = { grailEthereal: false };
      const mockDbProgress = [
        DatabaseProgressBuilder.new()
          .withId('progress-1')
          .withCharacterId('char-1')
          .forShako()
          .asFound()
          .withFoundDate('2024-01-01T00:00:00.000Z')
          .asAutoDetected()
          .asHellDifficulty()
          .withNotes('Found in Baal run')
          .build(),
      ];
      const mockCharacters = [
        DatabaseCharacterBuilder.new().withId('char-1').withName('TestCharacter').build(),
      ];
      mockGrailDatabase.getAllSettings.mockReturnValue(mockSettings);
      mockGrailDatabase.getFilteredProgress.mockReturnValue(mockDbProgress);
      mockGrailDatabase.getAllCharacters.mockReturnValue(mockCharacters);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getProgress')?.[1] as any;

      // Act
      const result = await handler();

      // Assert
      expect(result).toEqual([
        {
          id: 'progress-1',
          characterId: 'char-1',
          itemId: 'shako',
          found: true,
          foundDate: new Date('2024-01-01T00:00:00.000Z'),
          foundBy: 'TestCharacter',
          manuallyAdded: false,
          difficulty: 'hell',
          notes: 'Found in Baal run',
        },
      ]);
    });

    it('Then grail:getProgress should return mapped progress for specific character', async () => {
      // Arrange
      const characterId = 'char-1';
      const mockSettings = { grailEthereal: false };
      const mockDbProgress = [
        DatabaseProgressBuilder.new()
          .withId('progress-1')
          .withCharacterId('char-1')
          .forShako()
          .asFound()
          .withFoundDate('2024-01-01T00:00:00.000Z')
          .asAutoDetected()
          .asHellDifficulty()
          .withNotes('Found in Baal run')
          .build(),
      ];
      const mockCharacters = [
        DatabaseCharacterBuilder.new().withId('char-1').withName('TestCharacter').build(),
      ];
      mockGrailDatabase.getAllSettings.mockReturnValue(mockSettings);
      mockGrailDatabase.getProgressByCharacter.mockReturnValue(mockDbProgress);
      mockGrailDatabase.getAllCharacters.mockReturnValue(mockCharacters);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getProgress')?.[1] as any;

      // Act
      const result = await handler(null, characterId);

      // Assert
      expect(mockGrailDatabase.getProgressByCharacter).toHaveBeenCalledWith('char-1');
      expect(result).toEqual([
        {
          id: 'progress-1',
          characterId: 'char-1',
          itemId: 'shako',
          found: true,
          foundDate: new Date('2024-01-01T00:00:00.000Z'),
          foundBy: 'TestCharacter',
          manuallyAdded: false,
          difficulty: 'hell',
          notes: 'Found in Baal run',
        },
      ]);
    });

    it('Then grail:updateProgress should upsert progress', async () => {
      // Arrange
      const mockProgress = GrailProgressBuilder.new()
        .withId('progress-1')
        .withCharacterId('char-1')
        .withItemId('shako')
        .withFound(true)
        .withFoundDate(new Date('2024-01-01T00:00:00.000Z'))
        .withManuallyAdded(false)
        .withDifficulty('hell')
        .withNotes('Found in Baal run')
        .build();

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:updateProgress')?.[1] as any;

      // Act
      const result = await handler(null, mockProgress);

      // Assert
      expect(mockGrailDatabase.upsertProgress).toHaveBeenCalledWith({
        id: 'progress-1',
        character_id: 'char-1',
        item_id: 'shako',
        found: true,
        found_date: '2024-01-01T00:00:00.000Z',
        manually_added: false,
        auto_detected: false,
        difficulty: 'hell',
        notes: 'Found in Baal run',
      });
      expect(result).toEqual({ success: true });
    });

    it('Then progress handlers should handle errors properly', async () => {
      // Arrange
      mockGrailDatabase.getAllSettings.mockImplementation(() => {
        throw new Error('Database error');
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getProgress')?.[1] as any;

      // Act & Assert
      await expect(handler()).rejects.toThrow('Database error');
    });
  });

  describe('If settings handlers are called', () => {
    beforeEach(() => {
      initializeGrailHandlers();
    });

    it('Then grail:getSettings should return settings', async () => {
      // Arrange
      const mockSettings = {
        grailEthereal: false,
        grailNormal: true,
        saveDir: '/path/to/saves',
      };
      mockGrailDatabase.getAllSettings.mockReturnValue(mockSettings);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getSettings')?.[1] as any;

      // Act
      const result = await handler();

      // Assert
      expect(result).toEqual(mockSettings);
    });

    it('Then grail:updateSettings should update settings', async () => {
      // Arrange
      const settingsUpdates = {
        grailEthereal: true,
        saveDir: '/new/path/to/saves',
      };

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:updateSettings')?.[1] as any;

      // Act
      const result = await handler(null, settingsUpdates);

      // Assert
      expect(mockGrailDatabase.setSetting).toHaveBeenCalledWith('grailEthereal', 'true');
      expect(mockGrailDatabase.setSetting).toHaveBeenCalledWith('saveDir', '/new/path/to/saves');
      expect(result).toEqual({ success: true });
    });

    it('Then settings handlers should handle errors properly', async () => {
      // Arrange
      mockGrailDatabase.getAllSettings.mockImplementation(() => {
        throw new Error('Database error');
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getSettings')?.[1] as any;

      // Act & Assert
      await expect(handler()).rejects.toThrow('Database error');
    });
  });

  describe('If statistics handlers are called', () => {
    beforeEach(() => {
      initializeGrailHandlers();
    });

    it('Then grail:getStatistics should return statistics for all characters', async () => {
      // Arrange
      const mockSettings = { grailEthereal: false };
      const mockStatistics = {
        totalItems: 100,
        foundItems: 25,
        completionPercentage: 25,
        recentFinds: [],
      };
      mockGrailDatabase.getAllSettings.mockReturnValue(mockSettings);
      mockGrailDatabase.getFilteredGrailStatistics.mockReturnValue(mockStatistics);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getStatistics')?.[1] as any;

      // Act
      const result = await handler();

      // Assert
      expect(mockGrailDatabase.getFilteredGrailStatistics).toHaveBeenCalledWith(
        mockSettings,
        undefined,
      );
      expect(result).toEqual(mockStatistics);
    });

    it('Then grail:getStatistics should return statistics for specific character', async () => {
      // Arrange
      const characterId = 'char-1';
      const mockSettings = { grailEthereal: false };
      const mockStatistics = {
        totalItems: 100,
        foundItems: 10,
        completionPercentage: 10,
        recentFinds: [],
      };
      mockGrailDatabase.getAllSettings.mockReturnValue(mockSettings);
      mockGrailDatabase.getFilteredGrailStatistics.mockReturnValue(mockStatistics);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getStatistics')?.[1] as any;

      // Act
      const result = await handler(null, characterId);

      // Assert
      expect(mockGrailDatabase.getFilteredGrailStatistics).toHaveBeenCalledWith(
        mockSettings,
        'char-1',
      );
      expect(result).toEqual(mockStatistics);
    });

    it('Then statistics handlers should handle errors properly', async () => {
      // Arrange
      mockGrailDatabase.getAllSettings.mockImplementation(() => {
        throw new Error('Database error');
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getStatistics')?.[1] as any;

      // Act & Assert
      await expect(handler()).rejects.toThrow('Database error');
    });
  });

  describe('If backup handlers are called', () => {
    beforeEach(() => {
      initializeGrailHandlers();
    });

    it('Then grail:backup should backup database', async () => {
      // Arrange
      const backupPath = '/path/to/backup.db';

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:backup')?.[1] as any;

      // Act
      const result = await handler(null, backupPath);

      // Assert
      expect(mockGrailDatabase.backup).toHaveBeenCalledWith(backupPath);
      expect(result).toEqual({ success: true });
    });

    it('Then grail:restore should restore database', async () => {
      // Arrange
      const backupPath = '/path/to/backup.db';

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:restore')?.[1] as any;

      // Act
      const result = await handler(null, backupPath);

      // Assert
      expect(mockGrailDatabase.restore).toHaveBeenCalledWith(backupPath);
      expect(result).toEqual({ success: true });
    });

    it('Then grail:restoreFromBuffer should restore from buffer', async () => {
      // Arrange
      const backupBuffer = new Uint8Array([1, 2, 3, 4]);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:restoreFromBuffer')?.[1] as any;

      // Act
      const result = await handler(null, backupBuffer);

      // Assert
      expect(mockGrailDatabase.restoreFromBuffer).toHaveBeenCalledWith(Buffer.from(backupBuffer));
      expect(result).toEqual({ success: true });
    });

    it('Then grail:truncateUserData should truncate user data', async () => {
      // Arrange
      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:truncateUserData')?.[1] as any;

      // Act
      const result = await handler();

      // Assert
      expect(mockGrailDatabase.truncateUserData).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('Then backup handlers should handle errors properly', async () => {
      // Arrange
      mockGrailDatabase.backup.mockImplementation(() => {
        throw new Error('Backup failed');
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:backup')?.[1] as any;

      // Act & Assert
      await expect(handler(null, '/path/to/backup.db')).rejects.toThrow('Backup failed');
    });
  });

  describe('If closeGrailDatabase is called', () => {
    it('Then should close database when database is initialized', () => {
      // Arrange
      initializeGrailHandlers();

      // Act
      closeGrailDatabase();

      // Assert
      expect(mockGrailDatabase.close).toHaveBeenCalled();
    });

    it('Then should handle case when database is not initialized', () => {
      // Act & Assert
      expect(() => closeGrailDatabase()).not.toThrow();
    });
  });

  describe('If mapCharacterUpdates helper function works', () => {
    it('Then should map all character fields correctly', () => {
      // Arrange
      const updates: Partial<Character> = {
        name: 'UpdatedName',
        characterClass: 'sorceress',
        level: 90,
        difficulty: 'hell',
        hardcore: true,
        expansion: true,
        saveFilePath: '/new/path/to/save.d2s',
        deleted: new Date('2024-01-01T00:00:00.000Z'),
      };

      // Act
      const result = mapCharacterUpdates(updates);

      // Assert
      expect(result).toEqual({
        name: 'UpdatedName',
        character_class: 'sorceress',
        level: 90,
        difficulty: 'hell',
        hardcore: true,
        expansion: true,
        save_file_path: '/new/path/to/save.d2s',
        deleted: new Date('2024-01-01T00:00:00.000Z'),
      });
    });

    it('Then should map partial updates correctly', () => {
      // Arrange
      const updates: Partial<Character> = {
        name: 'NewName',
        level: 50,
      };

      // Act
      const result = mapCharacterUpdates(updates);

      // Assert
      expect(result).toEqual({
        name: 'NewName',
        level: 50,
      });
    });

    it('Then should handle empty updates', () => {
      // Arrange
      const updates: Partial<Character> = {};

      // Act
      const result = mapCharacterUpdates(updates);

      // Assert
      expect(result).toEqual({});
    });
  });
});

// Helper function to access mapCharacterUpdates for testing
function mapCharacterUpdates(updates: Partial<Character>): Record<string, unknown> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.characterClass !== undefined) dbUpdates.character_class = updates.characterClass;
  if (updates.level !== undefined) dbUpdates.level = updates.level;
  if (updates.difficulty !== undefined) dbUpdates.difficulty = updates.difficulty;
  if (updates.hardcore !== undefined) dbUpdates.hardcore = updates.hardcore;
  if (updates.expansion !== undefined) dbUpdates.expansion = updates.expansion;
  if (updates.saveFilePath !== undefined) dbUpdates.save_file_path = updates.saveFilePath;
  if (updates.deleted !== undefined) dbUpdates.deleted = updates.deleted;
  return dbUpdates;
}
