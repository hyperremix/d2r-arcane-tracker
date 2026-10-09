// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Database as DatabaseType } from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createInMemoryDatabase } from '../test/helpers/databaseHelpers';
import { createLegacyDatabase, type LegacyDatabaseVersion } from '../test/helpers/legacyDatabase';
import { createDrizzleDb } from './drizzle';
import { MIGRATIONS_TABLE, resolveMigrationsFolder, runMigrations } from './migrator';
import { initializeSchema } from './schema';
import type { DatabaseContext } from './types';

function createContext(): DatabaseContext {
  const rawDb = createInMemoryDatabase();
  return { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
}

interface ColumnInfo {
  name: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

function normalizeDefault(value: string | null): string | null {
  if (value === null || value.toUpperCase() === 'NULL') {
    return null;
  }
  return value.replace(/^\((.*)\)$/, '$1').toLowerCase();
}

/**
 * Extracts the normalized CHECK expressions of a table definition, so that quoting and whitespace
 * differences between the legacy script and the generated migrations do not matter.
 */
function extractChecks(createSql: string): string[] {
  const checks: string[] = [];
  const pattern = /\bCHECK\s*\(/gi;
  let match = pattern.exec(createSql);
  while (match !== null) {
    let depth = 1;
    let end = match.index + match[0].length;
    while (end < createSql.length && depth > 0) {
      if (createSql[end] === '(') depth += 1;
      if (createSql[end] === ')') depth -= 1;
      end += 1;
    }
    checks.push(
      createSql
        .slice(match.index + match[0].length, end - 1)
        .replace(/[\s`"]/g, '')
        .toLowerCase(),
    );
    match = pattern.exec(createSql);
  }
  return checks.sort();
}

/**
 * Lists the unique indexes of a table, including the implicit ones SQLite creates for inline
 * UNIQUE and PRIMARY KEY constraints, as one "unique (columns)" entry per index. Duplicates are
 * kept so that redundant indexes show up.
 */
function listUniqueIndexes(rawDb: DatabaseType, table: string): string[] {
  return (rawDb.pragma(`index_list(${table})`) as Array<{ name: string; unique: number }>)
    .filter((index) => index.unique === 1)
    .map(
      (index) =>
        `(${(rawDb.pragma(`index_info(${index.name})`) as Array<{ name: string }>)
          .map((column) => column.name)
          .join(',')})`,
    )
    .sort();
}

/**
 * Describes everything about a schema that affects behavior: tables, columns (nullability and
 * defaults), primary keys, foreign keys with their actions, CHECK constraints, named indexes, the
 * distinct column sets that are enforced unique (also when enforced by an inline UNIQUE
 * constraint) and triggers. Declared column types (legacy DATETIME/BOOLEAN vs. drizzle
 * text/integer), column order and how many indexes enforce the same uniqueness are ignored; see
 * `listUniqueIndexes` for the latter.
 */
function describeSchema(rawDb: DatabaseType): Record<string, unknown> {
  const tables = rawDb
    .prepare(
      `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
         AND name <> ? ORDER BY name`,
    )
    .all(MIGRATIONS_TABLE) as Array<{ name: string; sql: string }>;
  const description: Record<string, unknown> = {};
  for (const { name, sql } of tables) {
    const columns = (rawDb.pragma(`table_info(${name})`) as ColumnInfo[])
      .map(
        (column) =>
          `${column.name} pk=${column.pk} notnull=${column.pk ? 'pk' : column.notnull} default=${normalizeDefault(column.dflt_value)}`,
      )
      .sort();
    const foreignKeys = (
      rawDb.pragma(`foreign_key_list(${name})`) as Array<{
        from: string;
        table: string;
        to: string;
        on_delete: string;
      }>
    )
      .map((fk) => `${fk.from} -> ${fk.table}.${fk.to} on delete ${fk.on_delete}`)
      .sort();
    const indexes = (rawDb.pragma(`index_list(${name})`) as Array<{ name: string; unique: number }>)
      .filter((index) => !index.name.startsWith('sqlite_autoindex'))
      .map((index) => {
        const indexColumns = (rawDb.pragma(`index_info(${index.name})`) as Array<{ name: string }>)
          .map((column) => column.name)
          .join(',');
        return `${index.name} unique=${index.unique} (${indexColumns})`;
      })
      .sort();
    const uniqueColumnSets = [...new Set(listUniqueIndexes(rawDb, name))];
    description[name] = {
      columns,
      foreignKeys,
      checks: extractChecks(sql),
      indexes,
      uniqueColumnSets,
    };
  }
  description.triggers = (
    rawDb
      .prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'trigger' ORDER BY name")
      .all() as Array<{ name: string; tbl_name: string }>
  ).map((trigger) => `${trigger.name} on ${trigger.tbl_name}`);
  return description;
}

function countRows(rawDb: DatabaseType, table: string): number {
  return (rawDb.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as { count: number })
    .count;
}

function getSetting(rawDb: DatabaseType, key: string): string | undefined {
  const row = rawDb.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

const journalEntryCount = (
  JSON.parse(
    readFileSync(path.join(resolveMigrationsFolder(), 'meta', '_journal.json'), 'utf8'),
  ) as { entries: unknown[] }
).entries.length;

describe('When the schema is initialized', () => {
  let logSpy: MockInstance<typeof console.log>;
  let warnSpy: MockInstance<typeof console.warn>;
  const contexts: DatabaseContext[] = [];

  const track = (ctx: DatabaseContext): DatabaseContext => {
    contexts.push(ctx);
    return ctx;
  };

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const ctx of contexts.splice(0)) {
      ctx.rawDb.close();
    }
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('If the database is new', () => {
    it('Then every migration is applied and the defaults and item catalog are in place', () => {
      // Arrange
      const ctx = track(createContext());

      // Act
      initializeSchema(ctx);

      // Assert
      expect(countRows(ctx.rawDb, MIGRATIONS_TABLE)).toBe(journalEntryCount);
      expect(getSetting(ctx.rawDb, 'lang')).toBe('en');
      expect(getSetting(ctx.rawDb, 'runTrackerMemoryReading')).toBe('true');
      expect(countRows(ctx.rawDb, 'items')).toBeGreaterThan(0);
      expect(ctx.rawDb.pragma('foreign_keys', { simple: true })).toBe(1);
    });

    it('Then a character delete clears runs.character_id instead of failing', () => {
      // Arrange
      const ctx = track(createContext());
      initializeSchema(ctx);
      ctx.rawDb.exec(`
        INSERT INTO characters (id, name, character_class) VALUES ('char-1', 'Hammerdin', 'paladin');
        INSERT INTO sessions (id, start_time) VALUES ('session-1', '2024-01-01T10:00:00.000Z');
        INSERT INTO runs (id, session_id, character_id, run_number, start_time)
          VALUES ('run-1', 'session-1', 'char-1', 1, '2024-01-01T10:01:00.000Z');
      `);

      // Act
      ctx.rawDb.exec("DELETE FROM characters WHERE id = 'char-1'");

      // Assert
      expect(ctx.rawDb.prepare("SELECT character_id FROM runs WHERE id = 'run-1'").get()).toEqual({
        character_id: null,
      });
    });

    it('Then the CHECK constraints of the old schema still reject invalid values', () => {
      // Arrange
      const ctx = track(createContext());
      initializeSchema(ctx);

      // Act
      const insertInvalidClass = () =>
        ctx.rawDb.exec(
          "INSERT INTO characters (id, name, character_class) VALUES ('c', 'X', 'warlock')",
        );

      // Assert
      expect(insertInvalidClass).toThrow('CHECK constraint failed');
    });
  });

  describe.each<[string, LegacyDatabaseVersion]>([
    ['a v0.4 release (no vault tables)', 'v0.4'],
    ['the last version before migrations', 'pre-migrations'],
  ])('If the database was created by %s', (_label, version) => {
    it('Then it ends up with the same schema as a new database', () => {
      // Arrange
      const fresh = track(createContext());
      const legacy = track(createContext());
      createLegacyDatabase(legacy.rawDb, version);

      // Act
      initializeSchema(fresh);
      initializeSchema(legacy);

      // Assert
      expect(describeSchema(legacy.rawDb)).toEqual(describeSchema(fresh.rawDb));
      const characterChecks = (describeSchema(fresh.rawDb).characters as { checks: string[] })
        .checks;
      expect(characterChecks.length).toBeGreaterThan(0);
      expect(countRows(legacy.rawDb, MIGRATIONS_TABLE)).toBe(journalEntryCount);
    });

    it('Then the only unique index it has more than a new database is the documented redundant one', () => {
      // Arrange
      const fresh = track(createContext());
      const legacy = track(createContext());
      createLegacyDatabase(legacy.rawDb, version);
      const tableNames = (ctx: DatabaseContext) =>
        (
          ctx.rawDb
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name",
            )
            .all() as Array<{ name: string }>
        ).map((table) => table.name);

      // Act
      initializeSchema(fresh);
      initializeSchema(legacy);
      const extraUniqueIndexes = tableNames(fresh).flatMap((table) => {
        const remaining = listUniqueIndexes(fresh.rawDb, table);
        const extras: string[] = [];
        for (const entry of listUniqueIndexes(legacy.rawDb, table)) {
          const position = remaining.indexOf(entry);
          if (position === -1) {
            extras.push(`${table}${entry}`);
          } else {
            remaining.splice(position, 1);
          }
        }
        return extras;
      });

      // Assert
      // A legacy table declared `file_path TEXT NOT NULL UNIQUE`, which SQLite backs with an
      // implicit index. The baseline also names the unique index (so that later migrations can
      // drop or change it), and SQLite cannot drop an inline UNIQUE without rebuilding the table.
      // Both enforce the same rule, so the upgraded database carries the constraint twice.
      expect(extraUniqueIndexes).toEqual(['save_file_states(file_path)']);
    });

    it('Then a duplicate save file path is still rejected', () => {
      // Arrange
      const ctx = track(createContext());
      createLegacyDatabase(ctx.rawDb, version);
      initializeSchema(ctx);
      ctx.rawDb.exec(
        "INSERT INTO save_file_states (id, file_path, last_modified, last_parsed) VALUES ('s0', '/saves/a.d2s', 1, 1)",
      );

      // Act
      const insertDuplicate = () =>
        ctx.rawDb.exec(
          "INSERT INTO save_file_states (id, file_path, last_modified, last_parsed) VALUES ('s1', '/saves/a.d2s', 2, 2)",
        );

      // Assert
      expect(insertDuplicate).toThrow('UNIQUE constraint failed: save_file_states.file_path');
    });

    it('Then all user data is kept, including run items of the rebuilt runs table', () => {
      // Arrange
      const ctx = track(createContext());
      createLegacyDatabase(ctx.rawDb, version);
      ctx.rawDb.exec(`
        INSERT INTO items (id, name, type, category, sub_category, treasure_class, ethereal_type)
          VALUES ('test-item', 'Test Item', 'unique', 'armor', 'helms', 'elite', 'none');
        INSERT INTO characters (id, name, character_class) VALUES ('char-1', 'Hammerdin', 'paladin');
        INSERT INTO grail_progress (id, character_id, item_id, found_date)
          VALUES ('progress-1', 'char-1', 'test-item', '2024-01-01T10:02:00.000Z');
        INSERT INTO sessions (id, start_time) VALUES ('session-1', '2024-01-01T10:00:00.000Z');
        INSERT INTO runs (id, session_id, character_id, run_number, start_time, duration)
          VALUES ('run-1', 'session-1', 'char-1', 1, '2024-01-01T10:01:00.000Z', 60000);
        INSERT INTO run_items (id, run_id, grail_progress_id, name, found_time)
          VALUES ('run-item-1', 'run-1', 'progress-1', 'Test Item', '2024-01-01T10:02:00.000Z');
        UPDATE settings SET value = 'D:/Saved Games' WHERE key = 'saveDir';
      `);

      // Act
      initializeSchema(ctx);

      // Assert
      expect(countRows(ctx.rawDb, 'characters')).toBe(1);
      expect(countRows(ctx.rawDb, 'grail_progress')).toBe(1);
      expect(countRows(ctx.rawDb, 'sessions')).toBe(1);
      expect(ctx.rawDb.prepare("SELECT * FROM runs WHERE id = 'run-1'").get()).toMatchObject({
        session_id: 'session-1',
        character_id: 'char-1',
        run_number: 1,
        duration: 60000,
      });
      expect(countRows(ctx.rawDb, 'run_items')).toBe(1);
      expect(getSetting(ctx.rawDb, 'saveDir')).toBe('D:/Saved Games');
      expect(ctx.rawDb.pragma('foreign_key_check')).toEqual([]);
    });
  });

  describe('If a pre-migrations vault row only has its raw item JSON', () => {
    let ctx: DatabaseContext;

    beforeEach(() => {
      ctx = track(createContext());
      createLegacyDatabase(ctx.rawDb, 'pre-migrations');
      ctx.rawDb
        .prepare(
          `INSERT INTO vault_items (id, fingerprint, item_name, item_code, quality, raw_item_json,
             source_file_type, location_context)
           VALUES ('vault-1', 'fp-1', 'Shako', 'uap', 'unique', ?, 'd2s', 'inventory')`,
        )
        .run(
          JSON.stringify({
            inv_file: 'invhamm',
            type_name: 'Shako',
            location_id: 0,
            alt_position_id: 1,
            position_x: 3,
            position_y: 2,
            inv_width: 2,
            inv_height: 2,
          }),
        );
    });

    const readGrid = () =>
      ctx.rawDb
        .prepare('SELECT grid_x, grid_y, grid_width, grid_height FROM vault_items WHERE id = ?')
        .get('vault-1');

    it('Then the derived vault columns are backfilled during the upgrade', () => {
      // Act
      initializeSchema(ctx);

      // Assert
      expect(readGrid()).toEqual({ grid_x: 3, grid_y: 2, grid_width: 2, grid_height: 2 });
    });

    it('Then later starts do not re-run the backfill', () => {
      // Arrange
      initializeSchema(ctx);
      ctx.rawDb.exec("UPDATE vault_items SET grid_x = NULL, icon_file_name = 'custom.png'");

      // Act
      initializeSchema(ctx);

      // Assert
      expect(
        ctx.rawDb
          .prepare("SELECT grid_x, icon_file_name FROM vault_items WHERE id = 'vault-1'")
          .get(),
      ).toEqual({ grid_x: null, icon_file_name: 'custom.png' });
    });
  });

  describe('If the user had switched run tracker auto mode off before the upgrade', () => {
    it('Then the upgrade turns it on once and a later choice to switch it off is kept', () => {
      // Arrange
      const ctx = track(createContext());
      createLegacyDatabase(ctx.rawDb, 'pre-migrations');
      ctx.rawDb.exec("UPDATE settings SET value = 'false' WHERE key = 'runTrackerMemoryReading'");

      // Act
      initializeSchema(ctx);
      const afterUpgrade = getSetting(ctx.rawDb, 'runTrackerMemoryReading');
      ctx.rawDb.exec("UPDATE settings SET value = 'false' WHERE key = 'runTrackerMemoryReading'");
      initializeSchema(ctx);

      // Assert
      expect(afterUpgrade).toBe('true');
      expect(getSetting(ctx.rawDb, 'runTrackerMemoryReading')).toBe('false');
    });
  });

  describe('If a migration fails', () => {
    let migrationsFolder: string;

    beforeEach(() => {
      migrationsFolder = mkdtempSync(path.join(tmpdir(), 'grail-migrations-'));
      cpSync(resolveMigrationsFolder(), migrationsFolder, { recursive: true });
      const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
      const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
        entries: Array<{ idx: number; when: number; tag: string }>;
      };
      const last = journal.entries[journal.entries.length - 1];
      journal.entries.push({
        ...last,
        idx: last.idx + 1,
        when: last.when + 1,
        tag: '9999_broken',
      });
      writeFileSync(journalPath, JSON.stringify(journal));
      writeFileSync(
        path.join(migrationsFolder, '9999_broken.sql'),
        "UPDATE settings SET value = 'changed';--> statement-breakpoint\nSELECT * FROM missing_table;",
      );
    });

    afterEach(() => {
      rmSync(migrationsFolder, { recursive: true, force: true });
    });

    it('Then it throws, rolls back and turns foreign keys back on', () => {
      // Arrange
      const ctx = track(createContext());
      initializeSchema(ctx);

      // Act
      const act = () => runMigrations(ctx, migrationsFolder);

      // Assert
      expect(act).toThrow();
      expect(getSetting(ctx.rawDb, 'lang')).toBe('en');
      expect(countRows(ctx.rawDb, MIGRATIONS_TABLE)).toBe(journalEntryCount);
      expect(ctx.rawDb.pragma('foreign_keys', { simple: true })).toBe(1);
    });
  });
});
