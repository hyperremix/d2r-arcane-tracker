import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrailDataService } from './grail-data-service';

// Mock database types
interface MockDatabaseItem {
  id: string;
  name: string;
  type: 'unique' | 'set' | 'rune' | 'runeword';
  category: string;
  sub_category: string;
  set_name?: string;
  ethereal_type: 'none' | 'optional' | 'only';
  created_at: string;
  updated_at: string;
}

interface MockDatabaseProgress {
  id: string;
  character_id: string;
  item_id: string;
  found: boolean;
  found_date?: string;
  manually_added: boolean;
  auto_detected: boolean;
  difficulty?: 'normal' | 'nightmare' | 'hell';
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface MockGrailDatabase {
  getAllItems: ReturnType<typeof vi.fn>;
  getProgressByCharacter: ReturnType<typeof vi.fn>;
}

// Mock database implementation
const createMockDatabase = (): MockGrailDatabase => ({
  getAllItems: vi.fn(),
  getProgressByCharacter: vi.fn(),
});

describe('When GrailDataService is used', () => {
  let service: GrailDataService;
  let mockDatabase: MockGrailDatabase;

  beforeEach(() => {
    mockDatabase = createMockDatabase();
    // biome-ignore lint/suspicious/noExplicitAny: Mock database for testing
    service = new GrailDataService(mockDatabase as any);
  });

  describe('If getItemsByCategory is called', () => {
    it('Then should return items filtered by category', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Windforce',
          type: 'unique',
          category: 'weapons',
          sub_category: 'bows',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item3',
          name: 'Another Helmet',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.getItemsByCategory('armor');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Shako');
      expect(result[1].name).toBe('Another Helmet');
      expect(mockDatabase.getAllItems).toHaveBeenCalledOnce();
    });

    it('Then should return empty array if no items match category', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.getItemsByCategory('weapons');

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('If getItemsByType is called', () => {
    it('Then should return items filtered by type', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Angelic Raiment',
          type: 'set',
          category: 'armor',
          sub_category: 'armor',
          set_name: 'Angelic Raiment',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item3',
          name: 'El Rune',
          type: 'rune',
          category: 'runes',
          sub_category: 'runes',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.getItemsByType('unique');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Shako');
      expect(result[0].type).toBe('unique');
    });

    it('Then should return items for set type', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Angelic Raiment',
          type: 'set',
          category: 'armor',
          sub_category: 'armor',
          set_name: 'Angelic Raiment',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.getItemsByType('set');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Angelic Raiment');
      expect(result[0].type).toBe('set');
    });

    it('Then should return items for rune type', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'El Rune',
          type: 'rune',
          category: 'runes',
          sub_category: 'runes',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Zod Rune',
          type: 'rune',
          category: 'runes',
          sub_category: 'runes',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.getItemsByType('rune');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('El Rune');
      expect(result[1].name).toBe('Zod Rune');
    });
  });

  describe('If getItemsByRarity is called', () => {
    it('Then should return all items since rarity is not stored', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Windforce',
          type: 'unique',
          category: 'weapons',
          sub_category: 'bows',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.getItemsByRarity('extremely_rare');

      // Assert
      expect(result).toHaveLength(2);
      expect(mockDatabase.getAllItems).toHaveBeenCalledOnce();
    });
  });

  describe('If searchItemsByName is called', () => {
    it('Then should return items matching search term', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Windforce',
          type: 'unique',
          category: 'weapons',
          sub_category: 'bows',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item3',
          name: 'Shield',
          type: 'unique',
          category: 'armor',
          sub_category: 'shields',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.searchItemsByName('sh');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Shako');
      expect(result[1].name).toBe('Shield');
    });

    it('Then should be case insensitive', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Windforce',
          type: 'unique',
          category: 'weapons',
          sub_category: 'bows',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.searchItemsByName('SHAKO');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Shako');
    });

    it('Then should return empty array if no matches found', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.searchItemsByName('nonexistent');

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('If getItemsByDifficulty is called', () => {
    it('Then should return all items since difficulties are not stored', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Windforce',
          type: 'unique',
          category: 'weapons',
          sub_category: 'bows',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.getItemsByDifficulty('hell');

      // Assert
      expect(result).toHaveLength(2);
      expect(mockDatabase.getAllItems).toHaveBeenCalledOnce();
    });
  });

  describe('If getItemStatistics is called', () => {
    it('Then should return correct statistics', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Windforce',
          type: 'unique',
          category: 'weapons',
          sub_category: 'bows',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item3',
          name: 'Angelic Raiment',
          type: 'set',
          category: 'armor',
          sub_category: 'armor',
          set_name: 'Angelic Raiment',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item4',
          name: 'El Rune',
          type: 'rune',
          category: 'runes',
          sub_category: 'runes',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.getItemStatistics();

      // Assert
      expect(result.total).toBe(4);
      expect(result.byType.unique).toBe(2);
      expect(result.byType.set).toBe(1);
      expect(result.byType.rune).toBe(1);
      expect(result.byCategory.armor).toBe(2);
      expect(result.byCategory.weapons).toBe(1);
      expect(result.byCategory.runes).toBe(1);
    });

    it('Then should handle empty item list', () => {
      // Arrange
      mockDatabase.getAllItems.mockReturnValue([]);

      // Act
      const result = service.getItemStatistics();

      // Assert
      expect(result.total).toBe(0);
      expect(result.byType).toEqual({});
      expect(result.byCategory).toEqual({});
    });
  });

  describe('If getGrailCompletion is called', () => {
    it('Then should return completion statistics for character', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Windforce',
          type: 'unique',
          category: 'weapons',
          sub_category: 'bows',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item3',
          name: 'Angelic Raiment',
          type: 'set',
          category: 'armor',
          sub_category: 'armor',
          set_name: 'Angelic Raiment',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      const mockProgress: MockDatabaseProgress[] = [
        {
          id: 'progress1',
          character_id: 'char1',
          item_id: 'item1',
          found: true,
          found_date: '2024-01-01',
          manually_added: false,
          auto_detected: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'progress2',
          character_id: 'char1',
          item_id: 'item2',
          found: true,
          found_date: '2024-01-01',
          manually_added: false,
          auto_detected: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'progress3',
          character_id: 'char1',
          item_id: 'item3',
          found: false,
          manually_added: false,
          auto_detected: false,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockDatabase.getAllItems.mockReturnValue(mockItems);
      mockDatabase.getProgressByCharacter.mockReturnValue(mockProgress);

      // Act
      const result = service.getGrailCompletion('char1');

      // Assert
      expect(result.totalItems).toBe(3);
      expect(result.foundItems).toBe(2);
      expect(result.completionPercentage).toBe(67);
      expect(result.missingItems).toHaveLength(1);
      expect(result.missingItems[0].name).toBe('Angelic Raiment');
    });

    it('Then should return 100% completion when all items found', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Windforce',
          type: 'unique',
          category: 'weapons',
          sub_category: 'bows',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      const mockProgress: MockDatabaseProgress[] = [
        {
          id: 'progress1',
          character_id: 'char1',
          item_id: 'item1',
          found: true,
          found_date: '2024-01-01',
          manually_added: false,
          auto_detected: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'progress2',
          character_id: 'char1',
          item_id: 'item2',
          found: true,
          found_date: '2024-01-01',
          manually_added: false,
          auto_detected: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockDatabase.getAllItems.mockReturnValue(mockItems);
      mockDatabase.getProgressByCharacter.mockReturnValue(mockProgress);

      // Act
      const result = service.getGrailCompletion('char1');

      // Assert
      expect(result.totalItems).toBe(2);
      expect(result.foundItems).toBe(2);
      expect(result.completionPercentage).toBe(100);
      expect(result.missingItems).toHaveLength(0);
    });

    it('Then should return 0% completion when no character specified', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'item2',
          name: 'Windforce',
          type: 'unique',
          category: 'weapons',
          sub_category: 'bows',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockDatabase.getAllItems.mockReturnValue(mockItems);

      // Act
      const result = service.getGrailCompletion();

      // Assert
      expect(result.totalItems).toBe(2);
      expect(result.foundItems).toBe(0);
      expect(result.completionPercentage).toBe(0);
      expect(result.missingItems).toHaveLength(2);
      expect(result.missingItems[0].name).toBe('Shako');
      expect(result.missingItems[1].name).toBe('Windforce');
    });

    it('Then should handle empty item list', () => {
      // Arrange
      mockDatabase.getAllItems.mockReturnValue([]);
      mockDatabase.getProgressByCharacter.mockReturnValue([]);

      // Act
      const result = service.getGrailCompletion('char1');

      // Assert
      expect(result.totalItems).toBe(0);
      expect(result.foundItems).toBe(0);
      expect(result.completionPercentage).toBe(0);
      expect(result.missingItems).toHaveLength(0);
    });

    it('Then should handle character with no progress', () => {
      // Arrange
      const mockItems: MockDatabaseItem[] = [
        {
          id: 'item1',
          name: 'Shako',
          type: 'unique',
          category: 'armor',
          sub_category: 'helms',
          ethereal_type: 'none',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockDatabase.getAllItems.mockReturnValue(mockItems);
      mockDatabase.getProgressByCharacter.mockReturnValue([]);

      // Act
      const result = service.getGrailCompletion('char1');

      // Assert
      expect(result.totalItems).toBe(1);
      expect(result.foundItems).toBe(0);
      expect(result.completionPercentage).toBe(0);
      expect(result.missingItems).toHaveLength(1);
      expect(result.missingItems[0].name).toBe('Shako');
    });
  });
});
