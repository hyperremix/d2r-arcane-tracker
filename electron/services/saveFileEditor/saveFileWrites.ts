import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type { VaultSourceFileType } from '../../types/grail';
import { writeFileAtomic } from '../../utils/atomicWrite';
import { isModernStashVersion } from '../../utils/d2rFormat';
import { backupSaveFile } from '../saveFileBackup';
import { readD2iMetadata } from '../stashFormat';

/**
 * Writes save files safely: backs them up, serializes character saves and classic stashes,
 * re-reads the result and refuses to write when an item would be lost. Also guards against
 * writing to read-only modern stash parts and detects when two paths are the same file.
 */

interface StashConstants {
  constants: d2sTypes.IConstantData;
  version: number;
}

export function getStashConstants(ext: string): StashConstants {
  if (ext === '.d2i') {
    return { constants: constants99, version: 99 };
  }

  return { constants: constants96, version: 96 };
}

export function assertWritableD2iBuffer(ext: string, buffer: Buffer): void {
  if (ext !== '.d2i') {
    return;
  }

  const metadata = readD2iMetadata(buffer);
  if (isModernStashVersion(metadata.version)) {
    throw new Error('MODERN_STASH_READ_ONLY');
  }
}

export async function assertWritableStashMutationTarget(
  filePath: string,
  fileType: VaultSourceFileType,
): Promise<void> {
  if (fileType !== 'd2i') {
    return;
  }

  const buffer = await readFile(filePath);
  assertWritableD2iBuffer(extname(filePath), buffer);
}

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
  stashConstants: StashConstants,
): Promise<void> {
  const expectedItemCount = countStashItems(data);
  const bytes = Buffer.from(
    await d2stash.write(data, stashConstants.constants, stashConstants.version),
  );
  const reparsed = await d2stash.read(bytes, stashConstants.constants);
  const actualItemCount = countStashItems(reparsed);

  if (actualItemCount !== expectedItemCount) {
    throw new Error(
      `Refusing to write stash file: expected ${expectedItemCount} items but serialized data contains ${actualItemCount}`,
    );
  }

  await writeSaveFile(filePath, bytes);
}

export async function isModernD2iFile(
  filePath: string,
  fileType: VaultSourceFileType,
): Promise<boolean> {
  if (fileType !== 'd2i' || extname(filePath) !== '.d2i') {
    return false;
  }
  const buffer = await readFile(filePath);
  const metadata = readD2iMetadata(buffer);
  return isModernStashVersion(metadata.version);
}
