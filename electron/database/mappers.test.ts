import { describe, expect, it } from 'vitest';
import type { DatabaseGrailProgress, GrailProgress, Item } from '../types/grail';
import {
  fromSqliteBoolean,
  fromSqliteDate,
  mapCharacterToDatabase,
  mapDatabaseCharacterToCharacter,
  mapDatabaseItemToItem,
  mapDatabaseProgressToProgress,
  mapItemToDatabase,
  mapProgressToDatabase,
  mapValuesToSqlite,
  toSqliteBoolean,
  toSqliteDate,
  toSqliteNull,
} from './mappers';

describe('mappers', () => {
  describe('toSqliteBoolean', () => {
    it('should convert true to 1', () => {
      expect(toSqliteBoolean(true)).toBe(1);
    });

    it('should convert false to 0', () => {
      expect(toSqliteBoolean(false)).toBe(0);
    });
  });

  describe('toSqliteNull', () => {
    it('should convert undefined to null', () => {
      expect(toSqliteNull(undefined)).toBeNull();
    });

    it('should return the original value if not undefined', () => {
      expect(toSqliteNull('test')).toBe('test');
      expect(toSqliteNull(42)).toBe(42);
      expect(toSqliteNull(null)).toBeNull();
    });
  });

  describe('toSqliteDate', () => {
    it('should convert Date object to ISO string', () => {
      const date = new Date('2024-01-01T12:00:00.000Z');
      expect(toSqliteDate(date)).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should return string as-is', () => {
      const dateString = '2024-01-01T12:00:00.000Z';
      expect(toSqliteDate(dateString)).toBe(dateString);
    });

    it('should return null for undefined', () => {
      expect(toSqliteDate(undefined)).toBeNull();
    });

    it('should return null for null', () => {
      expect(toSqliteDate(null)).toBeNull();
    });
  });

  describe('mapCharacterToDatabase', () => {
    it('should map character with all fields', () => {
      const character = {
        id: 'char-1',
        name: 'TestChar',
        character_class: 'barbarian' as const,
        level: 80,
        difficulty: 'hell' as const,
        hardcore: true,
        expansion: false,
        save_file_path: '/path/to/save.d2s',
      };

      const mapped = mapCharacterToDatabase(character);

      expect(mapped).toEqual({
        id: 'char-1',
        name: 'TestChar',
        character_class: 'barbarian',
        level: 80,
        difficulty: 'hell',
        hardcore: 1, // boolean converted to 1
        expansion: 0, // boolean converted to 0
        save_file_path: '/path/to/save.d2s',
      });
    });

    it('should map character with undefined save_file_path', () => {
      const character = {
        id: 'char-1',
        name: 'TestChar',
        character_class: 'sorceress' as const,
        level: 1,
        difficulty: 'normal' as const,
        hardcore: false,
        expansion: true,
        save_file_path: undefined,
      };

      const mapped = mapCharacterToDatabase(character);

      expect(mapped.save_file_path).toBeNull();
    });
  });

  describe('mapProgressToDatabase', () => {
    it('should map progress with all fields', () => {
      const progress: GrailProgress = {
        id: 'progress-1',
        characterId: 'char-1',
        itemId: 'shako',
        foundDate: new Date('2024-01-01T12:00:00.000Z'),
        foundBy: 'TestCharacter',
        manuallyAdded: false,
        difficulty: 'hell' as const,
        notes: 'Found in Baal run',
        isEthereal: false,
      };

      const mapped = mapProgressToDatabase(progress);

      expect(mapped).toEqual({
        id: 'progress-1',
        character_id: 'char-1',
        item_id: 'shako',
        found_date: '2024-01-01T12:00:00.000Z', // Date converted to ISO string
        manually_added: 0, // boolean converted to 0
        auto_detected: 1, // boolean converted to 1
        difficulty: 'hell',
        notes: 'Found in Baal run',
        is_ethereal: 0, // boolean converted to 0
      });
    });

    it('should map progress with undefined optional fields', () => {
      const progress: GrailProgress = {
        id: 'progress-1',
        characterId: 'char-1',
        itemId: 'shako',
        foundDate: undefined,
        foundBy: undefined,
        manuallyAdded: true,
        difficulty: undefined,
        notes: undefined,
        isEthereal: true,
      };

      const mapped = mapProgressToDatabase(progress);

      expect(mapped.found_date).toBeNull();
      expect(mapped.difficulty).toBeNull();
      expect(mapped.notes).toBeNull();
    });
  });

  describe('mapItemToDatabase', () => {
    it('should map item with all fields', () => {
      const item: Item = {
        id: 'shako',
        name: 'Harlequin Crest',
        link: 'https://example.com/shako',
        code: 'shako',
        type: 'unique',
        category: 'armor',
        subCategory: 'helms',
        treasureClass: 'elite',
        setName: undefined,
        etherealType: 'none',
      };

      const mapped = mapItemToDatabase(item);

      expect(mapped).toEqual({
        id: 'shako',
        name: 'Harlequin Crest',
        link: 'https://example.com/shako',
        code: 'shako',
        type: 'unique',
        category: 'armor',
        sub_category: 'helms',
        treasure_class: 'elite',
        set_name: null, // undefined converted to null
        ethereal_type: 'none',
      });
    });

    it('should map item with undefined optional fields', () => {
      const item: Item = {
        id: 'shako',
        name: 'Harlequin Crest',
        link: 'https://example.com/shako',
        code: undefined,
        type: 'unique',
        category: 'armor',
        subCategory: 'helms',
        treasureClass: 'elite',
        setName: 'Angelic Raiment',
        etherealType: 'optional',
      };

      const mapped = mapItemToDatabase(item);

      expect(mapped.code).toBeNull();
      expect(mapped.set_name).toBe('Angelic Raiment');
    });
  });

  describe('mapValuesToSqlite', () => {
    it('should map mixed values correctly', () => {
      const values = [
        'string',
        42,
        true,
        false,
        undefined,
        null,
        new Date('2024-01-01T12:00:00.000Z'),
      ];

      const mapped = mapValuesToSqlite(values);

      expect(mapped).toEqual([
        'string',
        42,
        1, // true -> 1
        0, // false -> 0
        null, // undefined -> null
        null,
        '2024-01-01T12:00:00.000Z', // Date -> ISO string
      ]);
    });

    it('should handle empty array', () => {
      const mapped = mapValuesToSqlite([]);
      expect(mapped).toEqual([]);
    });

    it('should convert unknown types to strings', () => {
      const values = [{ test: 'object' }, ['array'], Symbol('symbol')];
      const mapped = mapValuesToSqlite(values);

      expect(mapped).toEqual(['[object Object]', 'array', 'Symbol(symbol)']);
    });
  });

  describe('fromSqliteBoolean', () => {
    it('should convert 1 to true', () => {
      expect(fromSqliteBoolean(1)).toBe(true);
    });

    it('should convert 0 to false', () => {
      expect(fromSqliteBoolean(0)).toBe(false);
    });
  });

  describe('fromSqliteDate', () => {
    it('should convert ISO string to Date object', () => {
      const dateString = '2024-01-01T12:00:00.000Z';
      const result = fromSqliteDate(dateString);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(dateString);
    });

    it('should return undefined for null', () => {
      expect(fromSqliteDate(null)).toBeUndefined();
    });
  });

  describe('mapDatabaseCharacterToCharacter', () => {
    it('should map database character to character', () => {
      const dbCharacter = {
        id: 'char-1',
        name: 'TestChar',
        character_class: 'barbarian' as const,
        level: 80,
        difficulty: 'hell' as const,
        hardcore: 1 as const,
        expansion: 0 as const,
        save_file_path: '/path/to/save.d2s',
        deleted_at: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T12:00:00.000Z',
      };

      const mapped = mapDatabaseCharacterToCharacter(dbCharacter);

      expect(mapped).toEqual({
        id: 'char-1',
        name: 'TestChar',
        characterClass: 'barbarian',
        level: 80,
        difficulty: 'hell',
        hardcore: true,
        expansion: false,
        saveFilePath: '/path/to/save.d2s',
        lastUpdated: new Date('2024-01-01T12:00:00.000Z'),
        created: new Date('2024-01-01T00:00:00.000Z'),
        deleted: undefined,
      });
    });
  });

  describe('mapDatabaseProgressToProgress', () => {
    it('should map database progress to progress', () => {
      const dbProgress: DatabaseGrailProgress = {
        id: 'prog-1',
        character_id: 'char-1',
        item_id: 'item-1',
        found_date: '2024-01-01T12:00:00.000Z',
        manually_added: 0 as const,
        auto_detected: 1 as const,
        difficulty: 'hell' as const,
        notes: 'Found in Baal run',
        is_ethereal: 1 as const,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T12:00:00.000Z',
      };

      const mapped = mapDatabaseProgressToProgress(dbProgress);

      expect(mapped).toEqual({
        id: 'prog-1',
        characterId: 'char-1',
        itemId: 'item-1',
        foundDate: new Date('2024-01-01T12:00:00.000Z'),
        foundBy: undefined,
        manuallyAdded: false,
        difficulty: 'hell',
        notes: 'Found in Baal run',
        isEthereal: true,
      });
    });
  });

  describe('mapDatabaseItemToItem', () => {
    it('should map database item to item', () => {
      const dbItem = {
        id: 'item-1',
        name: 'Unique Ring',
        link: 'https://diablo.fandom.com/wiki/Unique_Ring',
        code: 'rin',
        ethereal_type: 'optional' as const,
        type: 'unique' as const,
        category: 'jewelry' as const,
        sub_category: 'rings' as const,
        treasure_class: 'elite' as const,
        set_name: 'Angelic Raiment' as const,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      const mapped = mapDatabaseItemToItem(dbItem);

      expect(mapped).toEqual({
        id: 'item-1',
        name: 'Unique Ring',
        link: 'https://diablo.fandom.com/wiki/Unique_Ring',
        code: 'rin',
        etherealType: 'optional',
        type: 'unique',
        category: 'jewelry',
        subCategory: 'rings',
        treasureClass: 'elite',
        setName: 'Angelic Raiment',
      });
    });
  });
});
