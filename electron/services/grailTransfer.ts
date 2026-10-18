import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type { GrailDatabase } from '../database/database';
import { itemsByNameSimple } from '../items/indexes';
import type { Item } from '../types/catalog';
import type { GrailProgress } from '../types/grailProgress';
import type {
  GrailExportFormat,
  GrailImportPreview,
  GrailImportResult,
  GrailImportSource,
  GrailImportUnmatched,
} from '../types/grailTransfer';
import { escapeCsvCell, parseCsv } from '../utils/csv';
import { simplifyItemName } from '../utils/objects';

/** Largest import file that is read. */
export const MAX_GRAIL_IMPORT_BYTES = 5 * 1024 * 1024;
/** Most finds an import file may hold. */
export const MAX_GRAIL_IMPORT_ENTRIES = 20_000;
/** Deepest nesting of a Nasicus/d2-holy-grail export that is read. */
const MAX_NASICUS_DEPTH = 8;

/** Identifies the app's own JSON export. */
export const GRAIL_EXPORT_FORMAT = 'd2r-arcane-tracker-grail-progress';
export const GRAIL_EXPORT_VERSION = 1;

/** Error messages of a failed import; the renderer picks its message by them. */
export const GRAIL_IMPORT_ERRORS = {
  tooLarge: 'IMPORT_FILE_TOO_LARGE',
  unreadable: 'IMPORT_FILE_UNREADABLE',
  unsupported: 'IMPORT_FORMAT_UNSUPPORTED',
  tooManyEntries: 'IMPORT_TOO_MANY_ENTRIES',
  expired: 'IMPORT_EXPIRED',
  unknownCharacter: 'IMPORT_UNKNOWN_CHARACTER',
} as const;

/** The database operations the grail export and import use. */
export type GrailTransferDatabase = Pick<
  GrailDatabase,
  | 'getAllItems'
  | 'getAllProgress'
  | 'getCharacterMap'
  | 'getCharacterById'
  | 'getCharacterByName'
  | 'upsertProgress'
  | 'transaction'
>;

/** One find of the app's JSON export. */
interface ExportedFind {
  itemId: string;
  itemName: string;
  itemType: string;
  ethereal: boolean;
  foundDate: string;
  character?: string;
  source: 'manual' | 'auto-detected';
  fromInitialScan: boolean;
}

/** A find read from an import file, before it is matched to a grail item. */
interface ImportEntry {
  name: string;
  itemId?: string;
  /** The version the file names; undefined when the file doesn't say. */
  ethereal?: boolean;
  /** Whether the name is a runeword (runewords and uniques can share a name). */
  runeword?: boolean;
  foundDate?: Date;
  characterName?: string;
}

/** A find matched to a grail item version; one per item version. */
interface MatchedFind {
  itemId: string;
  isEthereal: boolean;
  foundDate?: Date;
  characterName?: string;
}

/** What an import would write. */
export interface GrailImportPlan {
  additions: MatchedFind[];
  /** Existing finds that get the earlier found date of the file. */
  dateUpdates: Array<{ progress: GrailProgress; foundDate: Date }>;
  existingCount: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function versionKey(itemId: string, isEthereal: boolean): string {
  return `${itemId}:${isEthereal ? 'ethereal' : 'normal'}`;
}

function isFind(progress: GrailProgress): progress is GrailProgress & { foundDate: Date } {
  return progress.foundDate !== undefined;
}

/**
 * Builds the export of every find (progress record with a found date), oldest first.
 * @param database - The grail database
 * @param format - `json` for the app's own format (everything the app shows for a find), `csv` for spreadsheets
 * @param now - Export time written to the JSON file
 * @returns The file content
 */
export function buildGrailExport(
  database: GrailTransferDatabase,
  format: GrailExportFormat,
  now = new Date(),
): string {
  const items = new Map(database.getAllItems().map((item) => [item.id, item]));
  const characterNames = database.getCharacterMap();
  const finds: ExportedFind[] = database
    .getAllProgress()
    .filter(isFind)
    .sort((a, b) => a.foundDate.getTime() - b.foundDate.getTime())
    .map((progress) => ({
      itemId: progress.itemId,
      itemName: items.get(progress.itemId)?.name ?? progress.itemId,
      itemType: items.get(progress.itemId)?.type ?? '',
      ethereal: progress.isEthereal,
      foundDate: progress.foundDate.toISOString(),
      character: characterNames.get(progress.characterId),
      source: progress.manuallyAdded ? 'manual' : 'auto-detected',
      fromInitialScan: progress.fromInitialScan ?? false,
    }));

  if (format === 'json') {
    return `${JSON.stringify(
      {
        format: GRAIL_EXPORT_FORMAT,
        version: GRAIL_EXPORT_VERSION,
        exportedAt: now.toISOString(),
        finds,
      },
      null,
      2,
    )}\n`;
  }

  const header = ['item', 'item_id', 'type', 'version', 'found_date', 'character', 'source'];
  const rows = finds.map((find) =>
    [
      find.itemName,
      find.itemId,
      find.itemType,
      find.ethereal ? 'ethereal' : 'normal',
      find.foundDate,
      find.character ?? '',
      find.source,
    ]
      .map(escapeCsvCell)
      .join(','),
  );
  return `${[header.join(','), ...rows].join('\n')}\n`;
}

/**
 * Reads a found date: an ISO date (`2024-01-15`, local midnight) or date and time. Dates that
 * can't be read or lie in the future count as no date.
 */
function parseImportDate(value: unknown, now: Date): Date | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  let date: Date | undefined;
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    date = new Date(Number(year), Number(month) - 1, Number(day));
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    date = new Date(text);
  }
  if (!date || Number.isNaN(date.getTime()) || date.getTime() > now.getTime()) {
    return undefined;
  }
  return date;
}

/** Reads a version cell: ethereal, normal, or undefined when empty or unknown. */
function parseEtherealCell(value: string | undefined): boolean | undefined {
  const text = value?.trim().toLowerCase() ?? '';
  if (['ethereal', 'eth', 'true', 'yes', 'y', '1', 'x'].includes(text)) {
    return true;
  }
  if (['normal', 'false', 'no', 'n', '0'].includes(text)) {
    return false;
  }
  return undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function readAppJson(data: Record<string, unknown>, now: Date): ImportEntry[] {
  if (!Array.isArray(data.finds)) {
    throw new Error(GRAIL_IMPORT_ERRORS.unsupported);
  }
  const entries: ImportEntry[] = [];
  for (const find of data.finds) {
    if (!isPlainObject(find)) {
      continue;
    }
    const itemId = optionalString(find.itemId);
    const name = optionalString(find.itemName) ?? itemId;
    if (!name) {
      continue;
    }
    entries.push({
      name,
      itemId,
      ethereal: typeof find.ethereal === 'boolean' ? find.ethereal : undefined,
      runeword: find.itemType === 'runeword',
      foundDate: parseImportDate(find.foundDate, now),
      characterName: optionalString(find.character),
    });
  }
  return entries;
}

const NASICUS_FACET_KEY = 'rainbow facet (jewel)';
const NASICUS_FACET_ELEMENTS: Record<string, string> = {
  cold: 'cold',
  light: 'lightning',
  fire: 'fire',
  poison: 'poison',
};
const NASICUS_FACET_TRIGGERS: Record<string, string> = { 'level up': 'levelup', die: 'death' };

/** A leaf of a Nasicus/d2-holy-grail tree: an empty object or one with its item fields. */
function isNasicusItem(value: unknown): value is Record<string, unknown> {
  return (
    isPlainObject(value) &&
    (Object.keys(value).length === 0 ||
      'wasFound' in value ||
      'note' in value ||
      'isPerfect' in value)
  );
}

/** `wasFound` is a boolean, or a count in Nasicus' item counter mode. */
function isNasicusFound(item: Record<string, unknown>): boolean {
  const { wasFound } = item;
  return wasFound === true || (typeof wasFound === 'number' && wasFound > 0);
}

/** Collects the found leaves of a Nasicus/d2-holy-grail tree. */
function collectNasicusFinds(
  node: Record<string, unknown>,
  path: string[],
  template: Pick<ImportEntry, 'ethereal' | 'runeword'>,
  entries: ImportEntry[],
): void {
  if (path.length > MAX_NASICUS_DEPTH) {
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (isNasicusItem(value)) {
      if (!isNasicusFound(value)) {
        continue;
      }
      const facetTrigger = NASICUS_FACET_TRIGGERS[path[path.length - 1]?.toLowerCase() ?? ''];
      const facetElement = NASICUS_FACET_ELEMENTS[key.toLowerCase()];
      if (path.includes(NASICUS_FACET_KEY) && facetTrigger && facetElement) {
        entries.push({
          ...template,
          name: `Rainbow Facet (${key}, ${path[path.length - 1]})`,
          itemId: `rainbowfacet${facetElement}${facetTrigger}`,
        });
      } else {
        entries.push({ ...template, name: key });
      }
    } else if (isPlainObject(value)) {
      collectNasicusFinds(value, [...path, key], template, entries);
    }
  }
}

/**
 * Reads a JSON export of Nasicus/d2-holy-grail. Its "holy" export has `uniques` and `sets`, its
 * ethereal export only `uniques`, its runeword export maps runeword names to items, and its
 * conflict download wraps them as `grailData`, `ethData` and `runewordData`. No dates are stored.
 * @returns The found items, or undefined when the data isn't shaped like such an export
 */
function readNasicusJson(data: Record<string, unknown>): ImportEntry[] | undefined {
  const entries: ImportEntry[] = [];
  if ('grailData' in data || 'ethData' in data || 'runewordData' in data) {
    const { grailData, ethData, runewordData } = data;
    if (isPlainObject(grailData)) collectNasicusFinds(grailData, [], {}, entries);
    if (isPlainObject(ethData)) collectNasicusFinds(ethData, [], { ethereal: true }, entries);
    if (isPlainObject(runewordData)) {
      collectNasicusFinds(runewordData, [], { runeword: true }, entries);
    }
    return entries;
  }
  if (isPlainObject(data.uniques) || isPlainObject(data.sets)) {
    // The ethereal grail has no sets
    collectNasicusFinds(data, [], 'sets' in data ? {} : { ethereal: true }, entries);
    return entries;
  }
  const values = Object.values(data);
  if (values.length > 0 && values.every(isNasicusItem)) {
    collectNasicusFinds(data, [], { runeword: true }, entries);
    return entries;
  }
  return undefined;
}

const CSV_COLUMNS = {
  name: ['item', 'name', 'item name', 'item_name', 'itemname'],
  itemId: ['item_id', 'itemid', 'item id', 'id'],
  ethereal: ['ethereal', 'eth', 'version'],
  date: ['found_date', 'found date', 'founddate', 'date', 'found'],
  type: ['type', 'item_type'],
  character: ['character', 'char'],
};

/**
 * Reads a CSV list of item names. With a header row, the columns are found by name (item or name,
 * and optionally item_id, version or ethereal, found_date or date, type and character); without
 * one, the columns are item name, version and found date.
 */
function readCsv(text: string, now: Date): ImportEntry[] {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return [];
  }
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const column = (names: string[]) => header.findIndex((cell) => names.includes(cell));
  const hasHeader = column(CSV_COLUMNS.name) >= 0;
  const indexes = hasHeader
    ? {
        name: column(CSV_COLUMNS.name),
        itemId: column(CSV_COLUMNS.itemId),
        ethereal: column(CSV_COLUMNS.ethereal),
        date: column(CSV_COLUMNS.date),
        type: column(CSV_COLUMNS.type),
        character: column(CSV_COLUMNS.character),
      }
    : { name: 0, itemId: -1, ethereal: 1, date: 2, type: -1, character: -1 };

  const cellOf = (row: string[], index: number) => (index >= 0 ? row[index] : undefined);
  const entries: ImportEntry[] = [];
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const name = optionalString(cellOf(row, indexes.name));
    if (!name) {
      continue;
    }
    entries.push({
      name,
      itemId: optionalString(cellOf(row, indexes.itemId)),
      ethereal: parseEtherealCell(cellOf(row, indexes.ethereal)),
      runeword: cellOf(row, indexes.type)?.trim().toLowerCase() === 'runeword',
      foundDate: parseImportDate(cellOf(row, indexes.date), now),
      characterName: optionalString(cellOf(row, indexes.character)),
    });
  }
  return entries;
}

/**
 * Reads the finds of an import file.
 * @param content - The file content
 * @param extension - `.json` or `.csv` (lower case)
 * @param now - Dates after it are ignored
 * @throws If the content isn't a supported format or holds too many finds
 */
export function readGrailImport(
  content: string,
  extension: string,
  now = new Date(),
): { source: GrailImportSource; entries: ImportEntry[] } {
  let result: { source: GrailImportSource; entries: ImportEntry[] };
  if (extension === '.csv') {
    result = { source: 'csv', entries: readCsv(content, now) };
  } else {
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      throw new Error(GRAIL_IMPORT_ERRORS.unsupported);
    }
    if (!isPlainObject(data)) {
      throw new Error(GRAIL_IMPORT_ERRORS.unsupported);
    }
    if (data.format === GRAIL_EXPORT_FORMAT) {
      result = { source: 'app-json', entries: readAppJson(data, now) };
    } else {
      const entries = readNasicusJson(data);
      if (!entries) {
        throw new Error(GRAIL_IMPORT_ERRORS.unsupported);
      }
      result = { source: 'nasicus-json', entries };
    }
  }
  if (result.entries.length > MAX_GRAIL_IMPORT_ENTRIES) {
    throw new Error(GRAIL_IMPORT_ERRORS.tooManyEntries);
  }
  return result;
}

/**
 * Finds the grail item of an import entry: by item ID, then by name (ignoring case, spaces and
 * punctuation, including the alternative names the save file parser uses). "Ber Rune" also finds
 * the rune "Ber".
 */
function createItemMatcher(items: Item[]): (entry: ImportEntry) => Item | undefined {
  const byId = new Map(items.map((item) => [item.id, item]));
  const byName = new Map<string, Item>();
  const runewordsByName = new Map<string, Item>();
  for (const item of items) {
    (item.type === 'runeword' ? runewordsByName : byName).set(simplifyItemName(item.name), item);
  }
  const lookup = (key: string, runeword: boolean | undefined) => {
    const other = byName.get(key) ?? byId.get(itemsByNameSimple[key]?.id ?? '');
    return runeword ? (runewordsByName.get(key) ?? other) : (other ?? runewordsByName.get(key));
  };

  return (entry) => {
    const byItemId = entry.itemId ? byId.get(entry.itemId) : undefined;
    if (byItemId) {
      return byItemId;
    }
    const key = simplifyItemName(entry.name);
    return (
      lookup(key, entry.runeword) ??
      (key.endsWith('rune') ? lookup(key.slice(0, -'rune'.length), entry.runeword) : undefined)
    );
  };
}

/** The version of an item to record: the requested one if the item has it. */
function resolveEthereal(item: Item, requested: boolean | undefined): boolean | undefined {
  const canBeNormal = item.etherealType !== 'only';
  const canBeEthereal = item.etherealType !== 'none';
  if (requested === undefined) {
    return !canBeNormal;
  }
  return (requested ? canBeEthereal : canBeNormal) ? requested : undefined;
}

function isEarlier(date: Date | undefined, than: Date | undefined): boolean {
  return date !== undefined && (than === undefined || date.getTime() < than.getTime());
}

/**
 * Matches import entries to grail item versions. Each item version is kept once, with the
 * earliest date of the file (and the character of that entry).
 * @returns The matched finds and the entries that match no item version, each listed once
 */
export function matchGrailImport(
  entries: ImportEntry[],
  items: Item[],
): { finds: MatchedFind[]; unmatched: GrailImportUnmatched[] } {
  const matchItem = createItemMatcher(items);
  const finds = new Map<string, MatchedFind>();
  const unmatched = new Map<string, GrailImportUnmatched>();

  for (const entry of entries) {
    const find = matchEntry(entry, matchItem);
    if ('name' in find) {
      unmatched.set(`${find.name}:${find.version ?? ''}`, find);
      continue;
    }
    const key = versionKey(find.itemId, find.isEthereal);
    if (!finds.has(key) || isEarlier(find.foundDate, finds.get(key)?.foundDate)) {
      finds.set(key, find);
    }
  }

  return { finds: [...finds.values()], unmatched: [...unmatched.values()] };
}

/** Matches one entry to a grail item version, or describes why it doesn't match. */
function matchEntry(
  entry: ImportEntry,
  matchItem: (entry: ImportEntry) => Item | undefined,
): MatchedFind | GrailImportUnmatched {
  const item = matchItem(entry);
  if (!item) {
    return { name: entry.name };
  }
  const isEthereal = resolveEthereal(item, entry.ethereal);
  if (isEthereal === undefined) {
    // The item exists, but not in the requested version
    return { name: entry.name, version: entry.ethereal ? 'ethereal' : 'normal' };
  }
  const { foundDate, characterName } = entry;
  return { itemId: item.id, isEthereal, foundDate, characterName };
}

/**
 * Decides what an import writes. A find of an item version that is already found is never added
 * again; when the file has an earlier date, the earliest existing find of that version gets it.
 * @param finds - The matched finds of the file
 * @param progress - All progress records of the database
 */
export function planGrailImport(finds: MatchedFind[], progress: GrailProgress[]): GrailImportPlan {
  const earliestExisting = new Map<string, GrailProgress & { foundDate: Date }>();
  for (const record of progress.filter(isFind)) {
    const key = versionKey(record.itemId, record.isEthereal);
    const known = earliestExisting.get(key);
    if (!known || record.foundDate.getTime() < known.foundDate.getTime()) {
      earliestExisting.set(key, record);
    }
  }

  const plan: GrailImportPlan = { additions: [], dateUpdates: [], existingCount: 0 };
  for (const find of finds) {
    const existing = earliestExisting.get(versionKey(find.itemId, find.isEthereal));
    if (!existing) {
      plan.additions.push(find);
      continue;
    }
    plan.existingCount += 1;
    if (find.foundDate && isEarlier(find.foundDate, existing.foundDate)) {
      plan.dateUpdates.push({ progress: existing, foundDate: find.foundDate });
    }
  }
  return plan;
}

interface PendingImport {
  importId: string;
  finds: MatchedFind[];
}

/**
 * Exports the grail progress and imports finds from export files. An import is read and previewed
 * first; only the latest preview can be applied, and it is planned again against the database
 * when it is applied.
 */
export class GrailTransferService {
  private pendingImport: PendingImport | undefined;

  constructor(
    private readonly database: GrailTransferDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Builds the export file content (see {@link buildGrailExport}). */
  exportProgress(format: GrailExportFormat): string {
    return buildGrailExport(this.database, format, this.now());
  }

  /**
   * Reads an import file and previews what importing it would change. Nothing is written.
   * @param filePath - Absolute path of a `.json` or `.csv` file the user picked
   * @throws With a {@link GRAIL_IMPORT_ERRORS} message if the file is too large, can't be read
   *   or isn't a supported format
   */
  async previewImport(filePath: string): Promise<GrailImportPreview> {
    let content: string;
    try {
      if ((await stat(filePath)).size > MAX_GRAIL_IMPORT_BYTES) {
        throw new Error(GRAIL_IMPORT_ERRORS.tooLarge);
      }
      content = await readFile(filePath, 'utf-8');
    } catch (error) {
      if (error instanceof Error && error.message === GRAIL_IMPORT_ERRORS.tooLarge) {
        throw error;
      }
      throw new Error(GRAIL_IMPORT_ERRORS.unreadable);
    }

    const { source, entries } = readGrailImport(
      content,
      extname(filePath).toLowerCase(),
      this.now(),
    );
    const { finds, unmatched } = matchGrailImport(entries, this.database.getAllItems());
    const plan = planGrailImport(finds, this.database.getAllProgress());
    const importId = randomUUID();
    this.pendingImport = { importId, finds };

    return {
      importId,
      source,
      fileName: basename(filePath),
      matchedCount: finds.length,
      newCount: plan.additions.length,
      existingCount: plan.existingCount,
      earlierDateCount: plan.dateUpdates.length,
      unmatched,
    };
  }

  /**
   * Applies the latest preview in one transaction. New finds are recorded as manual finds of the
   * character named in the file if it exists, otherwise of `characterId`; finds without a date get
   * the import time.
   * @param importId - ID of the latest preview
   * @param characterId - Character for finds without a known character; needed when finds are added
   * @throws If the preview is not the latest one, or finds are added and the character doesn't exist
   */
  applyImport(importId: string, characterId: string | undefined): GrailImportResult {
    const pending = this.pendingImport;
    if (!pending || pending.importId !== importId) {
      throw new Error(GRAIL_IMPORT_ERRORS.expired);
    }

    const plan = planGrailImport(pending.finds, this.database.getAllProgress());
    const fallbackCharacter = characterId ? this.database.getCharacterById(characterId) : undefined;
    if (plan.additions.length > 0 && !fallbackCharacter) {
      throw new Error(GRAIL_IMPORT_ERRORS.unknownCharacter);
    }
    const importedAt = this.now();
    this.database.transaction(() => {
      plan.additions.forEach((find, index) => {
        const character =
          (find.characterName && this.database.getCharacterByName(find.characterName)) ||
          fallbackCharacter;
        if (!character) {
          throw new Error(GRAIL_IMPORT_ERRORS.unknownCharacter);
        }
        const version = find.isEthereal ? 'ethereal' : 'normal';
        this.database.upsertProgress({
          id: `manual_${character.id}_${find.itemId}_${version}_${importedAt.getTime()}_${index}`,
          characterId: character.id,
          itemId: find.itemId,
          foundDate: find.foundDate ?? importedAt,
          manuallyAdded: true,
          isEthereal: find.isEthereal,
        });
      });
      for (const { progress, foundDate } of plan.dateUpdates) {
        this.database.upsertProgress({ ...progress, foundDate });
      }
    });
    this.pendingImport = undefined;

    return { added: plan.additions.length, earlierDates: plan.dateUpdates.length };
  }
}
