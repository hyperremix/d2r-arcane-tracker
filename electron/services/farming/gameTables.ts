import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * One row of a game data table (`Data/global/excel/*.txt`), keyed by column header.
 */
export type GameTableRow = Record<string, string>;

/**
 * The game data tables the farming advisor reads, by file name without `.txt`.
 */
export const FARMING_GAME_TABLES = [
  'treasureclassex',
  'levels',
  'monstats',
  'superuniques',
  'itemratio',
  'itemtypes',
  'uniqueitems',
  'setitems',
  'weapons',
  'armor',
  'misc',
] as const;

export type FarmingGameTableName = (typeof FARMING_GAME_TABLES)[number];

/**
 * The game data tables, parsed.
 */
export type FarmingGameTables = Record<FarmingGameTableName, GameTableRow[]>;

/**
 * English display names from the game's string files (`Data/local/lng/strings/*.json`), by key.
 */
export type GameStrings = ReadonlyMap<string, string>;

/** String files with the area and monster names. */
const STRING_FILES = ['levels.json', 'monsters.json'];

/**
 * Parses a tab-separated game data table. The first line holds the column headers; empty lines are
 * skipped and missing trailing cells read as empty strings.
 * @param text - The file content
 * @returns The rows, in file order
 */
export function parseGameTable(text: string): GameTableRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const headers = (lines[0] ?? '').split('\t').map((header) => header.trim());
  const rows: GameTableRow[] = [];
  for (const line of lines.slice(1)) {
    if (line.trim() === '') continue;
    const cells = line.split('\t');
    const row: GameTableRow = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

/**
 * Parses a game string file: a JSON array of entries with a `Key` and an `enUS` text.
 * @param text - The file content
 * @returns The English texts by key; empty when the file isn't a string list
 */
export function parseGameStrings(text: string): Map<string, string> {
  const strings = new Map<string, string>();
  const entries: unknown = JSON.parse(text.replace(/^﻿/, ''));
  if (!Array.isArray(entries)) return strings;
  for (const entry of entries) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof entry.Key === 'string' &&
      typeof entry.enUS === 'string'
    ) {
      strings.set(entry.Key, entry.enUS);
    }
  }
  return strings;
}

/**
 * The folder of the extracted game data tables in a D2R installation.
 */
export function getExcelDirectory(d2rInstallPath: string): string {
  return path.join(d2rInstallPath, 'Data', 'global', 'excel');
}

/**
 * Path of a game data table in a D2R installation.
 */
export function getGameTablePath(d2rInstallPath: string, table: FarmingGameTableName): string {
  return path.join(getExcelDirectory(d2rInstallPath), `${table}.txt`);
}

/**
 * Lists the game data tables that are missing from an installation.
 * @param d2rInstallPath - Path to the D2R installation
 * @returns The missing file names, e.g. `treasureclassex.txt`
 */
export function findMissingGameTables(d2rInstallPath: string): string[] {
  return FARMING_GAME_TABLES.filter(
    (table) => !existsSync(getGameTablePath(d2rInstallPath, table)),
  ).map((table) => `${table}.txt`);
}

/**
 * A fingerprint of the game data tables of an installation, which changes when one of them is
 * replaced (for example after extracting the files of a new patch).
 */
export function getGameTablesFingerprint(d2rInstallPath: string): string {
  return FARMING_GAME_TABLES.map((table) => {
    const stats = statSync(getGameTablePath(d2rInstallPath, table));
    return `${table}:${stats.size}:${stats.mtimeMs}`;
  }).join('|');
}

/**
 * Reads and parses the game data tables of an installation. All tables must exist.
 * @param d2rInstallPath - Path to the D2R installation
 * @returns The parsed tables
 */
export function readGameTables(d2rInstallPath: string): FarmingGameTables {
  const tables = {} as FarmingGameTables;
  for (const table of FARMING_GAME_TABLES) {
    tables[table] = parseGameTable(readFileSync(getGameTablePath(d2rInstallPath, table), 'utf-8'));
  }
  return tables;
}

/**
 * Reads the English area and monster names. The string files are optional: a missing or
 * unreadable file leaves its names out, and the advisor falls back to the names in the tables.
 * @param d2rInstallPath - Path to the D2R installation
 * @returns The names by string key
 */
export function readGameStrings(d2rInstallPath: string): Map<string, string> {
  const strings = new Map<string, string>();
  for (const file of STRING_FILES) {
    const filePath = path.join(d2rInstallPath, 'Data', 'local', 'lng', 'strings', file);
    if (!existsSync(filePath)) continue;
    try {
      for (const [key, value] of parseGameStrings(readFileSync(filePath, 'utf-8'))) {
        strings.set(key, value);
      }
    } catch {
      // A broken string file only costs the display names
    }
  }
  return strings;
}
