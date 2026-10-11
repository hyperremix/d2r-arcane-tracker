import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createInMemoryDatabase } from '../test/helpers/databaseHelpers';
import { getAllCharacters } from './characters';
import { createDrizzleDb } from './drizzle';
import { resolveMigrationsFolder, runMigrations } from './migrator';
import type { DatabaseContext } from './types';

const REPAIR_MIGRATION_TAG = '0003_repair_character_records';
const SAVE_DIR = '/saves/mods/givemhell';

interface CharacterRow {
  id: string;
  name: string;
  character_class: string;
  level?: number;
  hardcore?: number;
  save_file_path?: string | null;
}

interface StoredCharacterRow {
  id: string;
  name: string;
  hardcore: number;
  deleted_at: string | null;
}

/** Copies the migrations folder without the repair migration and the ones after it. */
function createMigrationsFolderBeforeRepair(): string {
  const folder = mkdtempSync(path.join(tmpdir(), 'grail-migrations-before-repair-'));
  cpSync(resolveMigrationsFolder(), folder, { recursive: true });
  const journalPath = path.join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ tag: string }>;
  };
  const repairIndex = journal.entries.findIndex(({ tag }) => tag === REPAIR_MIGRATION_TAG);
  journal.entries = journal.entries.slice(0, repairIndex);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

function insertCharacter(ctx: DatabaseContext, row: CharacterRow): void {
  ctx.rawDb
    .prepare(
      `INSERT INTO characters (id, name, character_class, level, hardcore, save_file_path)
       VALUES (@id, @name, @character_class, @level, @hardcore, @save_file_path)`,
    )
    .run({ level: 1, hardcore: 0, save_file_path: null, ...row });
}

function insertProgress(ctx: DatabaseContext, id: string, characterId: string): void {
  ctx.rawDb
    .prepare('INSERT INTO grail_progress (id, character_id, item_id) VALUES (?, ?, ?)')
    .run(id, characterId, 'shako');
}

function getCharacterRow(ctx: DatabaseContext, id: string): StoredCharacterRow {
  return ctx.rawDb
    .prepare('SELECT id, name, hardcore, deleted_at FROM characters WHERE id = ?')
    .get(id) as StoredCharacterRow;
}

function getProgressOwners(ctx: DatabaseContext): Record<string, string> {
  const rows = ctx.rawDb
    .prepare('SELECT id, character_id FROM grail_progress ORDER BY id')
    .all() as Array<{ id: string; character_id: string }>;
  return Object.fromEntries(rows.map((row) => [row.id, row.character_id]));
}

describe('When the character record repair migration runs', () => {
  let ctx: DatabaseContext;
  let migrationsBeforeRepair: string;
  let logSpy: MockInstance<typeof console.log>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rawDb = createInMemoryDatabase();
    ctx = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
    migrationsBeforeRepair = createMigrationsFolderBeforeRepair();
    runMigrations(ctx, migrationsBeforeRepair);
    ctx.rawDb
      .prepare(
        `INSERT INTO items (id, name, type, category, sub_category, treasure_class, ethereal_type)
         VALUES ('shako', 'Shako', 'unique', 'armor', 'helms', 'elite', 'optional')`,
      )
      .run();
  });

  afterEach(() => {
    ctx.rawDb.close();
    rmSync(migrationsBeforeRepair, { recursive: true, force: true });
    logSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('If a hardcore .d2i stash was stored under a softcore name', () => {
    it('Then its name and hardcore flag follow the file name', () => {
      // Arrange
      insertCharacter(ctx, {
        id: 'hc-stash',
        name: 'Shared Stash Softcore',
        character_class: 'shared_stash',
        save_file_path: `${SAVE_DIR}/SharedStashHardCoreV2.d2i`,
      });
      insertCharacter(ctx, {
        id: 'modern-hc-stash',
        name: 'Modern Shared Stash Softcore',
        character_class: 'shared_stash',
        save_file_path: 'C:\\Saves\\ModernSharedStashHardCoreV2.d2i',
      });
      insertCharacter(ctx, {
        id: 'sc-stash',
        name: 'Shared Stash Softcore',
        character_class: 'shared_stash',
        save_file_path: `${SAVE_DIR}/SharedStashSoftCoreV2.d2i`,
      });

      // Act
      runMigrations(ctx);

      // Assert
      expect(getCharacterRow(ctx, 'hc-stash')).toMatchObject({
        name: 'Shared Stash Hardcore',
        hardcore: 1,
        deleted_at: null,
      });
      expect(getCharacterRow(ctx, 'modern-hc-stash')).toMatchObject({
        name: 'Modern Shared Stash Hardcore',
        hardcore: 1,
      });
      expect(getCharacterRow(ctx, 'sc-stash')).toMatchObject({
        name: 'Shared Stash Softcore',
        hardcore: 0,
      });
    });
  });

  describe('If a backup copy of a stash was stored as a stash', () => {
    it('Then it is hidden when no progress belongs to it, and kept otherwise', () => {
      // Arrange
      insertCharacter(ctx, {
        id: 'empty-backup',
        name: 'Shared Stash Hardcore',
        character_class: 'shared_stash',
        hardcore: 1,
        save_file_path: `${SAVE_DIR}/SharedStashSoftCoreV2_Backup.d2i`,
      });
      insertCharacter(ctx, {
        id: 'backup-with-progress',
        name: 'Shared Stash Hardcore',
        character_class: 'shared_stash',
        hardcore: 1,
        save_file_path: `${SAVE_DIR}/SharedStashHardCoreV2.bak.d2i`,
      });
      insertProgress(ctx, 'progress-in-backup', 'backup-with-progress');

      // Act
      runMigrations(ctx);

      // Assert
      expect(getCharacterRow(ctx, 'empty-backup').deleted_at).not.toBeNull();
      expect(getCharacterRow(ctx, 'backup-with-progress').deleted_at).toBeNull();
      expect(getProgressOwners(ctx)).toEqual({ 'progress-in-backup': 'backup-with-progress' });
    });
  });

  describe('If records without a save file duplicate a character with one', () => {
    it('Then their progress and runs move to that character and they are hidden', () => {
      // Arrange
      insertCharacter(ctx, {
        id: 'barb',
        name: 'Barb',
        character_class: 'barbarian',
        level: 81,
        save_file_path: `${SAVE_DIR}/Barb.d2s`,
      });
      insertCharacter(ctx, { id: 'barb-orphan-1', name: 'Barb', character_class: 'barbarian' });
      insertCharacter(ctx, { id: 'barb-orphan-2', name: 'Barb', character_class: 'barbarian' });
      insertProgress(ctx, 'progress-1', 'barb-orphan-1');
      insertProgress(ctx, 'progress-2', 'barb-orphan-2');
      insertProgress(ctx, 'progress-3', 'barb');
      ctx.rawDb.exec(`
        INSERT INTO sessions (id, start_time) VALUES ('session-1', '2024-01-01T10:00:00.000Z');
        INSERT INTO runs (id, session_id, character_id, run_number, start_time)
          VALUES ('run-1', 'session-1', 'barb-orphan-1', 1, '2024-01-01T10:00:00.000Z');
      `);

      // Act
      runMigrations(ctx);

      // Assert
      expect(getProgressOwners(ctx)).toEqual({
        'progress-1': 'barb',
        'progress-2': 'barb',
        'progress-3': 'barb',
      });
      expect(ctx.rawDb.prepare("SELECT character_id FROM runs WHERE id = 'run-1'").get()).toEqual({
        character_id: 'barb',
      });
      expect(getAllCharacters(ctx).map(({ id }) => id)).toEqual(['barb']);
      expect(getCharacterRow(ctx, 'barb-orphan-1').deleted_at).not.toBeNull();
    });

    it('Then a stash duplicate is matched after the stash names were corrected', () => {
      // Arrange
      insertCharacter(ctx, {
        id: 'hc-stash',
        name: 'Shared Stash Softcore',
        character_class: 'shared_stash',
        save_file_path: `${SAVE_DIR}/SharedStashHardCoreV2.d2i`,
      });
      insertCharacter(ctx, {
        id: 'sc-stash',
        name: 'Shared Stash Softcore',
        character_class: 'shared_stash',
        save_file_path: `${SAVE_DIR}/SharedStashSoftCoreV2.d2i`,
      });
      insertCharacter(ctx, {
        id: 'stash-orphan',
        name: 'Shared Stash Softcore',
        character_class: 'shared_stash',
        level: 96,
      });
      insertProgress(ctx, 'progress-1', 'stash-orphan');

      // Act
      runMigrations(ctx);

      // Assert
      expect(getProgressOwners(ctx)).toEqual({ 'progress-1': 'sc-stash' });
      expect(getCharacterRow(ctx, 'stash-orphan').deleted_at).not.toBeNull();
    });
  });

  describe('If the match of a record without a save file is ambiguous or missing', () => {
    it('Then the record and its progress are left as they are', () => {
      // Arrange
      insertCharacter(ctx, {
        id: 'sorc-a',
        name: 'Sorc',
        character_class: 'sorceress',
        save_file_path: '/saves/a/Sorc.d2s',
      });
      insertCharacter(ctx, {
        id: 'sorc-b',
        name: 'Sorc',
        character_class: 'sorceress',
        save_file_path: '/saves/b/Sorc.d2s',
      });
      insertCharacter(ctx, { id: 'sorc-orphan', name: 'Sorc', character_class: 'sorceress' });
      insertCharacter(ctx, { id: 'lonely-orphan', name: 'Gone', character_class: 'druid' });
      insertCharacter(ctx, { id: 'other-class', name: 'Sorc', character_class: 'amazon' });
      insertProgress(ctx, 'progress-1', 'sorc-orphan');
      insertProgress(ctx, 'progress-2', 'lonely-orphan');
      insertProgress(ctx, 'progress-3', 'other-class');

      // Act
      runMigrations(ctx);

      // Assert
      expect(getProgressOwners(ctx)).toEqual({
        'progress-1': 'sorc-orphan',
        'progress-2': 'lonely-orphan',
        'progress-3': 'other-class',
      });
      expect(getAllCharacters(ctx)).toHaveLength(5);
    });
  });
});
