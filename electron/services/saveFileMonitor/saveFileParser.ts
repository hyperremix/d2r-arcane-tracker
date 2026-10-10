import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import type {
  D2SItem,
  ParsedInventoryItemWithRaw,
  StashTabKind,
  VaultLocationContext,
  VaultSourceFileType,
} from '../../types/grail';
import { GameMode } from '../../types/grail';
import { createServiceLogger } from '../../utils/serviceLogger';
import { normalizeItemsWithSocketedItems } from '../itemNormalizer';
import { parseModernStash } from '../modernStashParser';
import { detectSaveFormat, getClassicStashCodec, type SaveFormat } from '../saveFormat/saveFormat';

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
  items: ParsedInventoryItemWithRaw[];
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
  const items: ParsedInventoryItemWithRaw[] = [];
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

  const parseFormat = async (format: SaveFormat): Promise<SaveParseStatus> => {
    switch (format.kind) {
      case 'character':
        return parseD2S(await d2s.read(content));
      case 'classicStash':
        return parseStash(
          await d2stash.read(content, getClassicStashCodec(format.fileType).constants),
        );
      case 'modernStash':
        // Reading a v105+ file with the classic stash codec would fail or produce garbage, so a
        // modern stash that cannot be read yields no (or only some) items instead.
        if (format.d2iReadError !== undefined) {
          return 'errored';
        }
        try {
          return await parseModernD2i();
        } catch {
          return 'errored';
        }
    }
  };

  const status = await parseFormat(detectSaveFormat(filePath, content));
  return { items, status, stashHardcore };
}

/**
 * Reads the hardcore flag from the header of a legacy shared stash (.sss/.d2x).
 * Returns undefined when the stash cannot be parsed, so callers fall back to the file name.
 */
export async function readLegacyStashHardcore(buffer: Buffer): Promise<boolean | undefined> {
  try {
    return (await d2stash.read(buffer, getClassicStashCodec('sss').constants)).hardcore;
  } catch (_parseError) {
    log.warn('parseSaveFile', 'Failed to parse legacy stash header, falling back to filename');
    return undefined;
  }
}
