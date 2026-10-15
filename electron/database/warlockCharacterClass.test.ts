import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createInMemoryDatabase } from '../test/helpers/databaseHelpers';
import { createDrizzleDb } from './drizzle';
import { resolveMigrationsFolder, runMigrations } from './migrator';
import type { DatabaseContext } from './types';

const WARLOCK_MIGRATION_TAG = '0004_characters_allow_warlock';

/** Copies the migrations folder without the Warlock migration and the ones after it. */
function createMigrationsFolderBeforeWarlock(): string {
  const folder = mkdtempSync(path.join(tmpdir(), 'grail-migrations-before-warlock-'));
  cpSync(resolveMigrationsFolder(), folder, { recursive: true });
  const journalPath = path.join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ tag: string }>;
  };
  const warlockIndex = journal.entries.findIndex(({ tag }) => tag === WARLOCK_MIGRATION_TAG);
  journal.entries = journal.entries.slice(0, warlockIndex);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

function insertCharacter(ctx: DatabaseContext, id: string, characterClass: string): void {
  ctx.rawDb
    .prepare(
      `INSERT INTO characters (id, name, character_class, level, hardcore, save_file_path, created_at, updated_at)
       VALUES (?, ?, ?, 90, 1, ?, '2024-01-01 10:00:00', '2024-01-02 10:00:00')`,
    )
    .run(id, `Name of ${id}`, characterClass, `/saves/${id}.d2s`);
}

describe('When the migration that allows Warlock characters runs', () => {
  let ctx: DatabaseContext;
  let migrationsBeforeWarlock: string;
  let logSpy: MockInstance<typeof console.log>;
  let warnSpy: MockInstance<typeof console.warn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rawDb = createInMemoryDatabase();
    ctx = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
    migrationsBeforeWarlock = createMigrationsFolderBeforeWarlock();
    runMigrations(ctx, migrationsBeforeWarlock);
  });

  afterEach(() => {
    ctx.rawDb.close();
    rmSync(migrationsBeforeWarlock, { recursive: true, force: true });
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('If the database already has characters and rows that reference them', () => {
    it('Then every character and every referencing row is kept as it was', () => {
      // Arrange
      insertCharacter(ctx, 'char-1', 'paladin');
      insertCharacter(ctx, 'stash-1', 'shared_stash');
      ctx.rawDb.exec(`
        INSERT INTO items (id, name, type, category, sub_category, treasure_class, ethereal_type)
          VALUES ('shako', 'Shako', 'unique', 'armor', 'helms', 'elite', 'optional');
        INSERT INTO grail_progress (id, character_id, item_id) VALUES ('progress-1', 'char-1', 'shako');
        INSERT INTO sessions (id, start_time) VALUES ('session-1', '2024-01-01T10:00:00.000Z');
        INSERT INTO runs (id, session_id, character_id, run_number, start_time)
          VALUES ('run-1', 'session-1', 'char-1', 1, '2024-01-01T10:01:00.000Z');
        INSERT INTO vault_items (id, fingerprint, item_name, quality, raw_item_json, source_character_id, source_file_type)
          VALUES ('vault-1', 'fingerprint-1', 'Shako', 'unique', '{}', 'stash-1', 'd2i');
      `);
      const charactersBefore = ctx.rawDb.prepare('SELECT * FROM characters ORDER BY id').all();

      // Act
      runMigrations(ctx);

      // Assert
      expect(ctx.rawDb.prepare('SELECT * FROM characters ORDER BY id').all()).toEqual(
        charactersBefore,
      );
      expect(ctx.rawDb.prepare('SELECT character_id FROM grail_progress').all()).toEqual([
        { character_id: 'char-1' },
      ]);
      expect(ctx.rawDb.prepare('SELECT character_id FROM runs').all()).toEqual([
        { character_id: 'char-1' },
      ]);
      expect(ctx.rawDb.prepare('SELECT source_character_id FROM vault_items').all()).toEqual([
        { source_character_id: 'stash-1' },
      ]);
      expect(ctx.rawDb.pragma('foreign_key_check')).toEqual([]);
      expect(ctx.rawDb.pragma('foreign_keys', { simple: true })).toBe(1);
    });
  });

  describe('If a Warlock character is stored afterwards', () => {
    it('Then it is accepted, while an unknown class is still rejected', () => {
      // Arrange
      runMigrations(ctx);

      // Act
      const insertWarlock = () => insertCharacter(ctx, 'warlock-1', 'warlock');
      const insertUnknown = () => insertCharacter(ctx, 'unknown-1', 'unknown');

      // Assert
      expect(insertWarlock).not.toThrow();
      expect(insertUnknown).toThrow('CHECK constraint failed');
      expect(
        ctx.rawDb.prepare("SELECT character_class FROM characters WHERE id = 'warlock-1'").get(),
      ).toEqual({ character_class: 'warlock' });
    });
  });

  describe('If a character is updated afterwards', () => {
    it('Then its updated_at is refreshed by the recreated trigger', () => {
      // Arrange
      insertCharacter(ctx, 'char-1', 'paladin');
      runMigrations(ctx);

      // Act
      ctx.rawDb.exec("UPDATE characters SET level = 91 WHERE id = 'char-1'");

      // Assert
      const { updated_at: updatedAt } = ctx.rawDb
        .prepare("SELECT updated_at FROM characters WHERE id = 'char-1'")
        .get() as { updated_at: string };
      expect(updatedAt).not.toBe('2024-01-02 10:00:00');
    });
  });
});
