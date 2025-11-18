/**
 * D2R Memory Pattern Definitions
 *
 * Byte patterns extracted from d2go repository for dynamic offset calculation.
 * These patterns are used to locate memory offsets at runtime without requiring
 * version-specific configuration.
 *
 * Reference: https://github.com/hectorgimenez/d2go/blob/main/pkg/memory/offset.go
 */

/**
 * Pattern definition for memory scanning.
 */
export interface MemoryPattern {
  /**
   * Hex pattern string with \x notation
   * Example: "\x44\x88\x25\x00\x00\x00\x00"
   */
  pattern: string;

  /**
   * Mask string where 'x' = exact match, '?' = wildcard
   * Example: "xxx????" for pattern with 3 exact bytes and 4 wildcards
   */
  mask: string;

  /**
   * Human-readable name for the pattern
   */
  name: string;

  /**
   * Description of what this pattern finds
   */
  description?: string;
}

/**
 * UI pattern for detecting in-game state.
 *
 * From d2go offset.go lines 41-44 and game_reader.go line 327:
 * ```go
 * // offset.go:
 * pattern = process.FindPattern(memory, "\x40\x84\xed\x0f\x94\x05", "xxxxxx")
 * uiOffset := process.ReadUInt(pattern+6, Uint32)
 * uiOffsetPtr := (pattern - process.moduleBaseAddressPtr) + 10 + uintptr(uiOffset)
 *
 * // game_reader.go:
 * func (gd *GameReader) IsIngame() bool {
 *     return gd.ReadUInt(gd.Process.moduleBaseAddressPtr+gd.offset.UI-0xA, 1) == 1
 * }
 * ```
 *
 * Calculation:
 * 1. Find pattern in process memory
 * 2. Read 4 bytes (uint32) at pattern + 6
 * 3. Calculate UI offset: pattern + 10 + uint32Value
 * 4. Read 1 byte at moduleBase + UI - 0xA
 * 5. Value 1 = in-game, value 0 = lobby
 */
export const UI_PATTERN: MemoryPattern = {
  pattern: '\\x40\\x84\\xed\\x0f\\x94\\x05',
  mask: 'xxxxxx',
  name: 'UI',
  description: 'Locates the UI state byte for in-game detection',
};

/**
 * All available patterns for D2R memory scanning.
 */
export const D2R_PATTERNS = {
  UI: UI_PATTERN,
} as const;

/**
 * Offset adjustment constants from d2go.
 */
export const OFFSET_ADJUSTMENTS = {
  /**
   * UI offset calculation (from d2go offset.go line 44)
   * Final offset = pattern + UI_INSTRUCTION_OFFSET + extractedValue
   */
  UI_INSTRUCTION_OFFSET: 10,

  /**
   * Offset within UI pattern to read uint32 value (from d2go line 43)
   */
  UI_READ_OFFSET: 6,

  /**
   * Game state byte offset from UI offset (from d2go game_reader.go line 327)
   * Read byte at: moduleBase + UI - UI_STATE_ADJUSTMENT
   */
  UI_STATE_ADJUSTMENT: 0xa,
} as const;

/**
 * Game state values from memory reading.
 * From d2go game_reader.go line 327: byte value 0 = lobby, 1 = in-game
 */
export enum D2RGameState {
  /**
   * Player is in lobby/menu (Game Ended)
   */
  Lobby = 0,

  /**
   * Player is in-game (Game Active)
   */
  InGame = 1,
}
