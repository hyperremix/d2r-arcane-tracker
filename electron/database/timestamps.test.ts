// @vitest-environment node
import type { Database as DatabaseType } from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createInMemoryDatabase } from '../test/helpers/databaseHelpers';
import { upsertCharacter } from './characters';
import { fromDbTimestamp } from './converters';
import { createDrizzleDb } from './drizzle';
import { addRunItem, getSessionItems } from './run-items';
import { getRunsBySession, upsertRun } from './runs';
import { createSchema, repairLiteralTimestamps } from './schema';
import { getSessionById, upsertSession } from './sessions';
import type { DatabaseContext } from './types';
import { upsertVaultItemByFingerprint } from './vault-items';

const SQLITE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function createContext(): DatabaseContext {
  const rawDb = createInMemoryDatabase();
  const ctx: DatabaseContext = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
  createSchema(ctx);
  return ctx;
}

function getTimestamps(
  rawDb: DatabaseType,
  table: string,
  id: string,
): { created_at: string; updated_at?: string } {
  return rawDb.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as {
    created_at: string;
    updated_at?: string;
  };
}

function seedSessionRunAndItem(ctx: DatabaseContext): void {
  upsertSession(ctx, {
    id: 'session-1',
    startTime: new Date('2024-05-01T10:00:00.000Z'),
    totalRunTime: 0,
    totalSessionTime: 0,
    runCount: 0,
    archived: false,
    created: new Date(),
    lastUpdated: new Date(),
  });
  upsertRun(ctx, {
    id: 'run-1',
    sessionId: 'session-1',
    runNumber: 1,
    startTime: new Date('2024-05-01T10:05:00.000Z'),
    created: new Date(),
    lastUpdated: new Date(),
  });
  addRunItem(ctx, {
    id: 'run-item-1',
    runId: 'run-1',
    name: 'Shako',
    foundTime: new Date('2024-05-01T10:06:00.000Z'),
    created: new Date(),
  });
}

describe('When rows are inserted through drizzle', () => {
  let ctx: DatabaseContext;
  let logSpy: MockInstance<typeof console.log>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    ctx = createContext();
  });

  afterEach(() => {
    ctx.rawDb.close();
    logSpy.mockRestore();
  });

  describe('If created_at and updated_at are left to their defaults', () => {
    it('Then real timestamps are stored instead of the text CURRENT_TIMESTAMP', () => {
      // Act
      seedSessionRunAndItem(ctx);
      upsertCharacter(ctx, {
        id: 'char-1',
        name: 'Hammerdin',
        characterClass: 'paladin',
        level: 90,
        hardcore: false,
        expansion: true,
        lastUpdated: new Date(),
        created: new Date(),
      });
      upsertVaultItemByFingerprint(ctx, {
        fingerprint: 'fp-1',
        itemName: 'Harlequin Crest',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
      });

      // Assert
      for (const [table, id] of [
        ['sessions', 'session-1'],
        ['runs', 'run-1'],
        ['characters', 'char-1'],
        ['vault_items', 'fp-1'],
      ] as const) {
        const row = getTimestamps(ctx.rawDb, table, id);
        expect(row.created_at, table).toMatch(SQLITE_TIMESTAMP);
        expect(row.updated_at, table).toMatch(SQLITE_TIMESTAMP);
      }
      expect(getTimestamps(ctx.rawDb, 'run_items', 'run-item-1').created_at).toMatch(
        SQLITE_TIMESTAMP,
      );
    });
  });

  describe('If a session, its runs and its items are read back', () => {
    it('Then every date is valid so the session can be exported', () => {
      // Arrange
      seedSessionRunAndItem(ctx);

      // Act
      const session = getSessionById(ctx, 'session-1');
      const runs = getRunsBySession(ctx, 'session-1');
      const items = getSessionItems(ctx, 'session-1');

      // Assert
      expect(() => session?.created.toISOString()).not.toThrow();
      expect(() => session?.lastUpdated.toISOString()).not.toThrow();
      expect(() => runs[0]?.created.toISOString()).not.toThrow();
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: 'run-item-1', runId: 'run-1', name: 'Shako' });
      expect(items[0]?.foundTime.toISOString()).toBe('2024-05-01T10:06:00.000Z');
      expect(() => items[0]?.created.toISOString()).not.toThrow();
    });
  });
});

describe('When legacy rows contain the literal text CURRENT_TIMESTAMP', () => {
  let ctx: DatabaseContext;
  let logSpy: MockInstance<typeof console.log>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    ctx = createContext();
    seedSessionRunAndItem(ctx);
    ctx.rawDb.exec(`
      DROP TRIGGER update_sessions_timestamp;
      UPDATE sessions SET created_at = 'CURRENT_TIMESTAMP', updated_at = 'CURRENT_TIMESTAMP';
      DROP TRIGGER update_runs_timestamp;
      UPDATE runs SET created_at = 'CURRENT_TIMESTAMP', updated_at = '2024-06-01 08:00:00';
      UPDATE run_items SET created_at = 'CURRENT_TIMESTAMP';
      INSERT INTO vault_categories (id, name, created_at, updated_at)
        VALUES ('cat-1', 'Keepers', 'CURRENT_TIMESTAMP', '2024-07-01 09:30:00');
    `);
    // Recreate the dropped triggers exactly as a real database has them.
    createSchema(ctx);
  });

  afterEach(() => {
    ctx.rawDb.close();
    logSpy.mockRestore();
  });

  describe('If the startup repair has run on them', () => {
    it('Then created_at uses the best known time, valid updated_at values are kept and a second run changes nothing', () => {
      // Arrange
      // (createSchema in beforeEach already ran the repair once)

      // Act
      // Run it again to prove idempotence
      repairLiteralTimestamps(ctx);

      // Assert
      expect(getTimestamps(ctx.rawDb, 'sessions', 'session-1')).toMatchObject({
        created_at: '2024-05-01 10:00:00',
        updated_at: '2024-05-01 10:00:00',
      });
      expect(getTimestamps(ctx.rawDb, 'runs', 'run-1')).toMatchObject({
        created_at: '2024-05-01 10:05:00',
        updated_at: '2024-06-01 08:00:00',
      });
      expect(getTimestamps(ctx.rawDb, 'run_items', 'run-item-1').created_at).toBe(
        '2024-05-01 10:06:00',
      );
      expect(getTimestamps(ctx.rawDb, 'vault_categories', 'cat-1')).toMatchObject({
        created_at: '2024-07-01 09:30:00',
        updated_at: '2024-07-01 09:30:00',
      });
    });

    it('Then the update-timestamp triggers still exist afterwards', () => {
      // Act
      ctx.rawDb.prepare("UPDATE runs SET duration = 1 WHERE id = 'run-1'").run();

      // Assert
      const triggers = ctx.rawDb
        .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'runs'")
        .all() as Array<{ name: string }>;
      expect(triggers.map((trigger) => trigger.name)).toEqual(['update_runs_timestamp']);
      expect(getTimestamps(ctx.rawDb, 'runs', 'run-1').updated_at).not.toBe('2024-06-01 08:00:00');
    });

    it('Then no literal CURRENT_TIMESTAMP values remain', () => {
      // Act
      const remaining = ctx.rawDb
        .prepare(
          `SELECT COUNT(*) AS count FROM (
             SELECT created_at AS value FROM sessions UNION ALL SELECT updated_at FROM sessions
             UNION ALL SELECT created_at FROM runs UNION ALL SELECT created_at FROM run_items
             UNION ALL SELECT created_at FROM vault_categories
           ) WHERE value = 'CURRENT_TIMESTAMP'`,
        )
        .get() as { count: number };

      // Assert
      expect(remaining.count).toBe(0);
    });
  });
});

describe('When a stored timestamp is converted to a Date', () => {
  describe('If it is in SQLite CURRENT_TIMESTAMP format', () => {
    it('Then it is interpreted as UTC', () => {
      // Act
      const result = fromDbTimestamp('2024-05-01 10:00:00');

      // Assert
      expect(result.toISOString()).toBe('2024-05-01T10:00:00.000Z');
    });
  });

  describe('If it is an ISO string', () => {
    it('Then it is parsed unchanged', () => {
      // Act
      const result = fromDbTimestamp('2024-05-01T10:00:00.123Z');

      // Assert
      expect(result.toISOString()).toBe('2024-05-01T10:00:00.123Z');
    });
  });

  describe.each([
    ['the literal text CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP'],
    ['null', null],
    ['undefined', undefined],
  ])('If it is %s', (_label, value) => {
    it('Then a valid date is returned instead of an Invalid Date', () => {
      // Act
      const result = fromDbTimestamp(value);

      // Assert
      expect(Number.isNaN(result.getTime())).toBe(false);
    });
  });
});
