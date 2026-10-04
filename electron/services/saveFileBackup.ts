import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const MAX_BACKUPS_PER_FILE = 20;

let backupDirectory: string | undefined;

/**
 * Sets the directory that receives a copy of every save file right before the app modifies it.
 * Passing `undefined` disables backups.
 */
export function configureSaveFileBackups(directory: string | undefined): void {
  backupDirectory = directory;
}

function buildBackupPrefix(filePath: string): string {
  const pathHash = createHash('sha1')
    .update(resolve(filePath).toLowerCase())
    .digest('hex')
    .slice(0, 8);
  return `${pathHash}-${basename(filePath)}.`;
}

async function pruneBackups(directory: string, prefix: string): Promise<void> {
  const names = (await readdir(directory)).filter((name) => name.startsWith(prefix)).sort();
  const obsolete = names.slice(0, Math.max(0, names.length - MAX_BACKUPS_PER_FILE));
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

  const prefix = buildBackupPrefix(filePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  await mkdir(backupDirectory, { recursive: true });

  try {
    await copyFile(filePath, join(backupDirectory, `${prefix}${stamp}.bak`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }

  await pruneBackups(backupDirectory, prefix).catch((error) => {
    console.error('[saveFileBackup] Failed to prune old backups', error);
  });
}
