import type { Database as DatabaseType } from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GrailProgressBuilder } from '@/fixtures';
import { createInMemoryDatabase, initializeDatabaseSchema } from '../test/helpers/databaseHelpers';
import type { Settings } from '../types/grail';
import { createDrizzleDb } from './drizzle';
import {
  deleteManualProgress,
  getAllProgress,
  getFilteredProgress,
  getProgressById,
  upsertProgress,
} from './progress';
import type { DatabaseContext } from './types';

function insertItem(rawDb: DatabaseType, id: string, type = 'unique'): void {
  rawDb
    .prepare(
      `INSERT INTO items (id, name, type, category, sub_category, treasure_class, ethereal_type)
       VALUES (?, ?, ?, 'armor', 'helms', 'elite', 'optional')`,
    )
    .run(id, id, type);
}

describe('When grail progress is persisted to the database', () => {
  let rawDb: DatabaseType;
  let ctx: DatabaseContext;

  beforeEach(() => {
    rawDb = createInMemoryDatabase();
    initializeDatabaseSchema(rawDb);
    ctx = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
    insertItem(rawDb, 'shako');
  });

  afterEach(() => {
    rawDb.close();
  });

  describe('If a manually added record is upserted', () => {
    it('Then it is stored as manually added and not auto-detected', () => {
      // Arrange
      const foundDate = new Date('2024-06-15T12:00:00.000Z');
      const progress = GrailProgressBuilder.new()
        .withId('manual_char-1_shako_ethereal_1')
        .withCharacterId('char-1')
        .withItemId('shako')
        .withFoundDate(foundDate)
        .withManuallyAdded(true)
        .asEthereal()
        .build();

      // Act
      upsertProgress(ctx, progress);

      // Assert
      const stored = getAllProgress(ctx);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        id: 'manual_char-1_shako_ethereal_1',
        characterId: 'char-1',
        itemId: 'shako',
        foundDate,
        manuallyAdded: true,
        isEthereal: true,
      });
      const row = rawDb
        .prepare('SELECT auto_detected FROM grail_progress WHERE id = ?')
        .get('manual_char-1_shako_ethereal_1') as { auto_detected: number };
      expect(row.auto_detected).toBe(0);
    });
  });

  describe('If a manually added record is deleted', () => {
    it('Then it is removed and true is returned', () => {
      // Arrange
      const progress = GrailProgressBuilder.new()
        .withId('manual-1')
        .withItemId('shako')
        .withManuallyAdded(true)
        .build();
      upsertProgress(ctx, progress);

      // Act
      const deleted = deleteManualProgress(ctx, 'manual-1');

      // Assert
      expect(deleted).toBe(true);
      expect(getAllProgress(ctx)).toEqual([]);
    });
  });

  describe('If an auto-detected record is deleted', () => {
    it('Then it is kept and false is returned', () => {
      // Arrange
      const progress = GrailProgressBuilder.new()
        .withId('auto-1')
        .withItemId('shako')
        .withManuallyAdded(false)
        .build();
      upsertProgress(ctx, progress);

      // Act
      const deleted = deleteManualProgress(ctx, 'auto-1');

      // Assert
      expect(deleted).toBe(false);
      expect(getAllProgress(ctx)).toHaveLength(1);
    });
  });

  describe('If a non-existent record is deleted', () => {
    it('Then false is returned', () => {
      // Arrange & Act
      const deleted = deleteManualProgress(ctx, 'missing');

      // Assert
      expect(deleted).toBe(false);
    });
  });

  describe('If a record is looked up by ID', () => {
    it('Then the stored record is returned', () => {
      // Arrange
      const progress = GrailProgressBuilder.new()
        .withId('auto-1')
        .withItemId('shako')
        .withManuallyAdded(false)
        .build();
      upsertProgress(ctx, progress);

      // Act
      const found = getProgressById(ctx, 'auto-1');

      // Assert
      expect(found).toMatchObject({ id: 'auto-1', itemId: 'shako', manuallyAdded: false });
    });

    it('Then null is returned if the record does not exist', () => {
      // Arrange & Act
      const found = getProgressById(ctx, 'missing');

      // Assert
      expect(found).toBeNull();
    });
  });

  describe('If progress is filtered by the grail settings', () => {
    beforeEach(() => {
      insertItem(rawDb, 'jah', 'rune');
      insertItem(rawDb, 'enigma', 'runeword');
      const records = [
        { id: 'p-shako', itemId: 'shako', updated: '2024-01-01T00:00:00.000Z' },
        { id: 'p-jah', itemId: 'jah', updated: '2024-01-03T00:00:00.000Z' },
        { id: 'p-enigma', itemId: 'enigma', updated: '2024-01-02T00:00:00.000Z' },
      ];
      for (const record of records) {
        upsertProgress(
          ctx,
          GrailProgressBuilder.new().withId(record.id).withItemId(record.itemId).build(),
        );
        rawDb
          .prepare('UPDATE grail_progress SET updated_at = ? WHERE id = ?')
          .run(record.updated, record.id);
      }
    });

    it('When runes are excluded, Then rune progress is left out and the newest record comes first', () => {
      // Arrange
      const settings = { grailRunes: false, grailRunewords: true } as Settings;

      // Act
      const filtered = getFilteredProgress(ctx, settings);

      // Assert
      expect(filtered.map((progress) => progress.id)).toEqual(['p-enigma', 'p-shako']);
    });

    it('When runes and runewords are excluded, Then only the other progress is returned', () => {
      // Arrange
      const settings = { grailRunes: false, grailRunewords: false } as Settings;

      // Act
      const filtered = getFilteredProgress(ctx, settings);

      // Assert
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toMatchObject({ id: 'p-shako', itemId: 'shako' });
    });
  });
});
