import {
  closeSync,
  copyFileSync,
  existsSync,
  openSync,
  readSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import Database from 'better-sqlite3';

/** Busy timeout applied to every connection, in milliseconds. */
export const BUSY_TIMEOUT_MS = 5000;

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'binary');
const SIDECAR_SUFFIXES = ['-wal', '-shm'] as const;

/** Tables every app database has had since the first release. */
const REQUIRED_TABLES = ['items', 'characters', 'grail_progress', 'settings'] as const;

/**
 * Opens a read/write connection with the pragmas the app relies on
 * (busy timeout, WAL journaling and foreign key enforcement).
 * @param dbPath - Path of the database file
 * @returns The configured connection
 */
export function openConnection(dbPath: string): Database.Database {
  const rawDb = new Database(dbPath, { timeout: BUSY_TIMEOUT_MS });
  try {
    rawDb.pragma('journal_mode = WAL');
    rawDb.pragma('foreign_keys = ON');
  } catch (error) {
    rawDb.close();
    throw error;
  }
  return rawDb;
}

function hasSqliteHeader(filePath: string): boolean {
  const header = Buffer.alloc(SQLITE_HEADER.length);
  const fd = openSync(filePath, 'r');
  try {
    const bytesRead = readSync(fd, header, 0, header.length, 0);
    return bytesRead === header.length && header.equals(SQLITE_HEADER);
  } finally {
    closeSync(fd);
  }
}

/**
 * Checks that a file is an intact app database without modifying it:
 * SQLite header, `PRAGMA quick_check` and the presence of the core tables.
 * @param filePath - Path of the candidate database file
 * @throws {Error} If the file is not a valid app database
 */
export function assertValidDatabaseFile(filePath: string): void {
  if (!hasSqliteHeader(filePath)) {
    throw new Error('Invalid backup file: not a SQLite database');
  }

  const candidate = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const checks = candidate.pragma('quick_check') as Array<{ quick_check: string }>;
    if (checks.length !== 1 || checks[0]?.quick_check !== 'ok') {
      throw new Error('Invalid backup file: database integrity check failed');
    }

    const tables = candidate
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = new Set(tables.map((table) => table.name));
    const missing = REQUIRED_TABLES.filter((table) => !tableNames.has(table));
    if (missing.length > 0) {
      throw new Error(`Invalid backup file: missing tables ${missing.join(', ')}`);
    }
  } finally {
    candidate.close();
  }
}

function removeDatabaseFiles(filePath: string): void {
  for (const suffix of ['', ...SIDECAR_SUFFIXES]) {
    rmSync(`${filePath}${suffix}`, { force: true });
  }
}

/**
 * Copies a closed database file, including an un-checkpointed WAL file if one exists.
 * Stale sidecar files at the destination are removed so SQLite cannot replay them
 * onto the copied database.
 */
function copyDatabaseFiles(from: string, to: string): void {
  copyFileSync(from, to);
  if (existsSync(`${from}-wal`)) {
    copyFileSync(`${from}-wal`, `${to}-wal`);
  } else {
    rmSync(`${to}-wal`, { force: true });
  }
  rmSync(`${to}-shm`, { force: true });
}

function removeDatabaseFilesQuietly(filePath: string): void {
  try {
    removeDatabaseFiles(filePath);
  } catch (error) {
    console.warn(`[Database] Failed to remove temporary database file ${filePath}:`, error);
  }
}

/** Where the database being restored comes from. */
export type RestoreSource = { kind: 'file'; path: string } | { kind: 'buffer'; data: Buffer };

/** The live database that a restore replaces. */
export interface RestoreTarget {
  readonly dbPath: string;
  /** Closes the live connection so the database file can be replaced. */
  closeConnection(): void;
  /**
   * Opens a new connection on `dbPath` and initializes the schema.
   * Must not leave an open connection behind when it throws.
   */
  openConnectionAndInitialize(): void;
}

function writeRestoreSource(source: RestoreSource, destination: string): void {
  if (source.kind === 'file') {
    copyFileSync(source.path, destination);
  } else {
    writeFileSync(destination, source.data);
  }
}

function rollBackRestore(target: RestoreTarget, preRestorePath: string, cause: unknown): never {
  try {
    copyDatabaseFiles(preRestorePath, target.dbPath);
    target.openConnectionAndInitialize();
  } catch (rollbackError) {
    // Keep the pre-restore copy on disk so the data can still be recovered manually.
    console.error(
      `[Database] Rolling back the restore failed; the previous database is kept at ${preRestorePath}`,
      rollbackError,
    );
    throw cause;
  }
  removeDatabaseFilesQuietly(preRestorePath);
  throw cause;
}

/**
 * Replaces the live database with a backup.
 * The backup is written to a temporary candidate file and validated before the live database
 * is touched. The live database is copied to `<dbPath>.pre-restore` and only deleted after the
 * restored database opened and its schema initialized; any failure after the swap restores
 * the previous database and reopens it.
 * @param target - The live database
 * @param source - The backup to restore
 * @throws {Error} If the backup is invalid or the restore failed (the previous data is kept)
 */
export function restoreDatabase(target: RestoreTarget, source: RestoreSource): void {
  const candidatePath = `${target.dbPath}.restore-candidate`;
  const preRestorePath = `${target.dbPath}.pre-restore`;

  try {
    removeDatabaseFiles(candidatePath);
    writeRestoreSource(source, candidatePath);
    assertValidDatabaseFile(candidatePath);
  } catch (error) {
    removeDatabaseFilesQuietly(candidatePath);
    throw error;
  }

  try {
    // Closing the last connection checkpoints the WAL, so the copy below is complete.
    target.closeConnection();
    try {
      copyDatabaseFiles(target.dbPath, preRestorePath);
    } catch (error) {
      removeDatabaseFilesQuietly(preRestorePath);
      target.openConnectionAndInitialize();
      throw error;
    }

    try {
      copyDatabaseFiles(candidatePath, target.dbPath);
      target.openConnectionAndInitialize();
    } catch (error) {
      rollBackRestore(target, preRestorePath, error);
    }
  } finally {
    removeDatabaseFilesQuietly(candidatePath);
  }

  removeDatabaseFilesQuietly(preRestorePath);
}
