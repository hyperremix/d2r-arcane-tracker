/**
 * Pattern Scanner for Memory Reading
 *
 * Implements byte pattern scanning similar to d2go's FindPattern functionality.
 * Used to dynamically discover memory offsets by searching for known byte patterns
 * in process memory.
 */

/**
 * Parses a hex pattern string into a Buffer.
 * Example: "\x44\x88\x25\x00" -> Buffer with bytes [0x44, 0x88, 0x25, 0x00]
 *
 * @param pattern - Hex pattern string with \x notation
 * @returns Buffer containing the pattern bytes
 */
export function parsePattern(pattern: string): Buffer {
  // Extract hex values from \xNN format
  const hexMatches = pattern.match(/\\x([0-9A-Fa-f]{2})/g);
  if (!hexMatches) {
    throw new Error(`Invalid pattern format: ${pattern}`);
  }

  const bytes = hexMatches.map((hex) => {
    const value = hex.substring(2); // Remove \x prefix
    return Number.parseInt(value, 16);
  });

  return Buffer.from(bytes);
}

/**
 * Searches for a byte pattern in memory using a mask for wildcards.
 * Ported from d2go's FindPattern function.
 *
 * @param memory - Memory buffer to search in
 * @param pattern - Pattern bytes to search for
 * @param mask - Mask string where 'x' = exact match, '?' = wildcard
 * @returns Offset of pattern in memory, or -1 if not found
 *
 * @example
 * const memory = Buffer.from([0x00, 0x44, 0x88, 0x25, 0xFF, 0xFF]);
 * const pattern = Buffer.from([0x44, 0x88, 0x25, 0x00]);
 * const mask = "xxx?";
 * const offset = findPattern(memory, pattern, mask);
 * // Returns 1 (pattern found at offset 1)
 */
export function findPattern(memory: Buffer, pattern: Buffer, mask: string): number {
  if (pattern.length !== mask.length) {
    throw new Error(`Pattern length (${pattern.length}) must match mask length (${mask.length})`);
  }

  if (pattern.length === 0) {
    return -1;
  }

  // Search through memory for pattern
  for (let i = 0; i <= memory.length - pattern.length; i++) {
    let found = true;

    // Check each byte in pattern against memory
    for (let j = 0; j < pattern.length; j++) {
      // Skip wildcard bytes (mask = '?')
      if (mask[j] === '?') {
        continue;
      }

      // Check exact match (mask = 'x')
      if (mask[j] === 'x' && memory[i + j] !== pattern[j]) {
        found = false;
        break;
      }
    }

    if (found) {
      return i;
    }
  }

  return -1;
}

/**
 * Convenience function to find a pattern using hex string notation.
 * Automatically parses the pattern string before searching.
 *
 * @param memory - Memory buffer to search in
 * @param patternStr - Hex pattern string (e.g., "\x44\x88\x25\x00")
 * @param mask - Mask string where 'x' = exact match, '?' = wildcard
 * @returns Offset of pattern in memory, or -1 if not found
 *
 * @example
 * const memory = getProcessMemory();
 * const offset = findPatternString(
 *   memory,
 *   "\x44\x88\x25\x00\x00\x00\x00",
 *   "xxx????"
 * );
 */
export function findPatternString(memory: Buffer, patternStr: string, mask: string): number {
  const pattern = parsePattern(patternStr);
  return findPattern(memory, pattern, mask);
}

/**
 * Reads bytes from a buffer at a specific offset.
 * Helper function for extracting values after finding patterns.
 *
 * @param buffer - Buffer to read from
 * @param offset - Offset to start reading
 * @param length - Number of bytes to read
 * @returns Buffer containing the read bytes, or null if out of bounds
 */
export function readBytesFromBuffer(buffer: Buffer, offset: number, length: number): Buffer | null {
  if (offset < 0 || offset + length > buffer.length) {
    return null;
  }
  return buffer.subarray(offset, offset + length);
}
