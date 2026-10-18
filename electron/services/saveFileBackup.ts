import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import type { SaveFileSnapshotKind } from '../types/saveFileSnapshots';
import { SAVE_FILE_EXTENSIONS } from '../utils/d2rFormat';

const MAX_BACKUPS_PER_FILE = 20;

/** Extension of the copies taken right before the app modifies a save file. */
const SAVE_FILE_BACKUP_EXTENSION = '.bak';

let backupDirectory: string | undefined;
// Disambiguates backups taken within the same millisecond, which would otherwise overwrite each other.
let backupSequence = 0;

/**
 * Sets the directory that receives a copy of every save file right before the app modifies it.
 * Passing `undefined` disables backups.
 */
export function configureSaveFileBackups(directory: string | undefined): void {
  backupDirectory = directory;
}

/**
 * The name prefix shared by every copy of a save file: a short hash of its full path (so equally
 * named files of different folders stay apart) and its file name.
 * @param filePath - Path of the save file
 */
export function buildBackupPrefix(filePath: string): string {
  const pathHash = createHash('sha1')
    .update(resolve(filePath).toLowerCase())
    .digest('hex')
    .slice(0, 8);
  return `${pathHash}-${basename(filePath)}.`;
}

/**
 * Builds the name of a new copy of a save file: its prefix, the current time and a sequence
 * number, so names sort by the time the copy was taken.
 * @param filePath - Path of the save file
 * @param extension - Extension of the copy, with its dot
 */
export function buildCopyFileName(filePath: string, extension: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  backupSequence = (backupSequence + 1) % 1_000_000;
  const sequence = String(backupSequence).padStart(6, '0');
  return `${buildBackupPrefix(filePath)}${stamp}-${sequence}${extension}`;
}

/** What the name of a save file copy tells about it. */
interface SaveFileCopyName {
  /** The name prefix shared by all copies of the save file (see {@link buildBackupPrefix}). */
  prefix: string;
  /** File name of the save file the copy was taken of. */
  saveFileName: string;
  /** When the copy was taken. */
  createdAt: Date;
  /** Extension of the copy, with its dot. */
  extension: string;
}

const COPY_FILE_NAME_PATTERN =
  /^([0-9a-f]{8}-(.+)\.)(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-\d{6}(\.[a-z]+)$/;

/**
 * Reads the name of a save file copy written by {@link buildCopyFileName}.
 * @param name - File name of the copy
 * @returns The parts of the name, or undefined when it isn't the name of a copy
 */
export function parseCopyFileName(name: string): SaveFileCopyName | undefined {
  const match = COPY_FILE_NAME_PATTERN.exec(name);
  if (!match) {
    return undefined;
  }

  const [, prefix, saveFileName, date, hours, minutes, seconds, milliseconds, extension] = match;
  const createdAt = new Date(`${date}T${hours}:${minutes}:${seconds}.${milliseconds}Z`);
  if (Number.isNaN(createdAt.getTime())) {
    return undefined;
  }

  return { prefix, saveFileName, createdAt, extension };
}

/** Extension of the copies taken when a monitored save file changed. */
export const SAVE_FILE_SNAPSHOT_EXTENSION = '.snap';

const EXTENSION_BY_KIND: Record<SaveFileSnapshotKind, string> = {
  snapshot: SAVE_FILE_SNAPSHOT_EXTENSION,
  backup: SAVE_FILE_BACKUP_EXTENSION,
};

/** Longest snapshot ID accepted from the renderer. */
const MAX_SNAPSHOT_ID_LENGTH = 512;

/** A snapshot ID taken apart: the kind and file name of the copy, and what its name tells. */
export interface ParsedSaveFileSnapshotId extends SaveFileCopyName {
  kind: SaveFileSnapshotKind;
  copyFileName: string;
}

/**
 * Reads a snapshot ID (`<kind>:<copy file name>`). The copy file name must be a plain file name
 * (no folders) of a copy of a save file, with the extension of its kind.
 * @param id - Untrusted snapshot ID
 * @returns The parts of the ID, or undefined when it isn't a valid snapshot ID
 */
export function parseSaveFileSnapshotId(id: unknown): ParsedSaveFileSnapshotId | undefined {
  if (typeof id !== 'string' || id.length > MAX_SNAPSHOT_ID_LENGTH) {
    return undefined;
  }

  const separator = id.indexOf(':');
  const kind = id.slice(0, separator);
  const copyFileName = id.slice(separator + 1);
  if (
    separator < 0 ||
    (kind !== 'snapshot' && kind !== 'backup') ||
    /[\\/\0]/.test(copyFileName) ||
    copyFileName.includes('..')
  ) {
    return undefined;
  }

  const parsed = parseCopyFileName(copyFileName);
  if (
    !parsed ||
    parsed.extension !== EXTENSION_BY_KIND[kind] ||
    !SAVE_FILE_EXTENSIONS.has(extname(parsed.saveFileName).toLowerCase())
  ) {
    return undefined;
  }

  return { ...parsed, kind, copyFileName };
}

/**
 * Lists the copies of one save file in a directory, oldest first.
 * @param directory - Directory holding the copies
 * @param prefix - The prefix of the save file (see {@link buildBackupPrefix})
 * @param extension - Extension of the copies, with its dot
 */
export async function listCopyFileNames(
  directory: string,
  prefix: string,
  extension: string,
): Promise<string[]> {
  return (await readdir(directory))
    .filter((name) => name.startsWith(prefix) && name.endsWith(extension))
    .sort();
}

/**
 * Deletes the oldest copies of one save file so that at most `keep` remain.
 * @param directory - Directory holding the copies
 * @param prefix - The prefix of the save file (see {@link buildBackupPrefix})
 * @param extension - Extension of the copies, with its dot
 * @param keep - Number of copies to keep
 */
export async function pruneCopies(
  directory: string,
  prefix: string,
  extension: string,
  keep: number,
): Promise<void> {
  const names = await listCopyFileNames(directory, prefix, extension);
  const obsolete = names.slice(0, Math.max(0, names.length - keep));
  await Promise.all(obsolete.map((name) => rm(join(directory, name), { force: true })));
}

/**
 * Copies `filePath` into the backup directory. A failing backup rejects, so the caller does not
 * modify a save file it could not back up. Missing source files (new files) are not an error.
 */
export async function backupSaveFile(filePath: string): Promise<void> {
  if (!backupDirectory) {
    return;
  }

  const directory = backupDirectory;
  await mkdir(directory, { recursive: true });

  try {
    await copyFile(
      filePath,
      join(directory, buildCopyFileName(filePath, SAVE_FILE_BACKUP_EXTENSION)),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }

  await pruneCopies(
    directory,
    buildBackupPrefix(filePath),
    SAVE_FILE_BACKUP_EXTENSION,
    MAX_BACKUPS_PER_FILE,
  ).catch((error) => {
    console.error('[saveFileBackup] Failed to prune old backups', error);
  });
}
