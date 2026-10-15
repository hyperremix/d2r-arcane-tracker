import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createInMemoryDatabase } from '../test/helpers/databaseHelpers';
import { createDrizzleDb } from './drizzle';
import { HUSTLE_ITEM_ID, splitHustleIntoSuccessors } from './hustleSplit';
import { initializeSchema } from './schema';
import type { DatabaseContext } from './types';

function insertHustleItem(ctx: DatabaseContext): void {
  ctx.rawDb
    .prepare(
      `INSERT INTO items (id, name, type, category, sub_category, treasure_class, ethereal_type)
       VALUES (?, 'Hustle', 'runeword', 'runewords', 'runewords', 'normal', 'none')`,
    )
    .run(HUSTLE_ITEM_ID);
}

function insertCharacter(ctx: DatabaseContext, id: string): void {
  ctx.rawDb
    .prepare(`INSERT INTO characters (id, name, character_class) VALUES (?, ?, 'paladin')`)
    .run(id, id);
}

function insertHustleFind(ctx: DatabaseContext, id: string, characterId: string): void {
  ctx.rawDb
    .prepare(`INSERT INTO grail_progress (id, character_id, item_id) VALUES (?, ?, ?)`)
    .run(id, characterId, HUSTLE_ITEM_ID);
}

function insertHustleVaultItem(
  ctx: DatabaseContext,
  id: string,
  itemCode: string,
  characterId: string,
): void {
  ctx.rawDb
    .prepare(
      `INSERT INTO vault_items (id, fingerprint, item_name, item_code, quality, raw_item_json,
         source_character_id, source_file_type, grail_item_id)
       VALUES (?, ?, 'Hustle', ?, 'normal', '{}', ?, 'd2s', ?)`,
    )
    .run(id, `fingerprint-${id}`, itemCode, characterId, HUSTLE_ITEM_ID);
}

function getItemIdsById(ctx: DatabaseContext, table: string, column: string) {
  const rows = ctx.rawDb.prepare(`SELECT id, ${column} AS itemId FROM ${table}`).all() as Array<{
    id: string;
    itemId: string;
  }>;
  return Object.fromEntries(rows.map((row) => [row.id, row.itemId]));
}

describe('When the Hustle runeword is split into Mania and Hysteria', () => {
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

  describe('If a database from before Reign of the Warlock has Hustle finds', () => {
    it('Then each find and vault item moves to the runeword of its base item', () => {
      // Arrange
      insertHustleItem(ctx);
      for (const characterId of ['armor-char', 'weapon-char', 'both-char', 'no-vault-char']) {
        insertCharacter(ctx, characterId);
        insertHustleFind(ctx, `find-${characterId}`, characterId);
      }
      insertHustleVaultItem(ctx, 'dusk-shroud', 'uui', 'armor-char');
      insertHustleVaultItem(ctx, 'phase-blade', '7cr', 'weapon-char');
      insertHustleVaultItem(ctx, 'both-armor', 'xtp', 'both-char');
      insertHustleVaultItem(ctx, 'both-weapon', 'crs', 'both-char');

      // Act
      const split = splitHustleIntoSuccessors(ctx);

      // Assert
      expect(split).toBe(true);
      expect(getItemIdsById(ctx, 'grail_progress', 'item_id')).toEqual({
        'find-armor-char': 'hysteria',
        'find-weapon-char': 'mania',
        'find-both-char': 'mania',
        'find-no-vault-char': 'mania',
      });
      expect(getItemIdsById(ctx, 'vault_items', 'grail_item_id')).toEqual({
        'dusk-shroud': 'hysteria',
        'phase-blade': 'mania',
        'both-armor': 'hysteria',
        'both-weapon': 'mania',
      });
      expect(ctx.rawDb.prepare('SELECT id FROM items WHERE id = ?').get(HUSTLE_ITEM_ID)).toBe(
        undefined,
      );
    });
  });

  describe('If Hustle was already split', () => {
    it('Then nothing changes', () => {
      // Arrange
      insertHustleItem(ctx);
      splitHustleIntoSuccessors(ctx);

      // Act
      const split = splitHustleIntoSuccessors(ctx);

      // Assert
      expect(split).toBe(false);
    });
  });
});
