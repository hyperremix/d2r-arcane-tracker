import { extname } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type { VaultSourceFileType } from '../../types/grail';
import { isModernStashVersion, saveFileTypeFromExtension } from '../../utils/d2rFormat';
import { readD2iHeaderVersion, readD2iMetadata } from '../stashFormat';

/**
 * Tells which save file format a file has. This is the single place that decides between a
 * character save, a classic stash and a modern (v105+) .d2i stash; the save file monitor and the
 * save file editor both dispatch on its result.
 */

/**
 * - 'character': a character save (.d2s).
 * - 'classicStash': a legacy shared stash (.sss/.d2x) or a pre-105 D2R shared stash (.d2i), read
 *   and written whole by the d2s stash codec.
 * - 'modernStash': a v105+ D2R shared stash (.d2i) with resource tabs, read and edited per sector.
 */
export type SaveFormatKind = 'character' | 'classicStash' | 'modernStash';

export interface SaveFormat {
  kind: SaveFormatKind;
  /** File type from the extension; it decides the classic stash codec. */
  fileType: VaultSourceFileType;
  /** Version from the first .d2i sector header; undefined for other files or an unreadable header. */
  d2iVersion?: number;
  /**
   * Set when the .d2i sector list cannot be read (a damaged or cut-off file). The kind then rests on
   * the header version alone: readers can skip the file, writers must refuse it.
   */
  d2iReadError?: unknown;
}

/** d2s constants and stash version a classic stash is read and written with. */
export interface ClassicStashCodec {
  constants: d2sTypes.IConstantData;
  version: 96 | 99;
}

/**
 * Detects the format of a save file from its extension and, for .d2i files, its header version.
 * @throws Error when the extension is not a supported save file extension.
 */
export function detectSaveFormat(filePath: string, buffer: Buffer): SaveFormat {
  const fileType = saveFileTypeFromExtension(extname(filePath));

  switch (fileType) {
    case 'd2s':
      return { kind: 'character', fileType };
    case 'sss':
    case 'd2x':
      return { kind: 'classicStash', fileType };
    case 'd2i':
      return detectD2iFormat(buffer);
    default:
      throw new Error(`Unsupported save file extension: ${extname(filePath) || filePath}`);
  }
}

function detectD2iFormat(buffer: Buffer): SaveFormat {
  let d2iVersion: number | undefined;
  let d2iReadError: unknown;

  try {
    d2iVersion = readD2iMetadata(buffer).version;
  } catch (error) {
    // A file cut off inside a sector fails the metadata read; its header tells a damaged
    // v105+ file from a pre-105 one.
    d2iReadError = error;
    d2iVersion = readD2iHeaderVersion(buffer);
  }

  return {
    kind: isModernStashVersion(d2iVersion) ? 'modernStash' : 'classicStash',
    fileType: 'd2i',
    d2iVersion,
    d2iReadError,
  };
}

/** Codec of a classic stash: pre-105 .d2i files use the v99 constants, .sss/.d2x the v96 ones. */
export function getClassicStashCodec(fileType: VaultSourceFileType): ClassicStashCodec {
  if (fileType === 'd2i') {
    return { constants: constants99, version: 99 };
  }

  return { constants: constants96, version: 96 };
}
