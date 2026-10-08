import { realpathSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

const ALLOWED_SAVE_FILE_EXTENSIONS = new Set(['.d2s', '.d2i', '.sss', '.d2x']);

function normalizeForComparison(filePath: string): string {
  return process.platform === 'win32' ? filePath.toLowerCase() : filePath;
}

/**
 * Resolves `..` segments and symlinks. A file that does not exist yet is resolved through its
 * parent directory so that a symlinked parent cannot be used to escape the save directory.
 */
function resolveRealPath(filePath: string): string {
  const absolutePath = resolve(filePath);

  try {
    return realpathSync(absolutePath);
  } catch {
    try {
      return join(realpathSync(dirname(absolutePath)), basename(absolutePath));
    } catch {
      return absolutePath;
    }
  }
}

/**
 * Guards renderer-supplied file paths before they can reach a save file write.
 *
 * The path must have a Diablo II save extension and must be a file directly inside the monitored
 * save directory (the monitor only reads that directory, so every legitimate path is one of its
 * children). `..` traversal and symlinks that point outside of the directory are rejected.
 *
 * @throws Error when the path is not allowed.
 */
export function assertSaveFilePathAllowed(
  filePath: string,
  saveDirectory: string | undefined,
  fieldName: string,
): void {
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.includes('\0')) {
    throw new Error(`${fieldName} must be a valid file path`);
  }

  if (!ALLOWED_SAVE_FILE_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    throw new Error(`${fieldName} must point to a Diablo II save file (.d2s, .d2i, .sss, .d2x)`);
  }

  if (typeof saveDirectory !== 'string' || saveDirectory.trim().length === 0) {
    throw new Error('The save directory is not configured');
  }

  const realFilePath = resolveRealPath(filePath);
  const realSaveDirectory = resolveRealPath(saveDirectory);

  if (
    normalizeForComparison(dirname(realFilePath)) !== normalizeForComparison(realSaveDirectory) ||
    !ALLOWED_SAVE_FILE_EXTENSIONS.has(extname(realFilePath).toLowerCase())
  ) {
    throw new Error(`${fieldName} must be a save file inside the configured save directory`);
  }
}
