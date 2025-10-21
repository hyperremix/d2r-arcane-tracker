#!/usr/bin/env node
/**
 * D2R String Table Parser
 *
 * Parses Diablo 2 Resurrected string.tbl files (from Data/local/lng/<locale>/)
 * and converts them to readable formats (JSON, CSV, or text).
 *
 * The string.tbl format is a binary file containing:
 * - Header with CRC and metadata
 * - Hash table entries (key-value pairs)
 * - Null-terminated UTF-8 strings
 */

import * as fs from 'node:fs';
import { items } from '../electron/items/index.js';

interface ParsedEntries {
  [key: number]: string;
}

interface ParseOptions {
  input: string;
  output?: string;
  pretty: boolean;
  verbose: boolean;
  filterItems: boolean;
}

class StringTableParser {
  private filepath: string;
  private entries: ParsedEntries = {};

  constructor(filepath: string) {
    this.filepath = filepath;
  }

  /**
   * Parse the string.tbl file and return a dictionary of entries.
   */
  parse(): ParsedEntries {
    const data = fs.readFileSync(this.filepath);

    // Find where the actual strings start
    const stringStart = this.findStringSectionStart(data);

    if (stringStart === -1) {
      console.warn('Warning: Could not find string section start, using offset 0');
    }

    // Extract all null-terminated strings from the string section
    const strings = this.extractStrings(data, Math.max(0, stringStart));

    // Create entries with sequential indices
    this.entries = {};
    for (let i = 0; i < strings.length; i++) {
      this.entries[i] = strings[i];
    }

    return this.entries;
  }

  /**
   * Find where the actual string data begins.
   * Returns the offset where strings start, or -1 if not found.
   */
  private findStringSectionStart(data: Buffer): number {
    const minStringLength = 3;

    for (let i = 0; i < data.length - minStringLength - 1; i++) {
      if (this.isPotentialStringStart(data, i, minStringLength)) {
        const nearbyStrings = this.countNearbyStrings(data, i);
        if (nearbyStrings >= 3) {
          return i;
        }
      }
    }

    return -1;
  }

  /**
   * Check if position might be the start of a string
   */
  private isPotentialStringStart(data: Buffer, offset: number, minLength: number): boolean {
    for (let j = 0; j < minLength; j++) {
      const byte = data[offset + j];
      // Check if byte is printable ASCII or UTF-8 continuation
      if (!((byte >= 32 && byte <= 126) || byte >= 128)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Count null-terminated strings near a position
   */
  private countNearbyStrings(data: Buffer, startPos: number): number {
    let count = 0;
    const checkRange = Math.min(1000, data.length - startPos);

    for (let k = startPos; k < startPos + checkRange; k++) {
      if (this.isNullTerminatedString(data, k)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if position contains a null byte followed by printable character
   */
  private isNullTerminatedString(data: Buffer, pos: number): boolean {
    return data[pos] === 0 && pos + 1 < data.length && data[pos + 1] >= 32 && data[pos + 1] <= 126;
  }

  /**
   * Extract all null-terminated strings from the data starting at offset.
   */
  private extractStrings(data: Buffer, startOffset: number): string[] {
    const strings: string[] = [];
    const currentString: number[] = [];

    for (let i = startOffset; i < data.length; i++) {
      const byte = data[i];

      if (byte === 0) {
        this.addStringIfValid(currentString, strings);
        currentString.length = 0;
      } else {
        currentString.push(byte);
      }
    }

    // Add last string if exists
    this.addStringIfValid(currentString, strings);

    return strings;
  }

  /**
   * Decode and add a string if it contains printable content
   */
  private addStringIfValid(bytes: number[], strings: string[]): void {
    if (bytes.length === 0) {
      return;
    }

    try {
      const decoded = Buffer.from(bytes).toString('utf8');
      if (this.hasPrintableContent(decoded)) {
        strings.push(decoded);
      }
    } catch {
      // Skip malformed strings
    }
  }

  /**
   * Check if a string contains printable content
   */
  private hasPrintableContent(str: string): boolean {
    for (const char of str) {
      // Check for printable characters (not just whitespace/control chars)
      if (char.charCodeAt(0) > 32 && char.charCodeAt(0) < 127) {
        return true;
      }
      // Also check for non-ASCII printable (UTF-8)
      if (char.charCodeAt(0) > 127) {
        return true;
      }
    }
    return false;
  }

  /**
   * Export entries to JSON format.
   */
  toJSON(outputFile?: string, pretty = true): string {
    // Convert integer keys to strings for JSON compatibility
    const jsonData: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(this.entries)) {
      jsonData[key] = value;
    }

    const jsonStr = pretty ? JSON.stringify(jsonData, null, 2) : JSON.stringify(jsonData);

    if (outputFile) {
      fs.writeFileSync(outputFile, jsonStr, 'utf8');
    }

    return jsonStr;
  }

  /**
   * Get the number of entries
   */
  getEntryCount(): number {
    return Object.keys(this.entries).length;
  }

  /**
   * Normalize a string for matching: remove special chars, spaces, convert to lowercase
   */
  private normalizeForMatching(str: string): string {
    return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  /**
   * Split text into words (by spaces, hyphens)
   * Handles possessive forms by removing 's before splitting
   */
  private splitIntoWords(text: string): string[] {
    // Remove possessive markers to avoid translating standalone "s"
    // Handles: 's, 's, s' (various possessive forms)
    const withoutPossessive = text
      .replace(/'s\b/g, '') // Remove 's at word boundaries
      .replace(/[''ʼ]s\b/g, '') // Handle different apostrophe characters
      .replace(/s[''ʼ]\b/g, 's'); // Handle s' possessive

    // Split on spaces and hyphens, filter out empty strings
    return withoutPossessive.split(/[\s-]+/).filter((word) => word.length > 0);
  }

  /**
   * Build a word translation dictionary from all string table entries
   */
  private buildWordDictionary(): Record<string, string> {
    const wordDict: Record<string, string> = {};
    const sortedKeys = Object.keys(this.entries)
      .map(Number)
      .sort((a, b) => a - b);

    const grammaticalMarkerRegex = /\[(fs|ms|ns|pl)\]/;

    for (const key of sortedKeys) {
      const english = this.entries[key];
      const german = this.entries[key + 1];

      // Skip if no translation or translation is invalid
      if (!german || german === 'x' || grammaticalMarkerRegex.test(german)) {
        continue;
      }

      // Check if this is a single word (no spaces in English part)
      const englishWords = this.splitIntoWords(english);
      if (englishWords.length === 1) {
        const normalized = this.normalizeForMatching(english);
        if (!wordDict[normalized]) {
          // Remove trailing " -" from translation
          const cleanTranslation = german.endsWith(' -') ? german.slice(0, -2) : german;
          wordDict[normalized] = cleanTranslation;
        }
      }
    }

    return wordDict;
  }

  /**
   * Translate an item name word-by-word
   * Returns null if any word cannot be translated
   */
  private translateWordByWord(itemName: string, wordDict: Record<string, string>): string | null {
    const words = this.splitIntoWords(itemName);
    const translatedWords: string[] = [];

    for (const word of words) {
      const normalized = this.normalizeForMatching(word);
      const translation = wordDict[normalized];

      if (!translation) {
        // Cannot translate this word - return null (requirement 1a)
        return null;
      }

      translatedWords.push(translation);
    }

    // Combine with spaces (requirement 2a)
    return translatedWords.join(' ');
  }

  /**
   * Build set of all normalized item and set names
   */
  private buildNormalizedItemNameSet(): Set<string> {
    const normalizedItemNames = new Set<string>();
    for (const item of items) {
      const normalized = this.normalizeForMatching(item.name);
      normalizedItemNames.add(normalized);

      if ('setName' in item && typeof item.setName === 'string') {
        const normalizedSetName = this.normalizeForMatching(item.setName);
        normalizedItemNames.add(normalizedSetName);
      }
    }
    return normalizedItemNames;
  }

  /**
   * Find exact matches in the string table
   */
  private findExactMatches(
    normalizedItemNames: Set<string>,
    filtered: Record<string, string>,
  ): Set<string> {
    const exactMatches = new Set<string>();
    const sortedKeys = Object.keys(this.entries)
      .map(Number)
      .sort((a, b) => a - b);
    const grammaticalMarkerRegex = /\[(fs|ms|ns|pl)\]/;

    for (const key of sortedKeys) {
      const stringTableEntry = this.entries[key];
      const translation = this.entries[key + 1];
      const normalizedEntry = this.normalizeForMatching(stringTableEntry);

      if (normalizedItemNames.has(normalizedEntry)) {
        if (translation && translation !== 'x' && !grammaticalMarkerRegex.test(translation)) {
          const cleanTranslation = translation.endsWith(' -')
            ? translation.slice(0, -2)
            : translation;
          filtered[normalizedEntry] = cleanTranslation;
          exactMatches.add(normalizedEntry);
        }
      }
    }

    return exactMatches;
  }

  /**
   * Try to add word-by-word translation for a single name
   */
  private tryAddWordByWordTranslation(
    name: string,
    exactMatches: Set<string>,
    wordDict: Record<string, string>,
    filtered: Record<string, string>,
  ): void {
    const normalized = this.normalizeForMatching(name);

    if (!exactMatches.has(normalized) && !filtered[normalized]) {
      const translation = this.translateWordByWord(name, wordDict);
      if (translation) {
        filtered[normalized] = translation;
      }
    }
  }

  /**
   * Add word-by-word translations for items without exact matches
   */
  private addWordByWordTranslations(
    exactMatches: Set<string>,
    wordDict: Record<string, string>,
    filtered: Record<string, string>,
  ): void {
    for (const item of items) {
      // Try item name
      this.tryAddWordByWordTranslation(item.name, exactMatches, wordDict, filtered);

      // Try setName if it exists
      if ('setName' in item && typeof item.setName === 'string') {
        this.tryAddWordByWordTranslation(item.setName, exactMatches, wordDict, filtered);
      }
    }
  }

  /**
   * Filter entries to create a key-value map of item names to translations
   * Uses exact matching first, then word-by-word translation for remaining items
   * Returns a map where key = normalized item name, value = German translation
   */
  filterByItemNames(): Record<string, string> {
    const filtered: Record<string, string> = {};

    // STEP 1: Build word dictionary for word-by-word translation
    const wordDict = this.buildWordDictionary();

    // STEP 2: Build set of all item names to match
    const normalizedItemNames = this.buildNormalizedItemNameSet();

    // STEP 3: Try exact matching for all items (priority per requirement 5a)
    const exactMatches = this.findExactMatches(normalizedItemNames, filtered);

    // STEP 4: Try word-by-word translation for items without exact matches
    this.addWordByWordTranslations(exactMatches, wordDict, filtered);

    return filtered;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): ParseOptions | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    return null;
  }

  const options: ParseOptions = {
    input: '',
    pretty: true,
    verbose: false,
    filterItems: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '--compact':
        options.pretty = false;
        break;
      case '--filter-items':
        options.filterItems = true;
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          options.input = arg;
        } else {
          console.error(`Error: Unknown option '${arg}'`);
          process.exit(1);
        }
    }
  }

  if (!options.input) {
    console.error('Error: Input file is required');
    printHelp();
    process.exit(1);
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
D2R String Table Parser

Parses D2R string.tbl files and outputs them as JSON.

Usage: tsx parse-string-tbl.ts [options] <input>

Arguments:
  input                 Input string.tbl file path

Options:
  -o, --output FILE     Output JSON file path (prints to stdout if omitted)
  --compact             Output compact JSON (default: pretty printed)
  --filter-items        Filter to only include D2R item names and following lines
  -v, --verbose         Verbose output
  -h, --help            Show this help message

Examples:
  tsx parse-string-tbl.ts string.tbl
  tsx parse-string-tbl.ts string.tbl -o output.json
  tsx parse-string-tbl.ts string.tbl -o output.json --compact
  tsx parse-string-tbl.ts string.tbl --filter-items -o items-only.json
  tsx parse-string-tbl.ts string.tbl -v
`);
}

/**
 * Output filtered JSON data
 */
function outputFilteredJSON(filtered: Record<string, string>, options: ParseOptions): void {
  const filteredCount = Object.keys(filtered).length;

  if (options.verbose) {
    console.log(`Filtered to ${filteredCount} item translations from ${items.length} total items`);
  }

  const jsonStr = options.pretty ? JSON.stringify(filtered, null, 2) : JSON.stringify(filtered);

  if (options.output) {
    fs.writeFileSync(options.output, jsonStr, 'utf8');
    if (options.verbose) {
      console.log(`Exported to ${options.output}`);
    }
  } else {
    console.log(jsonStr);
  }
}

/**
 * Output all JSON data
 */
function outputAllJSON(parser: StringTableParser, options: ParseOptions): void {
  if (options.output) {
    parser.toJSON(options.output, options.pretty);
    if (options.verbose) {
      console.log(`Exported to ${options.output}`);
    }
  } else {
    console.log(parser.toJSON(undefined, options.pretty));
  }
}

/**
 * Main function
 */
function main(): void {
  const options = parseArgs();
  if (!options) {
    return;
  }

  // Check if input file exists
  if (!fs.existsSync(options.input)) {
    console.error(`Error: Input file '${options.input}' not found`);
    process.exit(1);
  }

  if (options.verbose) {
    console.log(`Parsing ${options.input}...`);
  }

  try {
    // Parse the file
    const parser = new StringTableParser(options.input);
    parser.parse();

    if (options.verbose) {
      console.log(`Found ${parser.getEntryCount()} strings`);
    }

    // Filter if requested, otherwise output all
    if (options.filterItems) {
      const filtered = parser.filterByItemNames();
      outputFilteredJSON(filtered, options);
    } else {
      outputAllJSON(parser, options);
    }
  } catch (error) {
    console.error(`Error parsing file: ${error}`);
    if (options.verbose && error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run main if executed directly (ES module check)
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  main();
}

export { StringTableParser, type ParseOptions };
