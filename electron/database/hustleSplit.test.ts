import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createInMemoryDatabase } from '../test/helpers/databaseHelpers';
import { createDrizzleDb } from './drizzle';
import { HUSTLE_ITEM_ID, splitHustleIntoSuccessors } from './hustleSplit';
import { ITEM_CATALOG_HASH_SETTING } from './items';
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
  itemCode: string | undefined,
  characterId: string | undefined,
): void {
  ctx.rawDb
    .prepare(
      `INSERT INTO vault_items (id, fingerprint, item_name, item_code, quality, raw_item_json,
         source_character_id, source_file_type, grail_item_id)
       VALUES (?, ?, 'Hustle', ?, 'normal', '{}', ?, 'd2s', ?)`,
    )
    .run(id, `fingerprint-${id}`, itemCode ?? null, characterId ?? null, HUSTLE_ITEM_ID);
}

/** Puts the database in the state of a database from before Reign of the Warlock. */
function seedPreWarlockDatabase(ctx: DatabaseContext): void {
  ctx.rawDb.prepare(`DELETE FROM items WHERE id IN ('mania', 'hysteria')`).run();
  ctx.rawDb
    .prepare(`UPDATE settings SET value = 'pre-warlock-catalog' WHERE key = ?`)
    .run(ITEM_CATALOG_HASH_SETTING);
  insertHustleItem(ctx);
}

function getFinds(ctx: DatabaseContext, characterId: string) {
  return ctx.rawDb
    .prepare(
      `SELECT id, item_id AS itemId FROM grail_progress WHERE character_id = ? ORDER BY item_id`,
    )
    .all(characterId) as Array<{ id: string; itemId: string }>;
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
    it('Then each vault item moves to the runeword of its base item and each find to the runewords of its character', () => {
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
      expect(getFinds(ctx, 'armor-char')).toEqual([{ id: 'find-armor-char', itemId: 'hysteria' }]);
      expect(getFinds(ctx, 'weapon-char')).toEqual([{ id: 'find-weapon-char', itemId: 'mania' }]);
      expect(getFinds(ctx, 'no-vault-char')).toEqual([
        { id: 'find-no-vault-char', itemId: 'mania' },
      ]);
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

  describe('If a character has Hustle vault items in both weapons and body armor', () => {
    it('Then the character gets a Mania find and a Hysteria find with the same details', () => {
      // Arrange
      insertHustleItem(ctx);
      insertCharacter(ctx, 'both-char');
      ctx.rawDb
        .prepare(
          `INSERT INTO grail_progress (id, character_id, item_id, found_date, manually_added,
             auto_detected, difficulty, notes, is_ethereal, from_initial_scan)
           VALUES ('find-both', 'both-char', ?, '2025-01-02T03:04:05.000Z', 1, 0, 'hell',
             'found in Pit', 1, 1)`,
        )
        .run(HUSTLE_ITEM_ID);
      insertHustleVaultItem(ctx, 'both-armor', 'xtp', 'both-char');
      insertHustleVaultItem(ctx, 'both-weapon', 'crs', 'both-char');

      // Act
      splitHustleIntoSuccessors(ctx);

      // Assert
      const finds = getFinds(ctx, 'both-char');
      expect(finds.map((find) => find.itemId)).toEqual(['hysteria', 'mania']);
      expect(finds.find((find) => find.itemId === 'mania')?.id).toBe('find-both');
      const details = ctx.rawDb
        .prepare(
          `SELECT found_date, manually_added, auto_detected, difficulty, notes, is_ethereal,
             from_initial_scan, created_at, updated_at
           FROM grail_progress WHERE character_id = 'both-char' ORDER BY item_id`,
        )
        .all() as Record<string, unknown>[];
      expect(details[0]).toMatchObject({
        found_date: '2025-01-02T03:04:05.000Z',
        manually_added: 1,
        auto_detected: 0,
        difficulty: 'hell',
        notes: 'found in Pit',
        is_ethereal: 1,
        from_initial_scan: 1,
      });
      expect(details[1]).toMatchObject(details[0] as Record<string, unknown>);
    });
  });

  describe('If a character has several Hustle finds', () => {
    it('Then each find is split on its own', () => {
      // Arrange
      insertHustleItem(ctx);
      insertCharacter(ctx, 'both-char');
      insertHustleFind(ctx, 'find-1', 'both-char');
      insertHustleFind(ctx, 'find-2', 'both-char');
      insertHustleVaultItem(ctx, 'both-armor', 'xtp', 'both-char');
      insertHustleVaultItem(ctx, 'both-weapon', 'crs', 'both-char');

      // Act
      splitHustleIntoSuccessors(ctx);

      // Assert
      expect(getFinds(ctx, 'both-char').map((find) => find.itemId)).toEqual([
        'hysteria',
        'hysteria',
        'mania',
        'mania',
      ]);
    });
  });

  describe('If a Hustle vault item has no item code or no source character', () => {
    it('Then the item without a code moves to Mania and the one without a character does not move any find', () => {
      // Arrange
      insertHustleItem(ctx);
      insertCharacter(ctx, 'armor-char');
      insertHustleFind(ctx, 'find-armor-char', 'armor-char');
      insertHustleVaultItem(ctx, 'no-code', undefined, 'armor-char');
      insertHustleVaultItem(ctx, 'no-character', 'uui', undefined);

      // Act
      splitHustleIntoSuccessors(ctx);

      // Assert
      expect(getItemIdsById(ctx, 'vault_items', 'grail_item_id')).toEqual({
        'no-code': 'mania',
        'no-character': 'hysteria',
      });
      expect(getFinds(ctx, 'armor-char')).toEqual([{ id: 'find-armor-char', itemId: 'mania' }]);
    });
  });

  describe('If a run item points at a Hustle find', () => {
    it('Then the run item still points at that find after the split', () => {
      // Arrange
      insertHustleItem(ctx);
      insertCharacter(ctx, 'both-char');
      insertHustleFind(ctx, 'find-both', 'both-char');
      insertHustleVaultItem(ctx, 'both-armor', 'xtp', 'both-char');
      insertHustleVaultItem(ctx, 'both-weapon', 'crs', 'both-char');
      ctx.rawDb
        .prepare(`INSERT INTO sessions (id, start_time) VALUES ('session', '2025-01-01')`)
        .run();
      ctx.rawDb
        .prepare(
          `INSERT INTO runs (id, session_id, run_number, start_time)
           VALUES ('run', 'session', 1, '2025-01-01')`,
        )
        .run();
      ctx.rawDb
        .prepare(
          `INSERT INTO run_items (id, run_id, grail_progress_id, name, found_time)
           VALUES ('run-item', 'run', 'find-both', 'Hustle', '2025-01-01')`,
        )
        .run();

      // Act
      splitHustleIntoSuccessors(ctx);

      // Assert
      const runItem = ctx.rawDb
        .prepare(
          `SELECT grail_progress.item_id AS itemId FROM run_items
           JOIN grail_progress ON grail_progress.id = run_items.grail_progress_id
           WHERE run_items.id = 'run-item'`,
        )
        .get();
      expect(runItem).toEqual({ itemId: 'mania' });
    });
  });

  describe('If the split fails halfway', () => {
    it('Then nothing is changed and the split runs again on the next start', () => {
      // Arrange
      insertHustleItem(ctx);
      insertCharacter(ctx, 'armor-char');
      insertHustleFind(ctx, 'find-armor-char', 'armor-char');
      insertHustleVaultItem(ctx, 'dusk-shroud', 'uui', 'armor-char');
      ctx.rawDb.exec(
        `CREATE TRIGGER block_hustle_delete BEFORE DELETE ON items
         BEGIN SELECT RAISE(ABORT, 'blocked'); END`,
      );

      // Act
      const failingSplit = () => splitHustleIntoSuccessors(ctx);

      // Assert
      expect(failingSplit).toThrow('blocked');
      expect(getFinds(ctx, 'armor-char')).toEqual([{ id: 'find-armor-char', itemId: 'hustle' }]);
      expect(getItemIdsById(ctx, 'vault_items', 'grail_item_id')).toEqual({
        'dusk-shroud': 'hustle',
      });

      ctx.rawDb.exec('DROP TRIGGER block_hustle_delete');
      expect(splitHustleIntoSuccessors(ctx)).toBe(true);
      expect(getFinds(ctx, 'armor-char')).toEqual([{ id: 'find-armor-char', itemId: 'hysteria' }]);
    });
  });

  describe('If the database is opened with initializeSchema', () => {
    it('Then a database with Hustle is split after the item catalog sync and Hustle is deleted', () => {
      // Arrange
      seedPreWarlockDatabase(ctx);
      insertCharacter(ctx, 'both-char');
      insertHustleFind(ctx, 'find-both', 'both-char');
      insertHustleVaultItem(ctx, 'both-armor', 'xtp', 'both-char');
      insertHustleVaultItem(ctx, 'both-weapon', 'crs', 'both-char');

      // Act
      initializeSchema(ctx);

      // Assert
      expect(getFinds(ctx, 'both-char').map((find) => find.itemId)).toEqual(['hysteria', 'mania']);
      expect(getItemIdsById(ctx, 'vault_items', 'grail_item_id')).toEqual({
        'both-armor': 'hysteria',
        'both-weapon': 'mania',
      });
      expect(ctx.rawDb.prepare('SELECT id FROM items WHERE id = ?').get(HUSTLE_ITEM_ID)).toBe(
        undefined,
      );
      expect(
        ctx.rawDb.prepare(`SELECT id FROM items WHERE id IN ('mania', 'hysteria')`).all(),
      ).toHaveLength(2);
    });

    it('Then opening the database again changes nothing', () => {
      // Arrange
      seedPreWarlockDatabase(ctx);
      insertCharacter(ctx, 'armor-char');
      insertHustleFind(ctx, 'find-armor-char', 'armor-char');
      insertHustleVaultItem(ctx, 'dusk-shroud', 'uui', 'armor-char');
      initializeSchema(ctx);

      // Act
      initializeSchema(ctx);

      // Assert
      expect(getFinds(ctx, 'armor-char')).toEqual([{ id: 'find-armor-char', itemId: 'hysteria' }]);
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
