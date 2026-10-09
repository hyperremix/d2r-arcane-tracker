import { readFile } from 'node:fs/promises';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import type { VaultLocationContext, VaultSourceFileType } from '../../types/grail';
import {
  type ClassicStashCodec,
  detectSaveFormat,
  getClassicStashCodec,
  type SaveFormat,
} from '../saveFormat/saveFormat';
import { resolveTargetCharacterClass } from './equipValidation';
import { extractItemById, findItemById } from './itemLocators';
import {
  assertCharacterGridCellsFree,
  assertTargetCellsFree,
  withD2SLocationContext,
  withTargetCoordinates,
} from './itemPlacement';
import { writeClassicStashFile, writeD2sSaveFile } from './saveFileWrites';

/**
 * Opens save files for editing. `openSaveFile` reads a file and detects its format once; character
 * saves and classic stashes are then decoded into a `DecodedSaveFile` that is edited in memory and
 * written back whole. Modern (v105+) stashes are edited per sector by the modernStash* modules.
 */

const MODERN_STASH_READ_ONLY_ERROR = 'MODERN_STASH_READ_ONLY';

/** A save file read from disk, with its detected format. */
export interface OpenedSaveFile {
  filePath: string;
  format: SaveFormat;
  buffer: Buffer;
}

/**
 * Reads a save file and detects its format. The caller-supplied file type must match the detected
 * one, and a .d2i file whose sectors cannot be read is refused before anything is edited.
 */
export async function openSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
): Promise<OpenedSaveFile> {
  const buffer = await readFile(filePath);
  const format = detectSaveFormat(filePath, buffer);

  if (format.fileType !== fileType) {
    throw new Error(
      `Save file type '${fileType}' does not match the file extension of ${filePath}`,
    );
  }

  if (format.d2iReadError !== undefined) {
    throw format.d2iReadError;
  }

  return { filePath, format, buffer };
}

/** Refuses whole-file edits of a modern stash: only its sectors can be edited. */
export function assertWholeFileWritable(file: OpenedSaveFile): void {
  if (file.format.kind === 'modernStash') {
    throw new Error(MODERN_STASH_READ_ONLY_ERROR);
  }
}

/** Opens the save file and refuses it when it is a modern stash (see `assertWholeFileWritable`). */
export async function assertWritableSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
): Promise<void> {
  assertWholeFileWritable(await openSaveFile(filePath, fileType));
}

/** Where `DecodedSaveFile.placeItem` puts an item. */
export interface ItemPlacement {
  locationContext: VaultLocationContext;
  stashTab?: number;
  gridX?: number;
  gridY?: number;
  /** Equipped slot for `locationContext: 'equipped'`; checked against the equip-slot rules. */
  equippedSlotId?: number;
}

/** A character save or classic stash decoded into memory: edit it, then write it back once. */
export interface DecodedSaveFile {
  readonly kind: 'character' | 'classicStash';
  /** First item with this id, left in place. */
  findItem(itemId: number): d2sTypes.IItem | undefined;
  /** Removes the first item with this id and returns it. Ids are not guaranteed to be unique. */
  extractItem(itemId: number): d2sTypes.IItem | undefined;
  /** Adds the item at the placement; throws TARGET_CELL_OCCUPIED when its cells are taken. */
  placeItem(item: d2sTypes.IItem, placement: ItemPlacement): void;
  /** Serializes the file, verifies that no item got lost and replaces the file on disk. */
  write(): Promise<void>;
}

export class CharacterSaveFile implements DecodedSaveFile {
  readonly kind = 'character';

  constructor(
    private readonly filePath: string,
    readonly data: d2sTypes.ID2S,
  ) {}

  findItem(itemId: number): d2sTypes.IItem | undefined {
    return (
      findItemById(this.data.items, itemId) ??
      findItemById(this.data.corpse_items, itemId) ??
      findItemById(this.data.merc_items, itemId)
    );
  }

  extractItem(itemId: number): d2sTypes.IItem | undefined {
    return (
      extractItemById(this.data.items, itemId) ??
      extractItemById(this.data.corpse_items, itemId) ??
      extractItemById(this.data.merc_items, itemId)
    );
  }

  placeItem(item: d2sTypes.IItem, placement: ItemPlacement): void {
    const itemToWrite = withD2SLocationContext(
      withTargetCoordinates(item, placement.gridX, placement.gridY),
      placement.locationContext,
      this.data.items,
      resolveTargetCharacterClass(this.data),
      placement.equippedSlotId,
    );
    this.pushItem(itemToWrite, placement.locationContext);
  }

  /** Adds an item that already carries its final location fields to the matching item list. */
  pushItem(item: d2sTypes.IItem, locationContext: VaultLocationContext): void {
    if (locationContext === 'mercenary') {
      this.data.merc_items.push(item);
    } else if (locationContext === 'corpse') {
      this.data.corpse_items.push(item);
    } else {
      assertCharacterGridCellsFree(this.data.items, item);
      this.data.items.push(item);
    }
  }

  write(): Promise<void> {
    return writeD2sSaveFile(this.filePath, this.data);
  }
}

export class ClassicStashFile implements DecodedSaveFile {
  readonly kind = 'classicStash';

  constructor(
    private readonly filePath: string,
    readonly data: d2sTypes.IStash,
    private readonly codec: ClassicStashCodec,
  ) {}

  findItem(itemId: number): d2sTypes.IItem | undefined {
    for (const page of this.data.pages) {
      const found = findItemById(page.items, itemId);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  extractItem(itemId: number): d2sTypes.IItem | undefined {
    for (const page of this.data.pages) {
      const removed = extractItemById(page.items, itemId);
      if (removed) {
        return removed;
      }
    }
    return undefined;
  }

  placeItem(item: d2sTypes.IItem, placement: ItemPlacement): void {
    const itemToWrite = withTargetCoordinates(item, placement.gridX, placement.gridY);
    const targetTab = placement.stashTab ?? 0;

    while (this.data.pages.length <= targetTab) {
      this.data.pages.push({ name: '', type: 0, items: [] });
      this.data.pageCount = this.data.pages.length;
    }

    assertTargetCellsFree(this.data.pages[targetTab].items, itemToWrite);
    this.data.pages[targetTab].items.push(itemToWrite);
  }

  write(): Promise<void> {
    return writeClassicStashFile(this.filePath, this.data, this.codec);
  }
}

/**
 * Decodes a character save or classic stash for in-memory editing.
 * @throws MODERN_STASH_READ_ONLY for a modern stash, which cannot be rewritten whole.
 */
export async function decodeSaveFile(
  file: OpenedSaveFile,
): Promise<CharacterSaveFile | ClassicStashFile> {
  switch (file.format.kind) {
    case 'character':
      return new CharacterSaveFile(file.filePath, await d2s.read(file.buffer));
    case 'classicStash': {
      const codec = getClassicStashCodec(file.format.fileType);
      return new ClassicStashFile(
        file.filePath,
        await d2stash.read(file.buffer, codec.constants),
        codec,
      );
    }
    case 'modernStash':
      throw new Error(MODERN_STASH_READ_ONLY_ERROR);
  }
}

/** Noun in the "not found" error: "save file" for characters, "stash file" for classic stashes. */
export function describeDecodedSaveFile(file: DecodedSaveFile): string {
  return file.kind === 'character' ? 'save file' : 'stash file';
}
