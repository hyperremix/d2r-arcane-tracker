import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type {
  D2SItem,
  ParsedInventoryItem,
  StashTabKind,
  VaultLocationContext,
  VaultSourceFileType,
} from '../../types/grail';
import { GameMode } from '../../types/grail';
import { isModernStashVersion } from '../../utils/d2rFormat';
import { createServiceLogger } from '../../utils/serviceLogger';
import { normalizeItemsWithSocketedItems } from '../itemNormalizer';
import { parseModernStash } from '../modernStashParser';
import { readD2iHeaderVersion, readD2iMetadata } from '../stashFormat';

const log = createServiceLogger('SaveFileMonitor');

/**
 * How much of a save file a parse really read.
 * - 'parsed': the whole file was read.
 * - 'partial': only some of the file could be read (a damaged .d2i sector); the items found so far are kept.
 * - 'skipped': filtered out by the configured game mode.
 * - 'errored': a parse error was swallowed.
 * Only 'parsed' proves which items are gone from a file; every other status yields no or only some items.
 */
export type SaveParseStatus = 'parsed' | 'partial' | 'skipped' | 'errored';

/** Items of one save file plus what the parse learned about its header. */
export interface SaveParseResult {
  items: ParsedInventoryItem[];
  status: SaveParseStatus;
  /** Hardcore flag read from a stash header (.sss/.d2x/.d2i), when the parser got that far. */
  stashHardcore?: boolean;
}

/** The already read content of one save file. */
export interface SaveFileContent {
  saveName: string;
  filePath: string;
  content: Buffer;
  /** Lower-case file extension (.d2s, .sss, .d2x, .d2i). */
  extension: string;
}

/**
 * Reads the configured game mode. It is asked only after a file was decoded, once per file.
 * Without a reader (no database) every file is skipped.
 */
export type GameModeReader = () => GameMode | undefined;

/** True when a save's softcore/hardcore status is excluded by the configured game mode. */
export const isGameModeMismatch = (gameMode: GameMode | undefined, isHardcore: boolean): boolean =>
  (gameMode === GameMode.Softcore && isHardcore) || (gameMode === GameMode.Hardcore && !isHardcore);

/**
 * Parses a single save file and extracts items from it.
 * @param file - The save file and its binary content.
 * @param readGameMode - Reads the configured game mode; without it every file is skipped.
 * @returns A promise that resolves with the extracted items and whether the file was really parsed.
 * A game-mode mismatch or a swallowed parse error yields no items without being a successful
 * scan, so callers (vault reconciliation) must not read "no items" as "every item left the file".
 */
export async function parseSaveContent(
  { saveName, filePath, content, extension }: SaveFileContent,
  readGameMode: GameModeReader | undefined,
): Promise<SaveParseResult> {
  const items: ParsedInventoryItem[] = [];
  let stashHardcore: boolean | undefined;

  const sourceFileType = extension.replace('.', '') as VaultSourceFileType;

  const parseItems = (
    itemList: D2SItem[],
    fallbackLocation: VaultLocationContext,
    stashTab?: number,
    stashTabKind?: StashTabKind,
    stackCount?: number,
  ) => {
    items.push(
      ...normalizeItemsWithSocketedItems(itemList, {
        filePath,
        saveName,
        sourceFileType,
        fallbackLocation,
        stashTab,
        stashTabKind,
        stackCount,
      }),
    );
  };

  // Each parser reports how much of the file it really read, so no shared mutable status is needed.
  const parseD2S = (response: d2s.types.ID2S): SaveParseStatus => {
    if (!readGameMode) {
      return 'skipped';
    }

    const gameMode = readGameMode();
    const isHardcore = response.header.status.hardcore;

    if (isGameModeMismatch(gameMode, isHardcore)) {
      return 'skipped';
    }
    const inventoryItems = (response.items || []) as D2SItem[];
    const mercItems = (response.merc_items || []) as D2SItem[];
    const corpseItems = (response.corpse_items || []) as D2SItem[];
    parseItems(inventoryItems, 'inventory');
    parseItems(mercItems, 'mercenary');
    parseItems(corpseItems, 'corpse');
    return 'parsed';
  };

  const parseStash = (response: d2s.types.IStash): SaveParseStatus => {
    if (!readGameMode) {
      return 'skipped';
    }

    const gameMode = readGameMode();
    // Use hardcore flag from parsed stash header instead of filename
    const isHardcore = response.hardcore;
    stashHardcore = isHardcore;

    if (isGameModeMismatch(gameMode, isHardcore)) {
      return 'skipped';
    }

    response.pages.forEach((page, pageIndex) => {
      parseItems(page.items as D2SItem[], 'stash', pageIndex);
    });
    return 'parsed';
  };

  const parseModernD2i = async (): Promise<SaveParseStatus> => {
    if (!readGameMode) {
      return 'skipped';
    }

    const modern = await parseModernStash(content);
    const gameMode = readGameMode();
    const isHardcore = modern.hardcore;
    stashHardcore = isHardcore;

    if (isGameModeMismatch(gameMode, isHardcore)) {
      return 'skipped';
    }

    modern.items.forEach((entry) => {
      parseItems([entry.item], 'stash', entry.stashTab, entry.stashTabKind, entry.stackCount);
    });
    // A damaged sector leaves its items out: keep what was read, but do not call it a full scan.
    return modern.partial ? 'partial' : 'parsed';
  };

  const parseD2i = async (): Promise<SaveParseStatus> => {
    let d2iVersion: number | undefined;
    try {
      const metadata = readD2iMetadata(content);
      d2iVersion = metadata.version;
      if (isModernStashVersion(metadata.version)) {
        return await parseModernD2i();
      }
      return await d2stash.read(content, constants99).then(parseStash);
    } catch {
      // Only fall back to classic stash parsing for pre-105 format files.
      // Calling d2stash.read on a v105+ .d2i file would fail or produce
      // garbage because the formats are incompatible. A v105+ file cut off inside a
      // sector throws before the metadata version is known, so read it from the header.
      d2iVersion ??= readD2iHeaderVersion(content);
      if (!isModernStashVersion(d2iVersion)) {
        return await d2stash.read(content, constants99).then(parseStash);
      }
      // The swallowed error leaves the item list empty or partial: not a complete scan.
      return 'errored';
    }
  };

  const parseByExtension = (): Promise<SaveParseStatus> => {
    switch (extension) {
      case '.sss':
      case '.d2x':
        return d2stash.read(content, constants96).then(parseStash);
      case '.d2i':
        return parseD2i();
      default:
        return d2s.read(content).then(parseD2S);
    }
  };

  const status = await parseByExtension();
  return { items, status, stashHardcore };
}

/**
 * Reads the hardcore flag from the header of a legacy shared stash (.sss/.d2x).
 * Returns undefined when the stash cannot be parsed, so callers fall back to the file name.
 */
export async function readLegacyStashHardcore(buffer: Buffer): Promise<boolean | undefined> {
  try {
    return (await d2stash.read(buffer, constants96)).hardcore;
  } catch (_parseError) {
    log.warn('parseSaveFile', 'Failed to parse legacy stash header, falling back to filename');
    return undefined;
  }
}
