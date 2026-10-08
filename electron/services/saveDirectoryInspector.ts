import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';
import type { SaveDirectoryInspection } from '../types/grail';

/**
 * Name of the folder D2R stores its save files in (e.g. `Saved Games\Diablo II Resurrected`).
 */
export const D2R_SAVE_FOLDER_NAME = 'Diablo II Resurrected';

/**
 * Longest path accepted for inspection; longer input is rejected as invalid.
 */
export const MAX_SAVE_DIRECTORY_PATH_LENGTH = 4096;

/**
 * How many parent folders are checked when looking for an enclosing save folder.
 */
const MAX_ANCESTOR_DEPTH = 8;

const CHARACTER_SAVE_EXTENSION = '.d2s';

/**
 * Checks whether a folder name is the D2R save folder name (case-insensitive).
 * @param name - Folder name to check
 * @returns True if the name matches the D2R save folder name
 */
function isD2RSaveFolderName(name: string): boolean {
  return name.toLowerCase() === D2R_SAVE_FOLDER_NAME.toLowerCase();
}

/**
 * Reads the entries of a directory.
 * @param directory - Directory to read
 * @returns The directory entries, or undefined if the path is not a readable directory
 */
async function readDirectoryEntries(directory: string): Promise<Dirent[] | undefined> {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch {
    return undefined;
  }
}

/**
 * Counts `.d2s` character save files in a list of directory entries.
 * @param entries - Directory entries
 * @returns Number of character save files
 */
function countCharacterSaveFiles(entries: Dirent[] | undefined): number {
  return (entries ?? []).filter(
    (entry) => entry.isFile() && extname(entry.name).toLowerCase() === CHARACTER_SAVE_EXTENSION,
  ).length;
}

/**
 * Checks whether a directory directly contains at least one character save file.
 * @param directory - Directory to check
 * @returns True if the directory contains a `.d2s` file
 */
async function hasCharacterSaveFiles(directory: string): Promise<boolean> {
  return countCharacterSaveFiles(await readDirectoryEntries(directory)) > 0;
}

/**
 * Looks for a nearby D2R save folder that contains character files: either a
 * `Diablo II Resurrected` subfolder (the user picked its parent) or an enclosing
 * `Diablo II Resurrected` folder (the user picked one of its subfolders).
 * @param directory - Resolved candidate directory
 * @param entries - Entries of the candidate directory, if it is readable
 * @returns The suggested directory, or undefined if none was found
 */
async function findSuggestedDirectory(
  directory: string,
  entries: Dirent[] | undefined,
): Promise<string | undefined> {
  // Parent mistake, e.g. "Saved Games" instead of "Saved Games/Diablo II Resurrected"
  const childFolder = (entries ?? []).find(
    (entry) => entry.isDirectory() && isD2RSaveFolderName(entry.name),
  );
  if (childFolder) {
    const childPath = join(directory, childFolder.name);
    if (await hasCharacterSaveFiles(childPath)) {
      return childPath;
    }
  }

  // Child mistake, e.g. "Diablo II Resurrected/mods" instead of "Diablo II Resurrected"
  let current = dirname(directory);
  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && current !== dirname(current); depth += 1) {
    if (isD2RSaveFolderName(basename(current)) && (await hasCharacterSaveFiles(current))) {
      return current;
    }
    current = dirname(current);
  }

  return undefined;
}

/**
 * Inspects a candidate save directory without changing any settings: checks that it
 * exists, counts its character save files and suggests a nearby D2R save folder when
 * the candidate looks like a parent/child mix-up.
 * @param candidate - Directory path provided by the renderer
 * @returns The inspection result
 */
export async function inspectSaveDirectory(candidate: string): Promise<SaveDirectoryInspection> {
  const trimmed = candidate.trim();
  if (trimmed === '' || trimmed.length > MAX_SAVE_DIRECTORY_PATH_LENGTH || !isAbsolute(trimmed)) {
    return { status: 'invalidPath', saveFileCount: 0 };
  }

  const directory = resolve(trimmed);
  const entries = await readDirectoryEntries(directory);
  const saveFileCount = countCharacterSaveFiles(entries);
  if (saveFileCount > 0) {
    return { status: 'hasSaveFiles', saveFileCount };
  }

  const suggestedDirectory = await findSuggestedDirectory(directory, entries);
  return {
    status: entries ? 'noSaveFiles' : 'notFound',
    saveFileCount: 0,
    ...(suggestedDirectory ? { suggestedDirectory } : {}),
  };
}
