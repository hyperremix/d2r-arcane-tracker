// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { items as grailItems } from '../items';
import { createInMemoryDatabase } from '../test/helpers/databaseHelpers';
import type { Item } from '../types/grail';
import { createDrizzleDb } from './drizzle';
import { ITEM_CATALOG_HASH_SETTING, syncItemCatalog } from './items';
import { initializeSchema } from './schema';
import type { DatabaseContext } from './types';

function totalChanges(ctx: DatabaseContext): number {
  return (ctx.rawDb.prepare('SELECT total_changes() AS changes').get() as { changes: number })
    .changes;
}

describe('When the item catalog is synced at startup', () => {
  let ctx: DatabaseContext;
  let logSpy: MockInstance<typeof console.log>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const rawDb = createInMemoryDatabase();
    ctx = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
    initializeSchema(ctx);
  });

  afterEach(() => {
    ctx.rawDb.close();
    logSpy.mockRestore();
  });

  describe('If the catalog did not change since the last sync', () => {
    it('Then the items table is not written', () => {
      // Arrange
      const changesBefore = totalChanges(ctx);

      // Act
      const synced = syncItemCatalog(ctx);

      // Assert
      expect(synced).toBe(false);
      expect(totalChanges(ctx)).toBe(changesBefore);
    });
  });

  describe('If one catalog item changed', () => {
    it('Then only that item is updated', () => {
      // Arrange
      const [first, ...rest] = grailItems;
      const changedCatalog: Item[] = [{ ...first, name: `${first.name} (renamed)` }, ...rest];
      const changesBefore = totalChanges(ctx);

      // Act
      const synced = syncItemCatalog(ctx, changedCatalog);

      // Assert
      expect(synced).toBe(true);
      expect(ctx.rawDb.prepare('SELECT name FROM items WHERE id = ?').get(first.id)).toEqual({
        name: `${first.name} (renamed)`,
      });
      // One item update and one hash update, each plus its updated_at trigger.
      expect(totalChanges(ctx) - changesBefore).toBeLessThanOrEqual(4);
    });
  });

  describe('If the stored catalog hash is missing', () => {
    it('Then the catalog is synced again and the hash is stored', () => {
      // Arrange
      ctx.rawDb.prepare('DELETE FROM settings WHERE key = ?').run(ITEM_CATALOG_HASH_SETTING);

      // Act
      const synced = syncItemCatalog(ctx);

      // Assert
      expect(synced).toBe(true);
      expect(
        ctx.rawDb
          .prepare('SELECT value FROM settings WHERE key = ?')
          .get(ITEM_CATALOG_HASH_SETTING),
      ).toEqual({ value: expect.stringMatching(/^[0-9a-f]{64}$/) });
    });
  });
});
