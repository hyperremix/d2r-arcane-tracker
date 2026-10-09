// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { BUSY_TIMEOUT_MS } from './connection';
import { GrailDatabase, grailDatabase as importTimeDatabase } from './database';

// database.ts opens a singleton on import, so the mocked userData path must exist before the import.
const userDataState = vi.hoisted(() => ({ userData: '' }));
const importTimeDir = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const nodePath = await import('node:path');
  const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'grail-import-time-'));
  userDataState.userData = dir;
  return dir;
});

vi.mock('electron', () => ({ app: { getPath: () => userDataState.userData } }));

afterAll(() => {
  // Only close the singleton if this file's import created it (it may be cached from another file).
  const importTimeDirPrefix = path.resolve(importTimeDir) + path.sep;
  if (
    path.resolve(importTimeDatabase.dbPath).startsWith(importTimeDirPrefix) &&
    importTimeDatabase.rawDb.open
  ) {
    importTimeDatabase.rawDb.close();
  }
  rmSync(importTimeDir, { recursive: true, force: true });
});

describe('When the real GrailDatabase restores a backup', () => {
  let tempDir: string;
  let grailDatabase: GrailDatabase;
  let logSpy: MockInstance<typeof console.log>;
  let warnSpy: MockInstance<typeof console.warn>;
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    tempDir = mkdtempSync(path.join(tmpdir(), 'grail-real-restore-'));

    userDataState.userData = tempDir;
    grailDatabase = new GrailDatabase();
    grailDatabase.setSetting('saveDir', '/current/save/dir');
  });

  afterEach(() => {
    if (grailDatabase.rawDb.open) {
      grailDatabase.rawDb.close();
    }
    rmSync(tempDir, { recursive: true, force: true });
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  async function createBackup(saveDir: string): Promise<string> {
    const backupPath = path.join(tempDir, 'backup.db');
    await grailDatabase.backup(backupPath);
    // Make the backup distinguishable from the live data.
    const backupDb = new Database(backupPath);
    backupDb.prepare("UPDATE settings SET value = ? WHERE key = 'saveDir'").run(saveDir);
    backupDb.close();
    return backupPath;
  }

  it('If the backup is valid, Then the restored data is live with the standard pragmas and schema', async () => {
    // Arrange
    const backupPath = await createBackup('/backup/save/dir');
    const originalConnection = grailDatabase.rawDb;

    // Act
    grailDatabase.restore(backupPath);

    // Assert
    expect(grailDatabase.rawDb).not.toBe(originalConnection);
    expect(grailDatabase.getAllSettings().saveDir).toBe('/backup/save/dir');
    expect(grailDatabase.rawDb.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(grailDatabase.rawDb.pragma('busy_timeout', { simple: true })).toBe(BUSY_TIMEOUT_MS);
    expect(grailDatabase.getAllItems().length).toBeGreaterThan(0);
    expect(existsSync(`${grailDatabase.dbPath}.pre-restore`)).toBe(false);
  });

  it('If the backup buffer is not a SQLite database, Then the restore is rejected and the live data is kept', () => {
    // Arrange
    const data = Buffer.from('not a database');

    // Act
    const act = () => grailDatabase.restoreFromBuffer(data);

    // Assert
    expect(act).toThrow('not a SQLite database');
    expect(grailDatabase.rawDb.open).toBe(true);
    expect(grailDatabase.getAllSettings().saveDir).toBe('/current/save/dir');
  });

  it('If the backup is read from a buffer, Then the restored data is live', async () => {
    // Arrange
    const backupPath = await createBackup('/buffer/save/dir');
    const data = readFileSync(backupPath);

    // Act
    grailDatabase.restoreFromBuffer(data);

    // Assert
    expect(grailDatabase.getAllSettings().saveDir).toBe('/buffer/save/dir');
    expect(grailDatabase.rawDb.open).toBe(true);
  });
});
