/**
 * Known D2R.exe builds and the RVA of their in-game flag.
 *
 * The d2go UI signature (see d2rPatterns.ts) stopped resolving to the right byte in newer builds:
 * the code is obfuscated, a large part of it is PAGE_NOACCESS at any given moment, and the struct
 * layout around the flag changed. Known builds are therefore identified from the PE header (which
 * is always readable) and use a verified offset directly, without scanning code.
 *
 * To add a build after a patch, see docs/MEMORY_READING.md ("Adding a new D2R build").
 */

/**
 * Identity of a D2R.exe build, read from its PE header.
 */
export interface D2RBuildIdentity {
  /** IMAGE_FILE_HEADER.TimeDateStamp */
  timeDateStamp: number;
  /** IMAGE_OPTIONAL_HEADER.SizeOfImage */
  sizeOfImage: number;
}

/**
 * A D2R.exe build whose in-game flag offset was verified against a running game.
 */
export interface KnownD2RBuild extends D2RBuildIdentity {
  /** Human-readable file version, for logs */
  fileVersion: string;
  /**
   * RVA (offset from the module base) of the in-game flag byte.
   * Reads 0 in the lobby and 1 in a game.
   */
  inGameFlagRva: number;
}

export const KNOWN_D2R_BUILDS: readonly KnownD2RBuild[] = [
  {
    fileVersion: '3.3.93847',
    timeDateStamp: 1785435812, // 2026-07-30T18:23:32Z
    sizeOfImage: 41455616,
    // Verified live: 0 -> 1 on entering a game, 1 -> 0 on leaving it, no other byte nearby does this
    inGameFlagRva: 0x1ebd158,
  },
];

/** Number of bytes from the module base that are enough to parse the PE identity. */
export const PE_HEADER_READ_SIZE = 0x400;

const E_LFANEW_OFFSET = 0x3c;
const PE_SIGNATURE = 0x00004550; // "PE\0\0"
const FILE_HEADER_TIMESTAMP_OFFSET = 8; // from the PE signature
const OPTIONAL_HEADER_OFFSET = 24; // from the PE signature
const OPTIONAL_HEADER_SIZE_OF_IMAGE_OFFSET = 56;

/**
 * Parses the build identity out of the start of a PE image.
 *
 * @param header - At least the first PE_HEADER_READ_SIZE bytes of the module
 * @returns The identity, or undefined if the buffer is not a valid PE header
 */
export function parsePeIdentity(header: Buffer): D2RBuildIdentity | undefined {
  if (header.length < E_LFANEW_OFFSET + 4) {
    return undefined;
  }

  const peOffset = header.readUInt32LE(E_LFANEW_OFFSET);
  const sizeOfImageOffset =
    peOffset + OPTIONAL_HEADER_OFFSET + OPTIONAL_HEADER_SIZE_OF_IMAGE_OFFSET;
  if (sizeOfImageOffset + 4 > header.length) {
    return undefined;
  }

  if (header.readUInt32LE(peOffset) !== PE_SIGNATURE) {
    return undefined;
  }

  return {
    timeDateStamp: header.readUInt32LE(peOffset + FILE_HEADER_TIMESTAMP_OFFSET),
    sizeOfImage: header.readUInt32LE(sizeOfImageOffset),
  };
}

/**
 * Finds the known build matching an identity.
 */
export function findKnownBuild(identity: D2RBuildIdentity): KnownD2RBuild | undefined {
  return KNOWN_D2R_BUILDS.find(
    (build) =>
      build.timeDateStamp === identity.timeDateStamp && build.sizeOfImage === identity.sizeOfImage,
  );
}
