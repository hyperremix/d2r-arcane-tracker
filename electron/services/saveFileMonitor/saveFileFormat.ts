import { basename, extname } from 'node:path';
import type { D2SaveFile } from '../../types/grail';
import {
  isModernStashVersion,
  ROTW_CHARACTER_HEADER_MIN_VERSION,
  readCharacterSaveVersion,
  SAVE_FILE_EXTENSIONS,
} from '../../utils/d2rFormat';
import { createServiceLogger } from '../../utils/serviceLogger';
import { readD2iMetadata } from '../stashFormat';

const log = createServiceLogger('SaveFileMonitor');

/** Hardcore flag (from the file name) and version (from the header, when readable) of a .d2i file. */
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

const CHARACTER_CLASSES = [
  'amazon',
  'sorceress',
  'necromancer',
  'paladin',
  'barbarian',
  'druid',
  'assassin',
  'warlock',
];

/** Hardcore bit of the status byte of a character save. */
const HARDCORE_STATUS_FLAG = 0x04;

/** Expansion bit of the status byte of a character save before Reign of the Warlock. */
const EXPANSION_STATUS_FLAG = 0x20;

/** Byte offsets of the header fields a character save (.d2s) is listed with. */
interface CharacterHeaderOffsets {
  status: number;
  classId: number;
  level: number;
}

/** Header offsets of character saves before Reign of the Warlock (D2 1.10+ and D2R up to v99). */
const LEGACY_CHARACTER_HEADER_OFFSETS: CharacterHeaderOffsets = {
  status: 36,
  classId: 40,
  level: 43,
};

/** Header offsets of Reign of the Warlock (v105+) character saves, which moved the fields forward. */
export const ROTW_CHARACTER_HEADER_OFFSETS: CharacterHeaderOffsets = {
  status: 20,
  classId: 24,
  level: 27,
};

/**
 * Offset of the game mode byte of a v105+ character save: 1 = classic, 2 = Lord of Destruction,
 * 3 = Reign of the Warlock. These saves no longer set the expansion bit of the status byte.
 */
const ROTW_GAME_MODE_OFFSET = 248;
const ROTW_GAME_MODE_CLASSIC = 1;

/** True when the character save uses the Reign of the Warlock (v105+) header layout. */
function usesRotwHeaderLayout(buffer: Buffer): boolean {
  return (readCharacterSaveVersion(buffer) ?? 0) >= ROTW_CHARACTER_HEADER_MIN_VERSION;
}

/**
 * True when a Reign of the Warlock (v105+) character save was made for an expansion game mode
 * (Lord of Destruction or Reign of the Warlock), judged by its game mode byte. Such saves carry the
 * mercenary and golem sections that classic saves lack.
 */
export function isRotwExpansionSave(buffer: Buffer): boolean {
  return (
    usesRotwHeaderLayout(buffer) &&
    buffer.length > ROTW_GAME_MODE_OFFSET &&
    buffer.readUInt8(ROTW_GAME_MODE_OFFSET) > ROTW_GAME_MODE_CLASSIC
  );
}

/**
 * Returns a copy of a Reign of the Warlock (v105+) character save with the expansion bit of its
 * status byte set, which is what makes the d2s library read the mercenary and golem sections. The
 * given buffer is not changed.
 */
export function withExpansionBit(buffer: Buffer): Buffer {
  const copy = Buffer.from(buffer);
  copy[ROTW_CHARACTER_HEADER_OFFSETS.status] |= EXPANSION_STATUS_FLAG;
  return copy;
}

/**
 * True when the file name marks a hardcore stash. D2R tells its stashes apart by name only
 * (SharedStashSoftCoreV2.d2i / SharedStashHardCoreV2.d2i, ModernSharedStashSoftCoreV2.d2i /
 * ModernSharedStashHardCoreV2.d2i); the .d2i header has no game mode flag.
 * @param filePath - Path or file name of the stash
 */
export function isHardcoreStashFileName(filePath: string): boolean {
  // Split on both separators, as the repair migration does: path.basename only knows the separator of this platform
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  return fileName.toLowerCase().includes('hardcore');
}

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
  if (!SAVE_FILE_EXTENSIONS.has(extension)) {
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
    const hardcore = isHardcore ?? isHardcoreStashFileName(filePath);
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

/**
 * Reads the game mode and version of a .d2i file. The game mode comes from the file name, as the
 * header does not hold one; the version is left out when the header cannot be read.
 */
export function readD2iHeaderInfo(filePath: string, buffer: Buffer): D2iHeaderInfo {
  const hardcore = isHardcoreStashFileName(filePath);
  try {
    const metadata = readD2iMetadata(buffer);
    log.info(
      'readD2iHeaderInfo',
      `Parsed .d2i metadata, hardcore: ${hardcore}, version: ${metadata.version}`,
    );
    return { hardcore, version: metadata.version };
  } catch (error) {
    log.warn('readD2iHeaderInfo', `Failed to read .d2i metadata: ${error}`);
    return { hardcore };
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
      hardcore: hints.stashHardcore ?? isHardcoreStashFileName(filePath),
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
    const isRotwSave = usesRotwHeaderLayout(buffer);
    const offsets = isRotwSave ? ROTW_CHARACTER_HEADER_OFFSETS : LEGACY_CHARACTER_HEADER_OFFSETS;

    characterClass = getCharacterClass(buffer.readUInt8(offsets.classId));
    level = buffer.readUInt8(offsets.level);

    const status = buffer.readUInt8(offsets.status);
    hardcore = (status & HARDCORE_STATUS_FLAG) !== 0;
    expansion = isRotwSave ? isRotwExpansionSave(buffer) : (status & EXPANSION_STATUS_FLAG) !== 0;
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
