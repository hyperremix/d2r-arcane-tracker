import { resolve } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import type { VaultSourceFileType } from '../../types/grail';
import { writeFileAtomic } from '../../utils/atomicWrite';
import { backupSaveFile } from '../saveFileBackup';
import type { ClassicStashCodec } from '../saveFormat/saveFormat';

/**
 * Writes save files safely: backs them up, serializes character saves and classic stashes,
 * re-reads the result and refuses to write when an item would be lost. Also detects when two paths
 * are the same file.
 */

/** Backs up the existing save file, then atomically replaces it. */
export async function writeSaveFile(filePath: string, data: Buffer): Promise<void> {
  await backupSaveFile(filePath);
  await writeFileAtomic(filePath, data);
}

function normalizeFilePathForComparison(filePath: string): string {
  const resolved = resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/**
 * True when both paths point at the same file. Paths that differ only by case, separators or
 * relative segments must be treated as the same file: otherwise a "cross-file" move would add the
 * item to the file and then remove it from that same file again, losing it.
 */
export function isSameSaveFile(
  pathA: string,
  typeA: VaultSourceFileType,
  pathB: string,
  typeB: VaultSourceFileType,
): boolean {
  return (
    typeA === typeB &&
    normalizeFilePathForComparison(pathA) === normalizeFilePathForComparison(pathB)
  );
}

function countD2sItems(data: d2sTypes.ID2S): number {
  return (
    (data.items?.length ?? 0) + (data.corpse_items?.length ?? 0) + (data.merc_items?.length ?? 0)
  );
}

/**
 * Serializes a character save, re-parses the result and only then replaces the file. Refuses to
 * write when the re-parsed save has a different number of items than the in-memory data, because
 * that means the serializer would silently drop (or invent) items.
 */
export async function writeD2sSaveFile(filePath: string, data: d2sTypes.ID2S): Promise<void> {
  const expectedItemCount = countD2sItems(data);
  const bytes = Buffer.from(await d2s.write(data));
  const reparsed = await d2s.read(bytes);
  const actualItemCount = countD2sItems(reparsed);

  if (actualItemCount !== expectedItemCount) {
    throw new Error(
      `Refusing to write save file: expected ${expectedItemCount} items but serialized data contains ${actualItemCount}`,
    );
  }

  await writeSaveFile(filePath, bytes);
}

function countStashItems(data: d2sTypes.IStash): number {
  return data.pages.reduce((total, page) => total + page.items.length, 0);
}

/** Classic stash counterpart of {@link writeD2sSaveFile}. */
export async function writeClassicStashFile(
  filePath: string,
  data: d2sTypes.IStash,
  codec: ClassicStashCodec,
): Promise<void> {
  const expectedItemCount = countStashItems(data);
  const bytes = Buffer.from(await d2stash.write(data, codec.constants, codec.version));
  const reparsed = await d2stash.read(bytes, codec.constants);
  const actualItemCount = countStashItems(reparsed);

  if (actualItemCount !== expectedItemCount) {
    throw new Error(
      `Refusing to write stash file: expected ${expectedItemCount} items but serialized data contains ${actualItemCount}`,
    );
  }

  await writeSaveFile(filePath, bytes);
}
