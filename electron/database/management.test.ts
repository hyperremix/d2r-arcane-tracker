import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createInMemoryDatabase } from '../test/helpers/databaseHelpers';
import { createDrizzleDb } from './drizzle';
import { backup, truncateUserData } from './management';
import { initializeSchema } from './schema';
import type { DatabaseContext } from './types';

function createContext(backupImpl: (path: string) => Promise<unknown>): DatabaseContext {
  return { rawDb: { backup: backupImpl } } as unknown as DatabaseContext;
}

describe('When backing up the database', () => {
  it('If the underlying backup is still running, Then the returned promise stays pending until it finishes', async () => {
    // Arrange
    let finish: () => void = () => undefined;
    const rawBackup = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let settled = false;

    // Act
    const pending = backup(createContext(rawBackup), '/tmp/backup.db').then(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    const settledBeforeFinish = settled;
    finish();
    await pending;

    // Assert
    expect(rawBackup).toHaveBeenCalledWith('/tmp/backup.db');
    expect(settledBeforeFinish).toBe(false);
    expect(settled).toBe(true);
  });

  it('If the underlying backup fails, Then the returned promise rejects with the error', async () => {
    // Arrange
    const rawBackup = vi.fn().mockRejectedValue(new Error('disk full'));

    // Act & Assert
    await expect(backup(createContext(rawBackup), '/tmp/backup.db')).rejects.toThrow('disk full');
  });
});

describe('When user data is truncated', () => {
  let ctx: DatabaseContext;
  let logSpy: MockInstance<typeof console.log>;
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rawDb = createInMemoryDatabase();
    ctx = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
    initializeSchema(ctx);
    rawDb.exec(`
      INSERT INTO characters (id, name, character_class) VALUES ('char-1', 'Hammerdin', 'paladin');
      INSERT INTO grail_progress (id, character_id, item_id)
        SELECT 'progress-1', 'char-1', id FROM items LIMIT 1;
      INSERT INTO save_file_states (id, file_path, last_modified, last_parsed)
        VALUES ('state-1', '/saves/Hammerdin.d2s', '2024-01-01', '2024-01-01');
      INSERT INTO sessions (id, start_time) VALUES ('session-1', '2024-01-01T10:00:00.000Z');
      INSERT INTO runs (id, session_id, character_id, run_number, start_time)
        VALUES ('run-1', 'session-1', 'char-1', 1, '2024-01-01T10:01:00.000Z');
      INSERT INTO vault_items (id, fingerprint, item_name, quality, raw_item_json,
          source_character_id, source_file_type)
        VALUES ('vault-1', 'fp-1', 'Shako', 'unique', '{}', 'char-1', 'd2s');
    `);
  });

  afterEach(() => {
    ctx.rawDb.close();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  const count = (table: string): number =>
    (ctx.rawDb.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;

  describe('If a run is linked to a character', () => {
    it('Then characters, progress and save file states are deleted and the run is kept unlinked', () => {
      // Act
      truncateUserData(ctx);

      // Assert
      expect(count('characters')).toBe(0);
      expect(count('grail_progress')).toBe(0);
      expect(count('save_file_states')).toBe(0);
      expect(count('runs')).toBe(1);
      expect(ctx.rawDb.prepare("SELECT character_id FROM runs WHERE id = 'run-1'").get()).toEqual({
        character_id: null,
      });
      expect(
        ctx.rawDb.prepare("SELECT source_character_id FROM vault_items WHERE id = 'vault-1'").get(),
      ).toEqual({ source_character_id: null });
    });
  });

  describe('If a delete fails part-way through', () => {
    it('Then no user data is changed', () => {
      // Arrange
      ctx.rawDb.exec(`
        CREATE TRIGGER fail_progress_delete BEFORE DELETE ON grail_progress
        BEGIN SELECT RAISE(ABORT, 'progress delete failed'); END;
      `);

      // Act
      const act = () => truncateUserData(ctx);

      // Assert
      expect(act).toThrow('progress delete failed');
      expect(count('characters')).toBe(1);
      expect(count('grail_progress')).toBe(1);
      expect(ctx.rawDb.prepare("SELECT character_id FROM runs WHERE id = 'run-1'").get()).toEqual({
        character_id: 'char-1',
      });
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('If a new save directory is persisted together with the truncate', () => {
    const savedDir = (): string | undefined =>
      (
        ctx.rawDb.prepare("SELECT value FROM settings WHERE key = 'saveDir'").get() as
          | { value: string }
          | undefined
      )?.value;

    it('Then the data is deleted and the new save directory is saved in the same transaction', () => {
      // Act
      truncateUserData(ctx, '/new/save/dir');

      // Assert
      expect(count('characters')).toBe(0);
      expect(count('grail_progress')).toBe(0);
      expect(savedDir()).toBe('/new/save/dir');
    });

    it('And writing the setting fails, Then the truncate is rolled back and the old setting is kept', () => {
      // Arrange
      ctx.rawDb.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('saveDir', '/old/dir')");
      ctx.rawDb.exec(`
        CREATE TRIGGER fail_save_dir_write BEFORE UPDATE ON settings
        WHEN NEW.key = 'saveDir'
        BEGIN SELECT RAISE(ABORT, 'disk full'); END;
      `);

      // Act
      const act = () => truncateUserData(ctx, '/new/save/dir');

      // Assert
      expect(act).toThrow('disk full');
      expect(count('characters')).toBe(1);
      expect(count('grail_progress')).toBe(1);
      expect(count('save_file_states')).toBe(1);
      expect(ctx.rawDb.prepare("SELECT character_id FROM runs WHERE id = 'run-1'").get()).toEqual({
        character_id: 'char-1',
      });
      expect(savedDir()).toBe('/old/dir');
    });

    it('And the truncate fails, Then the new save directory is not saved', () => {
      // Arrange
      ctx.rawDb.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('saveDir', '/old/dir')");
      ctx.rawDb.exec(`
        CREATE TRIGGER fail_progress_delete BEFORE DELETE ON grail_progress
        BEGIN SELECT RAISE(ABORT, 'progress delete failed'); END;
      `);

      // Act
      const act = () => truncateUserData(ctx, '/new/save/dir');

      // Assert
      expect(act).toThrow('progress delete failed');
      expect(savedDir()).toBe('/old/dir');
    });
  });
});
