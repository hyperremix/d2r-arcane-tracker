import type { Database as DatabaseType } from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GrailProgressBuilder } from '@/fixtures';
import { createInMemoryDatabase, initializeDatabaseSchema } from '../test/helpers/databaseHelpers';
import { createDrizzleDb } from './drizzle';
import { deleteManualProgress, getAllProgress, getProgressById, upsertProgress } from './progress';
import type { DatabaseContext } from './types';

function insertItem(rawDb: DatabaseType, id: string): void {
  rawDb
    .prepare(
      `INSERT INTO items (id, name, type, category, sub_category, treasure_class, ethereal_type)
       VALUES (?, ?, 'unique', 'armor', 'helms', 'elite', 'optional')`,
    )
    .run(id, id);
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
});
