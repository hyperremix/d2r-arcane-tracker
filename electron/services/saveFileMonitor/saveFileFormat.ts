import { basename, extname } from 'node:path';
import type { D2SaveFile } from '../../types/grail';
import { isModernStashVersion } from '../../utils/d2rFormat';
import { createServiceLogger } from '../../utils/serviceLogger';
import { readD2iMetadata } from '../stashFormat';

const log = createServiceLogger('SaveFileMonitor');

/** Hardcore flag and version of a .d2i file, falling back to the file name when unreadable. */
export interface D2iHeaderInfo {
  hardcore: boolean;
  version?: number;
}

/** Header data a parser already read: .d2i metadata, or the hardcore flag of a legacy stash. */
export interface SaveFileHeaderHints {
  d2iHeader?: D2iHeaderInfo;
  stashHardcore?: boolean;
}

type SharedStashName =
  | 'Shared Stash Hardcore'
  | 'Shared Stash Softcore'
  | 'Modern Shared Stash Hardcore'
  | 'Modern Shared Stash Softcore';

const SUPPORTED_SAVE_EXTENSIONS = new Set(['.d2s', '.sss', '.d2x', '.d2i']);

const CHARACTER_CLASSES = [
  'amazon',
  'sorceress',
  'necromancer',
  'paladin',
  'barbarian',
  'druid',
  'assassin',
];

/** True for backup copies of a .d2i stash (`_backup`, `.bak`, `_bak`, `-bak`), which are not scanned. */
export function isBackupLikeStashFile(fileName: string): boolean {
  const lowerFileName = fileName.toLowerCase();
  if (!lowerFileName.endsWith('.d2i')) {
    return false;
  }

  const stem = lowerFileName.slice(0, -'.d2i'.length);
  return (
    stem.includes('_backup') ||
    stem.endsWith('.bak') ||
    stem.endsWith('_bak') ||
    stem.endsWith('-bak')
  );
}

/** True when the file is a save file the monitor scans (.d2s/.sss/.d2x/.d2i, without stash backups). */
export function shouldIncludeSaveFile(fileName: string): boolean {
  const extension = extname(fileName).toLowerCase();
  if (!SUPPORTED_SAVE_EXTENSIONS.has(extension)) {
    return false;
  }

  if (extension !== '.d2i') {
    return true;
  }

  return !isBackupLikeStashFile(fileName);
}

export function resolveSharedStashName(
  isHardcore: boolean,
  sourceFileVersion?: number,
): SharedStashName {
  const isModern = isModernStashVersion(sourceFileVersion);

  if (isModern) {
    return isHardcore ? 'Modern Shared Stash Hardcore' : 'Modern Shared Stash Softcore';
  }

  return isHardcore ? 'Shared Stash Hardcore' : 'Shared Stash Softcore';
}

/**
 * Extracts the character/save name from a file path.
 * For .d2i files, returns friendly names like "Shared Stash Hardcore".
 * @param {string} filePath - The file path to extract the name from.
 * @param {boolean} [isHardcore] - Optional hardcore status (for shared stash files). If not provided, falls back to filename detection.
 * @param {number} [sourceFileVersion] - Optional d2i source file version for modern stash naming.
 * @returns {string} The character/save name.
 */
export function getSaveNameFromPath(
  filePath: string,
  isHardcore?: boolean,
  sourceFileVersion?: number,
): string {
  const extension = extname(filePath).toLowerCase();
  let saveName = basename(filePath)
    .replace(/\.d2s/i, '')
    .replace(/\.sss/i, '')
    .replace(/\.d2x/i, '')
    .replace(/\.d2i/i, '');

  // Use friendly names for shared stash files
  if (extension === '.d2i') {
    // Use provided hardcore status if available, otherwise fall back to filename
    const hardcore =
      isHardcore !== undefined ? isHardcore : saveName.toLowerCase().includes('hardcore');
    saveName = resolveSharedStashName(hardcore, sourceFileVersion);
  }

  return saveName;
}

/**
 * Maps a character class ID to its name.
 * @param {number} classId - The character class ID from the save file.
 * @returns {string} The character class name.
 */
export function getCharacterClass(classId: number): string {
  return CHARACTER_CLASSES[classId] || 'unknown';
}

/** Reads the hardcore flag and version of a .d2i file, falling back to the file name. */
export function readD2iHeaderInfo(filePath: string, buffer: Buffer): D2iHeaderInfo {
  try {
    const metadata = readD2iMetadata(buffer);
    log.info(
      'readD2iHeaderInfo',
      `Parsed .d2i metadata, hardcore: ${metadata.hardcore}, version: ${metadata.version}`,
    );
    return { hardcore: metadata.hardcore, version: metadata.version };
  } catch (error) {
    log.warn(
      'readD2iHeaderInfo',
      `Failed to read .d2i metadata, falling back to filename: ${error}`,
    );
    return { hardcore: basename(filePath).toLowerCase().includes('hardcore') };
  }
}

/**
 * Builds the character information of a save file from its already read content.
 * @param {string} filePath - The path to the save file.
 * @param {Buffer} buffer - The file content.
 * @param {Date} lastModified - Modification time of the content.
 * @param hints - Header data a parser already read: .d2i metadata, or the hardcore flag of a stash.
 * @returns {D2SaveFile} The save file data.
 */
export function buildSaveFileHeader(
  filePath: string,
  buffer: Buffer,
  lastModified: Date,
  hints: SaveFileHeaderHints = {},
): D2SaveFile {
  const extension = extname(filePath).toLowerCase();

  // Handle shared stash files (.d2i)
  if (extension === '.d2i') {
    const { hardcore, version } = hints.d2iHeader ?? readD2iHeaderInfo(filePath, buffer);

    return {
      name: getSaveNameFromPath(filePath, hardcore, version),
      path: filePath,
      lastModified,
      characterClass: 'shared_stash',
      level: 1,
      hardcore,
      expansion: true,
      sourceFileVersion: version,
    };
  }

  // Legacy shared stash files (.sss/.d2x) have no character header: reading one as a .d2s would
  // produce an invalid character class that the characters table rejects.
  if (extension === '.sss' || extension === '.d2x') {
    return {
      name: getSaveNameFromPath(filePath),
      path: filePath,
      lastModified,
      characterClass: 'shared_stash',
      level: 1,
      hardcore: hints.stashHardcore ?? basename(filePath).toLowerCase().includes('hardcore'),
      expansion: true,
    };
  }

  // Basic D2 save file parsing (simplified)
  // Strip the extension case-insensitively (e.g. Hero.D2S), matching getSaveNameFromPath
  const fileName =
    extension === '.d2s' ? basename(filePath, extname(filePath)) : basename(filePath);

  // Character name is typically the filename
  const characterName = fileName;
  let characterClass = 'unknown';
  let level = 1;
  let hardcore = false;
  let expansion = true;

  // Basic header parsing (D2 save files have a specific structure)
  if (buffer.length >= 765) {
    // Character class at offset 40
    const classId = buffer.readUInt8(40);
    characterClass = getCharacterClass(classId);

    // Level at offset 43
    level = buffer.readUInt8(43);

    // Status flags at offset 36
    const status = buffer.readUInt8(36);
    hardcore = (status & 0x04) !== 0;
    expansion = (status & 0x20) !== 0;
  }

  return {
    name: characterName,
    path: filePath,
    lastModified,
    characterClass,
    level,
    hardcore,
    expansion,
  };
}
