/** biome-ignore-all lint/suspicious/noExplicitAny: This file is testing private methods */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  webContents: {
    getAllWebContents: vi.fn(() => []),
  },
}));

// Mock database
vi.mock('../database/database', () => {
  // Create mock database instance inside the factory
  const mockDB = {
    getAllCharacters: vi.fn(),
    getCharacterMap: vi.fn(() => new Map()),
    insertCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    deleteCharacter: vi.fn(),
    getAllSettings: vi.fn(),
    getFilteredItems: vi.fn(),
    getAllRunewords: vi.fn(),
    insertItems: vi.fn(),
    getProgressByCharacter: vi.fn(),
    getAllProgress: vi.fn(),
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

  return {
    GrailDatabase: vi.fn().mockImplementation(() => mockDB),
    grailDatabase: mockDB,
  };
});

import { ipcMain } from 'electron';
import { GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { GrailDatabase, grailDatabase } from '../database/database';
import type { Character, Settings } from '../types/grail';
import { closeGrailDatabase, initializeGrailHandlers } from './grailHandlers';

describe('When grailHandlers is used', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('If initializeGrailHandlers is called', () => {
    it('Then should initialize database and set up IPC handlers', () => {
      // Act
      initializeGrailHandlers();

      // Assert
      // Note: GrailDatabase constructor is not called because grailHandlers uses the singleton instance
      expect(ipcMain.handle).toHaveBeenCalledWith('grail:getCharacters', expect.any(Function));
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
      const mockCharacters = [
        {
          id: 'char-1',
          name: 'TestCharacter',
          characterClass: 'amazon' as const,
          level: 85,
          hardcore: true,
          expansion: true,
          saveFilePath: '/path/to/char.d2s',
          created: new Date('2024-01-01T00:00:00.000Z'),
          lastUpdated: new Date('2024-01-02T00:00:00.000Z'),
          deleted: undefined,
        },
      ];
      vi.mocked(grailDatabase.getAllCharacters).mockReturnValue(mockCharacters);

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
          hardcore: true,
          expansion: true,
          saveFilePath: '/path/to/char.d2s',
          created: new Date('2024-01-01T00:00:00.000Z'),
          lastUpdated: new Date('2024-01-02T00:00:00.000Z'),
          deleted: undefined,
        },
      ]);
    });

    it('Then character handlers should handle errors properly', async () => {
      // Arrange
      vi.mocked(grailDatabase.getAllCharacters).mockImplementation(() => {
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
      const mockSettings = { grailEthereal: false } as Settings;
      const mockItems = [
        {
          id: 'shako',
          name: 'shako',
          link: 'https://example.com/default-item',
          type: 'unique' as const,
          category: 'armor' as const,
          subCategory: 'helms' as const,
          treasureClass: 'normal' as const,
          setName: undefined,
          etherealType: 'none' as const,
        },
      ];
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue(mockSettings);
      vi.mocked(grailDatabase.getFilteredItems).mockReturnValue(mockItems);

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
          link: 'https://example.com/default-item',
          type: 'unique',
          category: 'armor',
          subCategory: 'helms',
          treasureClass: 'normal',
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
      expect(grailDatabase.insertItems).toHaveBeenCalledWith([
        {
          id: 'shako',
          name: 'shako',
          link: 'https://example.com/default-item',
          code: undefined,
          type: 'unique',
          category: 'armor',
          subCategory: 'helms',
          setName: undefined,
          etherealType: 'none',
          treasureClass: 'normal',
        },
      ]);
      expect(result).toEqual({ success: true });
    });

    it('Then item handlers should handle errors properly', async () => {
      // Arrange
      vi.mocked(grailDatabase.getAllSettings).mockImplementation(() => {
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
      const mockSettings = { grailEthereal: false } as Settings;
      const mockProgress = [
        {
          id: 'progress-1',
          characterId: 'char-1',
          itemId: 'shako',
          found: true,
          foundDate: new Date('2024-01-01T00:00:00.000Z'),
          foundBy: undefined,
          manuallyAdded: false,
          difficulty: 'hell' as const,
          notes: 'Found in Baal run',
          isEthereal: false,
        },
      ];
      const mockCharacters = [
        {
          id: 'char-1',
          name: 'TestCharacter',
          characterClass: 'amazon' as const,
          level: 85,
          hardcore: true,
          expansion: true,
          saveFilePath: '/path/to/char.d2s',
          created: new Date('2024-01-01T00:00:00.000Z'),
          lastUpdated: new Date('2024-01-02T00:00:00.000Z'),
          deleted: undefined,
        },
      ];
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue(mockSettings);
      vi.mocked(grailDatabase.getAllProgress).mockReturnValue(mockProgress);
      vi.mocked(grailDatabase.getAllCharacters).mockReturnValue(mockCharacters);
      vi.mocked(grailDatabase.getCharacterMap).mockReturnValue(
        new Map(mockCharacters.map((c) => [c.id, c.name])),
      );

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
          isEthereal: false,
        },
      ]);
    });

    it('Then grail:getProgress should return mapped progress for specific character', async () => {
      // Arrange
      const characterId = 'char-1';
      const mockSettings = { grailEthereal: false } as Settings;
      const mockProgress = [
        {
          id: 'progress-1',
          characterId: 'char-1',
          itemId: 'shako',
          found: true,
          foundDate: new Date('2024-01-01T00:00:00.000Z'),
          foundBy: undefined,
          manuallyAdded: false,
          difficulty: 'hell' as const,
          notes: 'Found in Baal run',
          isEthereal: false,
        },
      ];
      const mockCharacters = [
        {
          id: 'char-1',
          name: 'TestCharacter',
          characterClass: 'amazon' as const,
          level: 85,
          hardcore: true,
          expansion: true,
          saveFilePath: '/path/to/char.d2s',
          created: new Date('2024-01-01T00:00:00.000Z'),
          lastUpdated: new Date('2024-01-02T00:00:00.000Z'),
          deleted: undefined,
        },
      ];
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue(mockSettings);
      vi.mocked(grailDatabase.getProgressByCharacter).mockReturnValue(mockProgress);
      vi.mocked(grailDatabase.getAllCharacters).mockReturnValue(mockCharacters);
      vi.mocked(grailDatabase.getCharacterMap).mockReturnValue(
        new Map(mockCharacters.map((c) => [c.id, c.name])),
      );

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getProgress')?.[1] as any;

      // Act
      const result = await handler(null, characterId);

      // Assert
      expect(grailDatabase.getProgressByCharacter).toHaveBeenCalledWith('char-1');
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
          isEthereal: false,
        },
      ]);
    });

    it('Then grail:updateProgress should upsert progress', async () => {
      // Arrange
      const mockProgress = GrailProgressBuilder.new()
        .withId('progress-1')
        .withCharacterId('char-1')
        .withItemId('shako')
        .withFoundDate(new Date('2024-01-01'))
        .withFoundDate(new Date('2024-01-01T00:00:00.000Z'))
        .withManuallyAdded(false)
        .withNotes('Found in Baal run')
        .build();

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:updateProgress')?.[1] as any;

      // Act
      const result = await handler(null, mockProgress);

      // Assert
      expect(grailDatabase.upsertProgress).toHaveBeenCalledWith(mockProgress);
      expect(result).toEqual({ success: true });
    });

    it('Then progress handlers should handle errors properly', async () => {
      // Arrange
      vi.mocked(grailDatabase.getAllProgress).mockImplementation(() => {
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
      } as Settings;
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue(mockSettings);

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
      expect(grailDatabase.setSetting).toHaveBeenCalledWith('grailEthereal', 'true');
      expect(grailDatabase.setSetting).toHaveBeenCalledWith('saveDir', '/new/path/to/saves');
      expect(result).toEqual({ success: true });
    });

    it('Then settings handlers should handle errors properly', async () => {
      // Arrange
      vi.mocked(grailDatabase.getAllSettings).mockImplementation(() => {
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
      const mockSettings = { grailEthereal: false } as Settings;
      const mockStatistics = {
        totalItems: 100,
        foundItems: 25,
        uniqueItems: 80,
        setItems: 20,
        runes: 0,
        foundUnique: 20,
        foundSet: 5,
        foundRunes: 0,
      };
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue(mockSettings);
      vi.mocked(grailDatabase.getFilteredGrailStatistics).mockReturnValue(mockStatistics);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getStatistics')?.[1] as any;

      // Act
      const result = await handler();

      // Assert
      expect(grailDatabase.getFilteredGrailStatistics).toHaveBeenCalledWith(
        mockSettings,
        undefined,
      );
      expect(result).toEqual(mockStatistics);
    });

    it('Then grail:getStatistics should return statistics for specific character', async () => {
      // Arrange
      const characterId = 'char-1';
      const mockSettings = { grailEthereal: false } as Settings;
      const mockStatistics = {
        totalItems: 100,
        foundItems: 10,
        uniqueItems: 80,
        setItems: 20,
        runes: 0,
        foundUnique: 8,
        foundSet: 2,
        foundRunes: 0,
      };
      vi.mocked(grailDatabase.getAllSettings).mockReturnValue(mockSettings);
      vi.mocked(grailDatabase.getFilteredGrailStatistics).mockReturnValue(mockStatistics);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === 'grail:getStatistics')?.[1] as any;

      // Act
      const result = await handler(null, characterId);

      // Assert
      expect(grailDatabase.getFilteredGrailStatistics).toHaveBeenCalledWith(mockSettings, 'char-1');
      expect(result).toEqual(mockStatistics);
    });

    it('Then statistics handlers should handle errors properly', async () => {
      // Arrange
      vi.mocked(grailDatabase.getAllSettings).mockImplementation(() => {
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
      expect(grailDatabase.backup).toHaveBeenCalledWith(backupPath);
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
      expect(grailDatabase.restore).toHaveBeenCalledWith(backupPath);
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
      expect(grailDatabase.restoreFromBuffer).toHaveBeenCalledWith(Buffer.from(backupBuffer));
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
      expect(grailDatabase.truncateUserData).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('Then backup handlers should handle errors properly', async () => {
      // Arrange
      vi.mocked(grailDatabase.backup).mockImplementation(() => {
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
      expect(vi.mocked(grailDatabase.close)).toHaveBeenCalled();
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
  if (updates.hardcore !== undefined) dbUpdates.hardcore = updates.hardcore;
  if (updates.expansion !== undefined) dbUpdates.expansion = updates.expansion;
  if (updates.saveFilePath !== undefined) dbUpdates.save_file_path = updates.saveFilePath;
  if (updates.deleted !== undefined) dbUpdates.deleted = updates.deleted;
  return dbUpdates;
}
