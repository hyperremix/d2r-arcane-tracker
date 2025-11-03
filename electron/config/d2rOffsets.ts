/**
 * D2R Memory Offset Configuration
 *
 * This file contains version-specific memory offsets for Diablo II: Resurrected.
 * Offsets are extracted from community research and tools like d2go and ResurrectedTrade.
 *
 * Architecture:
 * - P_0: Base address of D2R.exe module (detected at runtime)
 * - P_1: Volatile RVA (Relative Virtual Address) - changes with each D2R patch
 * - P_2: Structural offset 1 (stable across patches)
 * - P_3: Structural offset 2 (stable across patches)
 *
 * Pointer Chain: P_0 + P_1 → read QWORD (8 bytes) → A_2 + P_2 + P_3 → read DWORD (4 bytes) → Game State
 *
 * Game State Values:
 * - 0x00: Lobby/Menu (Game Ended)
 * - 0x02: In-Game (Game Active)
 */

/**
 * Offset configuration for a specific D2R version.
 */
export interface D2RVersionOffsets {
  /**
   * P_1: Volatile RVA (Relative Virtual Address)
   * This offset changes with each D2R patch and must be updated.
   * Offset from D2R.exe base address to the Global Game Context Pointer.
   */
  p1: number;

  /**
   * P_2: Structural offset 1 (stable)
   * First offset within the Global Game Context structure.
   */
  p2: number;

  /**
   * P_3: Structural offset 2 (stable)
   * Second offset within the Game Context structure.
   */
  p3: number;

  /**
   * Game version string for identification
   * Format: "X.Y.Z" or build number
   */
  version: string;

  /**
   * Build number or patch identifier
   */
  build?: string;

  /**
   * Notes about this version configuration
   */
  notes?: string;
}

/**
 * Map of D2R versions to their memory offsets.
 * Key: Version string (e.g., "1.0.0" or build number)
 */
export interface D2ROffsetMap {
  [version: string]: D2RVersionOffsets;
}

/**
 * Default/fallback offsets.
 * These should be updated when actual offsets are extracted from d2go/ResurrectedTrade.
 */
const DEFAULT_OFFSETS: D2RVersionOffsets = {
  p1: 0x23e6e0, // Extracted from d2go/koolo for D2R 2.7+
  p2: 0x8, // Extracted from d2go/koolo
  p3: 0x0, // Extracted from d2go/koolo
  version: '2.7+',
  notes: 'Offsets extracted from d2go/koolo repository - valid for D2R patch 2.7 and later',
};

/**
 * Offset map for known D2R versions.
 * Populated by extracting offsets from d2go and ResurrectedTrade repositories.
 *
 * References:
 * - https://github.com/hectorgimenez/d2go/tree/main/pkg/memory
 * - https://github.com/ResurrectedTrader/ResurrectedTrade
 */
export const D2R_OFFSET_MAP: D2ROffsetMap = {
  // D2R 2.7+ offsets (extracted from d2go/koolo)
  '2.7': {
    p1: 0x23e6e0,
    p2: 0x8,
    p3: 0x0,
    version: '2.7',
    notes: 'D2R patch 2.7+ offsets extracted from d2go/koolo repository',
  },
  // Default fallback (also 2.7+)
  default: DEFAULT_OFFSETS,
};

/**
 * Looks up offsets for a given D2R version.
 * @param version - Version string to lookup
 * @returns Offset configuration or default if not found
 */
export function getOffsetsForVersion(version: string): D2RVersionOffsets {
  // Try exact match first
  if (D2R_OFFSET_MAP[version]) {
    return D2R_OFFSET_MAP[version];
  }

  // Try partial match (e.g., "1.0" matches "1.0.0")
  const versionParts = version.split('.');
  for (let i = versionParts.length; i > 0; i--) {
    const partialVersion = versionParts.slice(0, i).join('.');
    if (D2R_OFFSET_MAP[partialVersion]) {
      return D2R_OFFSET_MAP[partialVersion];
    }
  }

  // Fallback to default
  console.warn(`[D2ROffsets] Version ${version} not found in offset map, using default`);
  return DEFAULT_OFFSETS;
}

/**
 * Checks if offsets are valid (not placeholder zeros).
 * @param offsets - Offset configuration to validate
 * @returns True if offsets are valid, false if they are placeholders
 */
export function areOffsetsValid(offsets: D2RVersionOffsets): boolean {
  // Consider offsets valid if P1 is non-zero (P2 and P3 can be zero)
  return offsets.p1 !== 0x0;
}

/**
 * Game state values from memory reading.
 */
export enum D2RGameState {
  /**
   * Player is in lobby/menu (Game Ended)
   */
  Lobby = 0x00,

  /**
   * Player is in-game (Game Active)
   */
  InGame = 0x02,
}
