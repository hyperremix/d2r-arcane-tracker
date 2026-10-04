import { rename, rm, writeFile } from 'node:fs/promises';

/**
 * Writes `data` to `filePath` without ever leaving a truncated file behind.
 *
 * The bytes are written to a sibling temp file first and then renamed over the target, so a crash
 * or write error mid-way leaves the original save file untouched. Save files hold irreplaceable
 * items, so a partial write must never be possible.
 */
export async function writeFileAtomic(filePath: string, data: Buffer | Uint8Array): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.tmp`;

  try {
    await writeFile(tempPath, data);
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
