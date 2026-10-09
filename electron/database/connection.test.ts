// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { BUSY_TIMEOUT_MS, openConnection, type RestoreTarget, restoreDatabase } from './connection';
import { createDrizzleDb } from './drizzle';
import { createSchema } from './schema';

/**
 * Minimal stand-in for GrailDatabase: same connection and schema initialization,
 * without the Electron app dependency.
 */
class TestDatabase implements RestoreTarget {
  rawDb: Database.Database;
  failNextInitialization = false;

  constructor(readonly dbPath: string) {
    this.rawDb = openConnection(dbPath);
    createSchema({ rawDb: this.rawDb, db: createDrizzleDb(this.rawDb), dbPath });
  }

  closeConnection(): void {
    this.rawDb.close();
  }

  openConnectionAndInitialize(): void {
    const rawDb = openConnection(this.dbPath);
    this.rawDb = rawDb;
    try {
      if (this.failNextInitialization) {
        this.failNextInitialization = false;
        throw new Error('schema initialization failed');
      }
      createSchema({ rawDb, db: createDrizzleDb(rawDb), dbPath: this.dbPath });
    } catch (error) {
      rawDb.close();
      throw error;
    }
  }
}

function setSaveDir(rawDb: Database.Database, value: string): void {
  rawDb.prepare("UPDATE settings SET value = ? WHERE key = 'saveDir'").run(value);
}

function getSaveDir(rawDb: Database.Database): string {
  const row = rawDb.prepare("SELECT value FROM settings WHERE key = 'saveDir'").get() as {
    value: string;
  };
  return row.value;
}

describe('When the database is restored from a backup', () => {
  let tempDir: string;
  let database: TestDatabase;
  let backupPath: string;
  let logSpy: MockInstance<typeof console.log>;

  beforeEach(async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    tempDir = mkdtempSync(path.join(tmpdir(), 'grail-restore-'));

    // A backup created the same way the app does it (WAL-mode online backup).
    const source = new TestDatabase(path.join(tempDir, 'source.db'));
    setSaveDir(source.rawDb, '/backup/save/dir');
    backupPath = path.join(tempDir, 'backup.db');
    await source.rawDb.backup(backupPath);
    source.closeConnection();

    database = new TestDatabase(path.join(tempDir, 'grail.db'));
    setSaveDir(database.rawDb, '/current/save/dir');
  });

  afterEach(() => {
    if (database.rawDb.open) {
      database.rawDb.close();
    }
    rmSync(tempDir, { recursive: true, force: true });
    logSpy.mockRestore();
  });

  function expectNoTemporaryFiles(): void {
    expect(existsSync(`${database.dbPath}.pre-restore`)).toBe(false);
    expect(existsSync(`${database.dbPath}.restore-candidate`)).toBe(false);
  }

  describe('If the backup is a valid file', () => {
    it('Then the backup data is live and the connection pragmas are re-applied', () => {
      // Act
      restoreDatabase(database, { kind: 'file', path: backupPath });

      // Assert
      expect(getSaveDir(database.rawDb)).toBe('/backup/save/dir');
      expect(database.rawDb.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(database.rawDb.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(database.rawDb.pragma('busy_timeout', { simple: true })).toBe(BUSY_TIMEOUT_MS);
      expectNoTemporaryFiles();
    });
  });

  describe('If the backup is provided as a buffer', () => {
    it('Then the backup data is live and the temporary files are removed', () => {
      // Arrange
      const data = readFileSync(backupPath);

      // Act
      restoreDatabase(database, { kind: 'buffer', data });

      // Assert
      expect(getSaveDir(database.rawDb)).toBe('/backup/save/dir');
      expect(database.rawDb.pragma('foreign_keys', { simple: true })).toBe(1);
      expectNoTemporaryFiles();
    });
  });

  describe('If the backup is not a SQLite database', () => {
    it('Then the restore is rejected and the original data stays live', () => {
      // Arrange
      const originalConnection = database.rawDb;
      const data = Buffer.from('definitely not a database file, just some text');

      // Act
      const act = () => restoreDatabase(database, { kind: 'buffer', data });

      // Assert
      expect(act).toThrow('not a SQLite database');
      expect(database.rawDb).toBe(originalConnection);
      expect(getSaveDir(database.rawDb)).toBe('/current/save/dir');
      expectNoTemporaryFiles();
    });
  });

  describe('If the backup has a SQLite header but corrupt content', () => {
    it('Then the restore is rejected and the original data stays live', () => {
      // Arrange
      const data = Buffer.alloc(8192, 0xab);
      Buffer.from('SQLite format 3\0', 'binary').copy(data);
      const corruptPath = path.join(tempDir, 'corrupt.db');
      writeFileSync(corruptPath, data);

      // Act
      const act = () => restoreDatabase(database, { kind: 'file', path: corruptPath });

      // Assert
      expect(act).toThrow();
      expect(getSaveDir(database.rawDb)).toBe('/current/save/dir');
      expectNoTemporaryFiles();
    });
  });

  describe('If the backup is a SQLite database without the app tables', () => {
    it('Then the restore is rejected and the original data stays live', async () => {
      // Arrange
      const foreign = openConnection(path.join(tempDir, 'foreign.db'));
      foreign.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)');
      const foreignBackupPath = path.join(tempDir, 'foreign-backup.db');
      await foreign.backup(foreignBackupPath);
      foreign.close();

      // Act
      const act = () => restoreDatabase(database, { kind: 'file', path: foreignBackupPath });

      // Assert
      expect(act).toThrow('missing tables');
      expect(getSaveDir(database.rawDb)).toBe('/current/save/dir');
      expectNoTemporaryFiles();
    });
  });

  describe('If schema initialization fails on the restored database', () => {
    it('Then the previous database is put back and reopened with the standard pragmas', () => {
      // Arrange
      database.failNextInitialization = true;

      // Act
      const act = () => restoreDatabase(database, { kind: 'file', path: backupPath });

      // Assert
      expect(act).toThrow('schema initialization failed');
      expect(database.rawDb.open).toBe(true);
      expect(getSaveDir(database.rawDb)).toBe('/current/save/dir');
      expect(database.rawDb.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(database.rawDb.pragma('journal_mode', { simple: true })).toBe('wal');
      expectNoTemporaryFiles();
    });
  });

  describe('If the backup file does not exist', () => {
    it('Then the restore is rejected and the original connection stays open', () => {
      // Arrange
      const originalConnection = database.rawDb;

      // Act
      const act = () =>
        restoreDatabase(database, { kind: 'file', path: path.join(tempDir, 'missing.db') });

      // Assert
      expect(act).toThrow();
      expect(database.rawDb).toBe(originalConnection);
      expect(database.rawDb.open).toBe(true);
      expectNoTemporaryFiles();
    });
  });
});
