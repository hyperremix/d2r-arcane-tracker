import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  DEFAULT_SNAPSHOTS_PER_FILE,
  MAX_SNAPSHOTS_PER_FILE,
  MIN_SNAPSHOTS_PER_FILE,
  type SaveFileSnapshot,
  type SaveFileSnapshotGroup,
  type SaveFileSnapshotKind,
} from '../types/saveFileSnapshots';
import type { Settings } from '../types/settings';
import { writeFileAtomic } from '../utils/atomicWrite';
import { assertSaveFilePathAllowed } from '../utils/saveFilePathGuard';
import { createServiceLogger } from '../utils/serviceLogger';
import {
  buildBackupPrefix,
  buildCopyFileName,
  listCopyFileNames,
  type ParsedSaveFileSnapshotId,
  parseSaveFileSnapshotId,
  pruneCopies,
  SAVE_FILE_SNAPSHOT_EXTENSION,
} from './saveFileBackup';
import { buildSaveFileHeader } from './saveFileMonitor/saveFileFormat';

const log = createServiceLogger('SaveFileSnapshots');

function hashContent(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function isMissingDirectory(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

/** Clamps the stored number of snapshots per file to the accepted range. */
export function resolveSnapshotsPerFile(stored: number | undefined): number {
  if (stored === undefined || !Number.isInteger(stored)) {
    return DEFAULT_SNAPSHOTS_PER_FILE;
  }
  return Math.min(MAX_SNAPSHOTS_PER_FILE, Math.max(MIN_SNAPSHOTS_PER_FILE, stored));
}

/** Dependencies of {@link SaveFileSnapshotService}. */
export interface SaveFileSnapshotServiceDependencies {
  /** Folder that receives the snapshots taken when a save file changed. */
  snapshotDirectory: string;
  /** Folder of the copies taken right before the app modifies a save file. */
  backupDirectory: string;
  getSettings: () => Pick<Settings, 'saveSnapshotsEnabled' | 'saveSnapshotsPerFile'>;
  /** The effective save directory; restores only write inside it. */
  getSaveDirectory: () => string | undefined;
  /** Rejects while the game is running. */
  assertGameNotRunning: () => Promise<void>;
  /** Backs up the current save file, then replaces it with `content`. */
  writeSaveFile: (filePath: string, content: Buffer) => Promise<void>;
  /** Re-parses every save file. */
  rescan: () => Promise<void>;
}

/**
 * Keeps snapshots of monitored save files in the app's data folder, lists them together with the
 * copies taken before the app modified a file, and restores a save file from one of them.
 */
export class SaveFileSnapshotService {
  /** Hash of the newest snapshot by save file prefix, so unchanged content is not read again. */
  private readonly latestSnapshotHashes = new Map<string, string>();

  constructor(private readonly deps: SaveFileSnapshotServiceDependencies) {}

  /**
   * Stores a snapshot of a save file's content unless snapshots are turned off or the newest
   * snapshot of the file has the same content, then deletes the oldest snapshots beyond the
   * configured number per file. Rejects when the snapshot cannot be written.
   * @param filePath - Path of the save file
   * @param content - The content just read from it
   * @returns Whether a snapshot was stored
   */
  async capture(filePath: string, content: Buffer): Promise<boolean> {
    const settings = this.deps.getSettings();
    if (settings.saveSnapshotsEnabled === false) {
      return false;
    }

    const directory = this.deps.snapshotDirectory;
    const prefix = buildBackupPrefix(filePath);
    const hash = hashContent(content);
    if ((await this.readLatestSnapshotHash(prefix)) === hash) {
      return false;
    }

    await mkdir(directory, { recursive: true });
    await writeFileAtomic(
      join(directory, buildCopyFileName(filePath, SAVE_FILE_SNAPSHOT_EXTENSION)),
      content,
    );
    this.latestSnapshotHashes.set(prefix, hash);

    await pruneCopies(
      directory,
      prefix,
      SAVE_FILE_SNAPSHOT_EXTENSION,
      resolveSnapshotsPerFile(settings.saveSnapshotsPerFile),
    ).catch((error) => log.error('capture', error, { filePath }));
    return true;
  }

  private async readLatestSnapshotHash(prefix: string): Promise<string | undefined> {
    const cached = this.latestSnapshotHashes.get(prefix);
    if (cached) {
      return cached;
    }

    let names: string[];
    try {
      names = await listCopyFileNames(
        this.deps.snapshotDirectory,
        prefix,
        SAVE_FILE_SNAPSHOT_EXTENSION,
      );
    } catch (error) {
      if (isMissingDirectory(error)) {
        return undefined;
      }
      throw error;
    }

    const newest = names[names.length - 1];
    if (!newest) {
      return undefined;
    }
    const hash = hashContent(await readFile(join(this.deps.snapshotDirectory, newest)));
    this.latestSnapshotHashes.set(prefix, hash);
    return hash;
  }

  /**
   * Lists the snapshots and pre-change copies of the save files of the configured save folder,
   * including files that are no longer in the folder. Copies of other folders are left out.
   * @returns One group per save file, sorted by file name, each with its copies newest first
   */
  async list(): Promise<SaveFileSnapshotGroup[]> {
    const saveDirectory = this.deps.getSaveDirectory();
    if (!saveDirectory) {
      return [];
    }

    const groups = new Map<string, SaveFileSnapshotGroup>();
    for (const kind of ['snapshot', 'backup'] as const) {
      for (const copyFileName of await this.readCopyFileNames(kind)) {
        const parsed = parseSaveFileSnapshotId(`${kind}:${copyFileName}`);
        if (
          !parsed ||
          parsed.prefix !== buildBackupPrefix(join(saveDirectory, parsed.saveFileName))
        ) {
          continue;
        }

        const snapshot = await this.describeCopy(parsed);
        if (!snapshot) {
          continue;
        }
        const group = groups.get(parsed.saveFileName) ?? {
          fileName: parsed.saveFileName,
          fileExists: await this.fileExists(join(saveDirectory, parsed.saveFileName)),
          snapshots: [],
        };
        group.snapshots.push(snapshot);
        groups.set(parsed.saveFileName, group);
      }
    }

    return [...groups.values()]
      .sort((a, b) => a.fileName.localeCompare(b.fileName))
      .map((group) => ({
        ...group,
        snapshots: group.snapshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      }));
  }

  private directoryOf(kind: SaveFileSnapshotKind): string {
    return kind === 'snapshot' ? this.deps.snapshotDirectory : this.deps.backupDirectory;
  }

  private async readCopyFileNames(kind: SaveFileSnapshotKind): Promise<string[]> {
    try {
      return await readdir(this.directoryOf(kind));
    } catch (error) {
      if (!isMissingDirectory(error)) {
        log.error('list', error, { directory: this.directoryOf(kind) });
      }
      return [];
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      return (await stat(filePath)).isFile();
    } catch {
      return false;
    }
  }

  /** Size and, for character saves, the level of a copy; undefined if it can't be read. */
  private async describeCopy(
    parsed: ParsedSaveFileSnapshotId,
  ): Promise<SaveFileSnapshot | undefined> {
    const copyPath = join(this.directoryOf(parsed.kind), parsed.copyFileName);
    try {
      const isCharacterSave = extname(parsed.saveFileName).toLowerCase() === '.d2s';
      const sizeBytes = (await stat(copyPath)).size;
      const characterLevel = isCharacterSave
        ? buildSaveFileHeader(parsed.saveFileName, await readFile(copyPath), parsed.createdAt).level
        : undefined;
      return {
        id: `${parsed.kind}:${parsed.copyFileName}`,
        kind: parsed.kind,
        createdAt: parsed.createdAt,
        sizeBytes,
        characterLevel,
      };
    } catch (error) {
      log.error('list', error, { copyPath });
      return undefined;
    }
  }

  /**
   * Replaces a save file of the configured save folder with one of its copies. Refused while the
   * game is running. The current file is backed up first (it is listed as a pre-change copy), then
   * every save file is re-parsed.
   * @param snapshotId - ID of the copy, as listed by {@link list}
   * @throws If the ID is invalid, the copy belongs to another folder or can't be read, the game is
   *   running, or the save file can't be backed up or written
   */
  async restore(snapshotId: string): Promise<void> {
    const parsed = parseSaveFileSnapshotId(snapshotId);
    if (!parsed) {
      throw new Error('Invalid snapshot ID');
    }

    const saveDirectory = this.deps.getSaveDirectory();
    if (!saveDirectory) {
      throw new Error('The save directory is not configured');
    }
    const targetPath = join(saveDirectory, parsed.saveFileName);
    if (parsed.prefix !== buildBackupPrefix(targetPath)) {
      throw new Error('The snapshot does not belong to a save file of the configured save folder');
    }
    assertSaveFilePathAllowed(targetPath, saveDirectory, 'Snapshot target');

    await this.deps.assertGameNotRunning();

    const content = await readFile(join(this.directoryOf(parsed.kind), parsed.copyFileName));
    await this.deps.writeSaveFile(targetPath, content);
    log.info('restore', `Restored ${parsed.saveFileName} from ${parsed.copyFileName}`);

    try {
      await this.deps.rescan();
    } catch (error) {
      // The file watcher picks the restored file up once monitoring runs
      log.warn('restore', `Rescan after restore failed: ${String(error)}`);
    }
  }
}
