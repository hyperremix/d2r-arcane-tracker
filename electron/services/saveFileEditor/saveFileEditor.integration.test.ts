import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addItemToRotwCharacterSave,
  finalizeSave,
  hasValidSizeAndChecksum,
  readModernStashItem,
  readWarlockSave,
} from '../../test/helpers/rotwCharacterSave';
import type { VaultItem } from '../../types/vault';
import { ensureD2sConstants } from '../d2s/constants';
import { parseModernStash } from '../modernStashParser';
import { configureSaveFileBackups } from '../saveFileBackup';
import { type VaultDatabase, VaultService } from '../vaultService';
import {
  addItemToSaveFile,
  assertSaveFileAllowsItemRemoval,
  moveItemBetweenSaveFiles,
  readSaveFileItem,
  removeItemFromSaveFile,
  splitStackInSaveFile,
} from './index';

// These tests run the real d2s library against a real v105 shared stash fixture: the point is that
// no operation may ever change the number of items (or runes) in the stash unexpectedly.

const FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
);
const GRID_SIZE = 10;

type ParsedEntry = Awaited<ReturnType<typeof parseModernStash>>['items'][number];

function collectOccupiedCells(entries: ParsedEntry[], stashTab: number): Set<string> {
  const occupied = new Set<string>();
  for (const entry of entries.filter((candidate) => candidate.stashTab === stashTab)) {
    const x = entry.item.position_x as number;
    const y = entry.item.position_y as number;
    for (let dx = 0; dx < (entry.item.inv_width as number); dx += 1) {
      for (let dy = 0; dy < (entry.item.inv_height as number); dy += 1) {
        occupied.add(`${x + dx},${y + dy}`);
      }
    }
  }
  return occupied;
}

function isAreaFree(
  occupied: Set<string>,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  for (let dx = 0; dx < width; dx += 1) {
    for (let dy = 0; dy < height; dy += 1) {
      if (occupied.has(`${x + dx},${y + dy}`)) {
        return false;
      }
    }
  }
  return true;
}

function findFreeCell(
  entries: ParsedEntry[],
  stashTab: number,
  width = 1,
  height = 1,
): { x: number; y: number } {
  const occupied = collectOccupiedCells(entries, stashTab);

  for (let y = GRID_SIZE - height; y >= 0; y -= 1) {
    for (let x = GRID_SIZE - width; x >= 0; x -= 1) {
      if (isAreaFree(occupied, x, y, width, height)) {
        return { x, y };
      }
    }
  }
  throw new Error(`No free ${width}x${height} area in tab ${stashTab}`);
}

function findFreeCells(
  entries: ParsedEntry[],
  stashTab: number,
  count: number,
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  const remainingEntries = [...entries];
  for (let index = 0; index < count; index += 1) {
    const cell = findFreeCell(remainingEntries, stashTab);
    cells.push(cell);
    remainingEntries.push({
      stashTab,
      item: { position_x: cell.x, position_y: cell.y, inv_width: 1, inv_height: 1 },
    } as unknown as ParsedEntry);
  }
  return cells;
}

function totalUnits(entries: ParsedEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.stackCount, 0);
}

async function parseFile(path: string): Promise<ParsedEntry[]> {
  return (await parseModernStash(readFileSync(path))).items;
}

function toLocator(entry: ParsedEntry) {
  return {
    sourceItemId: typeof entry.item.id === 'number' ? entry.item.id : undefined,
    sourceItemCode: String(entry.item.code),
    sourceStashTab: entry.stashTab,
    sourceGridXFromItem: entry.item.position_x as number,
    sourceGridYFromItem: entry.item.position_y as number,
  };
}

describe('When the real saveFileEditor modifies a v105 shared stash', () => {
  let directory: string;
  let stashA: string;
  let stashB: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'editor-integration-'));
    stashA = join(directory, 'A.d2i');
    stashB = join(directory, 'B.d2i');
    copyFileSync(FIXTURE_PATH, stashA);
    copyFileSync(FIXTURE_PATH, stashB);
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  describe('If a shared-tab item is moved to a free cell of another tab in the same file', () => {
    it('Then the stash holds the same number of items and the item sits in the new cell', async () => {
      // Arrange
      const before = await parseFile(stashA);
      const source = before.find(
        (entry) => entry.stashTab === 0 && entry.stashTabKind === 'shared',
      );
      expect(source).toBeDefined();
      const sourceEntry = source as ParsedEntry;
      const target = findFreeCell(
        before,
        1,
        sourceEntry.item.inv_width as number,
        sourceEntry.item.inv_height as number,
      );

      // Act
      await moveItemBetweenSaveFiles({
        sourceFilePath: stashA,
        sourceFileType: 'd2i',
        ...toLocator(sourceEntry),
        targetFilePath: stashA,
        targetFileType: 'd2i',
        targetLocationContext: 'stash',
        targetStashTab: 1,
        targetGridX: target.x,
        targetGridY: target.y,
      });

      // Assert
      const after = await parseFile(stashA);
      expect(after).toHaveLength(before.length);
      expect(totalUnits(after)).toBe(totalUnits(before));
      const moved = after.find(
        (entry) =>
          entry.stashTab === 1 &&
          entry.item.position_x === target.x &&
          entry.item.position_y === target.y,
      );
      expect(moved?.item.code).toBe(sourceEntry.item.code);
      expect(
        after.some(
          (entry) =>
            entry.stashTab === 0 &&
            entry.item.position_x === sourceEntry.item.position_x &&
            entry.item.position_y === sourceEntry.item.position_y,
        ),
      ).toBe(false);
    }, 30000);
  });

  describe('If a shared-tab item is moved onto an occupied cell', () => {
    it('Then the move is rejected and the stash file is byte-identical', async () => {
      // Arrange
      const before = await parseFile(stashA);
      const source = before.find((entry) => entry.stashTab === 0) as ParsedEntry;
      const occupiedTarget = before.find(
        (entry) => entry.stashTab === 1 && entry.stashTabKind === 'shared',
      ) as ParsedEntry;
      const originalBytes = readFileSync(stashA);

      // Act
      const act = moveItemBetweenSaveFiles({
        sourceFilePath: stashA,
        sourceFileType: 'd2i',
        ...toLocator(source),
        targetFilePath: stashA,
        targetFileType: 'd2i',
        targetLocationContext: 'stash',
        targetStashTab: 1,
        targetGridX: occupiedTarget.item.position_x as number,
        targetGridY: occupiedTarget.item.position_y as number,
      });

      // Assert
      await expect(act).rejects.toThrow('TARGET_CELL_OCCUPIED');
      expect(readFileSync(stashA).equals(originalBytes)).toBe(true);
    }, 30000);
  });

  describe('If a shared-tab item is moved to a different stash file', () => {
    it('Then exactly one item leaves the source and one arrives at the target', async () => {
      // Arrange
      const sourceBefore = await parseFile(stashA);
      const targetBefore = await parseFile(stashB);
      const source = sourceBefore.find((entry) => entry.stashTab === 0) as ParsedEntry;
      const target = findFreeCell(
        targetBefore,
        2,
        source.item.inv_width as number,
        source.item.inv_height as number,
      );

      // Act
      await moveItemBetweenSaveFiles({
        sourceFilePath: stashA,
        sourceFileType: 'd2i',
        ...toLocator(source),
        targetFilePath: stashB,
        targetFileType: 'd2i',
        targetLocationContext: 'stash',
        targetStashTab: 2,
        targetGridX: target.x,
        targetGridY: target.y,
      });

      // Assert
      expect(await parseFile(stashA)).toHaveLength(sourceBefore.length - 1);
      expect(await parseFile(stashB)).toHaveLength(targetBefore.length + 1);
    }, 30000);
  });

  describe('If the same file is addressed through a differently written path', () => {
    it('Then the item is moved inside the file instead of being added and removed again', async () => {
      // Arrange
      const before = await parseFile(stashA);
      const source = before.find((entry) => entry.stashTab === 0) as ParsedEntry;
      const target = findFreeCell(
        before,
        3,
        source.item.inv_width as number,
        source.item.inv_height as number,
      );
      const aliasPath = join(directory, 'sub', '..', 'A.d2i');

      // Act
      await moveItemBetweenSaveFiles({
        sourceFilePath: stashA,
        sourceFileType: 'd2i',
        ...toLocator(source),
        targetFilePath: aliasPath,
        targetFileType: 'd2i',
        targetLocationContext: 'stash',
        targetStashTab: 3,
        targetGridX: target.x,
        targetGridY: target.y,
      });

      // Assert
      const after = await parseFile(stashA);
      expect(after).toHaveLength(before.length);
    }, 30000);
  });

  describe('If a rune stack is moved out of the runes tab as a whole', () => {
    it('Then it is rejected and no rune is lost', async () => {
      // Arrange
      const before = await parseFile(stashA);
      const stack = before.find(
        (entry) => entry.stashTabKind === 'runes' && entry.stackCount > 1,
      ) as ParsedEntry;
      expect(stack).toBeDefined();
      const target = findFreeCell(before, 0);
      const originalBytes = readFileSync(stashA);

      // Act
      const act = moveItemBetweenSaveFiles({
        sourceFilePath: stashA,
        sourceFileType: 'd2i',
        ...toLocator(stack),
        targetFilePath: stashA,
        targetFileType: 'd2i',
        targetLocationContext: 'stash',
        targetStashTab: 0,
        targetGridX: target.x,
        targetGridY: target.y,
      });

      // Assert
      await expect(act).rejects.toThrow('STACK_MOVE_REQUIRES_SPLIT');
      expect(readFileSync(stashA).equals(originalBytes)).toBe(true);
    }, 30000);
  });

  describe('If units are split off a rune stack into free shared cells', () => {
    it('Then the total number of runes stays the same', async () => {
      // Arrange
      const before = await parseFile(stashA);
      const stack = before.find(
        (entry) => entry.stashTabKind === 'runes' && entry.stackCount > 2,
      ) as ParsedEntry;
      expect(stack).toBeDefined();
      const [firstCell, secondCell] = findFreeCells(before, 0, 2);

      // Act
      await splitStackInSaveFile({
        sourceFilePath: stashA,
        sourceFileType: 'd2i',
        sourceStashTab: stack.stashTab,
        sourceItemCode: String(stack.item.code),
        sourceRawItemJson: JSON.stringify(stack.item),
        splitCount: 5,
        targets: [firstCell, secondCell].map((cell) => ({
          targetFilePath: stashA,
          targetFileType: 'd2i' as const,
          targetLocationContext: 'stash' as const,
          targetStashTab: 0,
          targetGridX: cell.x,
          targetGridY: cell.y,
        })),
      });

      // Assert: only the two placed units left the stack, none disappeared
      const after = await parseFile(stashA);
      expect(totalUnits(after)).toBe(totalUnits(before));
      const afterStack = after.find(
        (entry) => entry.stashTabKind === 'runes' && entry.item.code === stack.item.code,
      ) as ParsedEntry;
      expect(afterStack.stackCount).toBe(stack.stackCount - 2);
    }, 30000);
  });

  describe('If an item is vaulted and later written back', () => {
    it('Then the stash ends up with the same number of items again', async () => {
      // Arrange
      const before = await parseFile(stashA);
      const entry = before.find((candidate) => candidate.stashTab === 0) as ParsedEntry;
      const locator = {
        itemId: typeof entry.item.id === 'number' ? entry.item.id : undefined,
        itemCode: String(entry.item.code),
        stashTab: entry.stashTab,
        gridX: entry.item.position_x as number,
        gridY: entry.item.position_y as number,
      };

      // Act
      const vaulted = await readSaveFileItem(stashA, 'd2i', locator);
      await removeItemFromSaveFile(stashA, 'd2i', locator);
      const whileVaulted = await parseFile(stashA);
      await addItemToSaveFile({
        filePath: stashA,
        fileType: 'd2i',
        item: vaulted as NonNullable<typeof vaulted>,
        locationContext: 'stash',
        stashTab: 0,
        targetGridX: locator.gridX,
        targetGridY: locator.gridY,
      });
      const afterWriteBack = await parseFile(stashA);

      // Assert
      expect(vaulted?.type).toBe(entry.item.code);
      expect(whileVaulted).toHaveLength(before.length - 1);
      expect(afterWriteBack).toHaveLength(before.length);
    }, 30000);
  });

  describe('If a whole rune stack is vaulted and later withdrawn back into the runes tab', () => {
    it('Then every rune of the stack is back in the stash', async () => {
      // Arrange
      const before = await parseFile(stashA);
      const stack = before.find(
        (entry) => entry.stashTabKind === 'runes' && entry.stackCount > 1,
      ) as ParsedEntry;
      const locator = {
        itemCode: String(stack.item.code),
        stashTab: stack.stashTab,
        gridX: stack.item.position_x as number,
        gridY: stack.item.position_y as number,
      };

      // Act
      const vaulted = await readSaveFileItem(stashA, 'd2i', locator);
      await removeItemFromSaveFile(stashA, 'd2i', locator);
      const whileVaulted = await parseFile(stashA);
      await addItemToSaveFile({
        filePath: stashA,
        fileType: 'd2i',
        item: vaulted as NonNullable<typeof vaulted>,
        locationContext: 'stash',
        stashTab: stack.stashTab,
        targetGridX: 0,
        targetGridY: 0,
        quantity: stack.stackCount,
      });
      const afterWriteBack = await parseFile(stashA);

      // Assert
      expect(totalUnits(whileVaulted)).toBe(totalUnits(before) - stack.stackCount);
      expect(totalUnits(afterWriteBack)).toBe(totalUnits(before));
    }, 30000);
  });

  describe('If a rune stack is withdrawn into a shared tab with more than one unit', () => {
    it('Then it is rejected instead of writing a single rune for the whole stack', async () => {
      // Arrange
      const before = await parseFile(stashA);
      const stack = before.find(
        (entry) => entry.stashTabKind === 'runes' && entry.stackCount > 1,
      ) as ParsedEntry;
      const raw = (await readSaveFileItem(stashA, 'd2i', {
        itemCode: String(stack.item.code),
        stashTab: stack.stashTab,
        gridX: stack.item.position_x as number,
        gridY: stack.item.position_y as number,
      })) as NonNullable<Awaited<ReturnType<typeof readSaveFileItem>>>;
      const cell = findFreeCell(before, 0);
      const originalBytes = readFileSync(stashA);

      // Act
      const act = addItemToSaveFile({
        filePath: stashA,
        fileType: 'd2i',
        item: raw,
        locationContext: 'stash',
        stashTab: 0,
        targetGridX: cell.x,
        targetGridY: cell.y,
        quantity: stack.stackCount,
      });

      // Assert
      await expect(act).rejects.toThrow('STACK_MOVE_REQUIRES_SPLIT');
      expect(readFileSync(stashA).equals(originalBytes)).toBe(true);
    }, 30000);
  });
});

/** Fixed-size header of a v105 character save: everything before the attributes section. */
const ROTW_HEADER_END = 833;
/** Checksum and file size, which every write updates. */
const ROTW_SIZE_AND_CHECKSUM = { start: 8, end: 16 };
const CHAOS_SC_FIXTURE_PATH = resolve(process.cwd(), 'electron/services/fixtures/ChaosSCV105.d2s');
/** The unique Annihilus small charm in ChaosSC's inventory (id unique in the save). */
const ANNIHILUS_ID = 2620541511;
/** The unique Hellfire Torch large charm in ChaosSC's inventory. */
const HELLFIRE_TORCH_ID = 771980075;

async function readCharacter(path: string): Promise<d2sTypes.ID2S> {
  return d2s.read(readFileSync(path));
}

/** Number of items with this id among the character's, corpse and mercenary items. */
function countCharacterItems(save: d2sTypes.ID2S, itemId: number): number {
  return [...save.items, ...(save.corpse_items ?? []), ...(save.merc_items ?? [])].filter(
    (item: d2sTypes.IItem) => item.id === itemId,
  ).length;
}

/** Item codes of a character's own items, sorted, to compare item sets. */
function characterItemCodes(save: d2sTypes.ID2S): string[] {
  return save.items.map((item: d2sTypes.IItem) => item.type).sort();
}

/**
 * Offset of the mercenary section: "jf", then the mercenary item list ("JM") or, without a hired
 * mercenary, the golem section ("kf"). Everything from here to the end of the file (mercenary,
 * golem and the Reign of the Warlock "lf" section) must survive an edit of the character's items.
 */
function mercenarySectionOffset(save: Buffer): number {
  const withItems = save.lastIndexOf(Buffer.from('jfJM', 'latin1'));
  return withItems >= 0 ? withItems : save.lastIndexOf(Buffer.from('jfkf', 'latin1'));
}

/** Asserts a valid file whose header and sections after the character's items are unchanged. */
function expectOnlyCharacterItemsChanged(before: Buffer, after: Buffer): void {
  expect(hasValidSizeAndChecksum(after)).toBe(true);
  expect(
    after
      .subarray(ROTW_SIZE_AND_CHECKSUM.end, ROTW_HEADER_END)
      .equals(before.subarray(ROTW_SIZE_AND_CHECKSUM.end, ROTW_HEADER_END)),
  ).toBe(true);
  expect(
    after
      .subarray(0, ROTW_SIZE_AND_CHECKSUM.start)
      .equals(before.subarray(0, ROTW_SIZE_AND_CHECKSUM.start)),
  ).toBe(true);
  const tail = before.subarray(mercenarySectionOffset(before));
  expect(after.subarray(mercenarySectionOffset(after)).equals(tail)).toBe(true);
}

/** Free top-left cell for an item of this size in the first shared tab of a stash. */
async function findFreeStashCell(stash: string, width = 1, height = 1) {
  return findFreeCell(await parseFile(stash), 0, width, height);
}

/**
 * A copy of a v105 character save that lists two empty corpses. The d2s library reads both but
 * writes only one corpse, so it cannot write this save back unchanged.
 */
function withTwoEmptyCorpses(save: Buffer): Buffer {
  const corpseAndMercenary = Buffer.from('JM\x00\x00jf', 'latin1');
  const offset = save.lastIndexOf(corpseAndMercenary);
  if (offset === -1) {
    throw new Error('The save has no empty corpse list');
  }
  const emptyCorpse = Buffer.concat([Buffer.alloc(12), Buffer.from('JM\x00\x00', 'latin1')]);
  return finalizeSave(
    Buffer.concat([
      save.subarray(0, offset),
      Buffer.from('JM\x02\x00', 'latin1'),
      emptyCorpse,
      emptyCorpse,
      save.subarray(offset + 4),
    ]),
  );
}

/** A vault service on the real save file editor and an in-memory vault table. */
function createVaultService(saveDirectory: string) {
  let rows: VaultItem[] = [];
  const database = {
    addVaultItemWithUndo: (input: Partial<VaultItem>) => {
      const row = { ...input, id: 'vault-row', vaultedAt: new Date() } as VaultItem;
      rows = [row];
      return {
        item: row,
        undo: () => {
          rows = [];
        },
      };
    },
    getVaultItemById: () => rows[0],
    unvaultVaultItem: () => {
      rows = rows.map((row) => ({ ...row, unvaultedAt: new Date(Date.now() + 1000) }));
    },
    removeVaultItem: () => {
      rows = [];
    },
    searchVaultItems: () => ({ items: rows, total: rows.length, page: 1, pageSize: 20 }),
  } as unknown as VaultDatabase;
  const service = new VaultService({
    database,
    saveFileEditor: {
      addItemToSaveFile,
      assertSaveFileAllowsItemRemoval,
      moveItemBetweenSaveFiles,
      readSaveFileItem,
      removeItemFromSaveFile,
      splitStackInSaveFile,
    },
    assertGameNotRunning: async () => undefined,
    getSaveDirectory: () => saveDirectory,
    getInventorySnapshots: () => [],
  });
  return { service, vaultRows: () => rows };
}

/** What the renderer sends to vault an item that was read from a character save. */
function toVaultInput(item: d2sTypes.IItem, sourceFilePath: string) {
  return {
    fingerprint: `fp-${item.id}`,
    itemName: String(item.unique_name),
    itemCode: item.type.trim(),
    quality: 'unique',
    ethereal: false,
    rawItemJson: JSON.stringify(item),
    sourceFileType: 'd2s' as const,
    sourceFilePath,
    locationContext: 'inventory' as const,
  };
}

describe('When the real saveFileEditor edits a Reign of the Warlock character save', () => {
  let directory: string;
  let stash: string;
  let warlock: string;
  let chaos: string;
  let warTravelerId: number;

  beforeEach(async () => {
    ensureD2sConstants();
    directory = mkdtempSync(join(tmpdir(), 'editor-rotw-character-'));
    stash = join(directory, 'Stash.d2i');
    warlock = join(directory, 'Warlock.d2s');
    chaos = join(directory, 'ChaosSC.d2s');
    copyFileSync(FIXTURE_PATH, stash);
    copyFileSync(CHAOS_SC_FIXTURE_PATH, chaos);
    const warTraveler = await readModernStashItem('War Traveler');
    warTravelerId = warTraveler.id as number;
    writeFileSync(warlock, await addItemToRotwCharacterSave(readWarlockSave(), warTraveler, 0, 0));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  /** Moves the War Traveler from the Warlock save into the first shared tab of the stash. */
  async function moveWarTravelerToStash(cell: { x: number; y: number }): Promise<void> {
    await moveItemBetweenSaveFiles({
      sourceFilePath: warlock,
      sourceFileType: 'd2s',
      sourceItemId: warTravelerId,
      targetFilePath: stash,
      targetFileType: 'd2i',
      targetLocationContext: 'stash',
      targetStashTab: 0,
      targetGridX: cell.x,
      targetGridY: cell.y,
    });
  }

  /** Moves Annihilus from ChaosSC's inventory into the first shared tab of the stash. */
  async function moveAnnihilusToStash(cell: { x: number; y: number }): Promise<void> {
    await moveItemBetweenSaveFiles({
      sourceFilePath: chaos,
      sourceFileType: 'd2s',
      sourceItemId: ANNIHILUS_ID,
      targetFilePath: stash,
      targetFileType: 'd2i',
      targetLocationContext: 'stash',
      targetStashTab: 0,
      targetGridX: cell.x,
      targetGridY: cell.y,
    });
  }

  describe('If an item is moved from the Warlock to a stash', () => {
    it('Then the item leaves the Warlock save, arrives in the stash and the rest of the save is unchanged', async () => {
      // Arrange
      const warlockBefore = readFileSync(warlock);
      const stashCopiesBefore = (await parseFile(stash)).filter(
        (entry) => entry.item.id === warTravelerId,
      ).length;
      const cell = await findFreeStashCell(stash, 2, 2);

      // Act
      await moveWarTravelerToStash(cell);

      // Assert
      const warlockAfter = readFileSync(warlock);
      expect(countCharacterItems(await d2s.read(warlockAfter), warTravelerId)).toBe(0);
      expectOnlyCharacterItemsChanged(warlockBefore, warlockAfter);
      const stashEntries = await parseFile(stash);
      expect(stashEntries.filter((entry) => entry.item.id === warTravelerId)).toHaveLength(
        stashCopiesBefore + 1,
      );
    }, 30000);
  });

  describe('If an item is moved from a stash into the Warlock save', () => {
    it('Then the item is in the Warlock save once, gone from the stash and the rest of the save is unchanged', async () => {
      // Arrange
      const warlockBefore = readFileSync(warlock);
      const itemCodesBefore = characterItemCodes(await readCharacter(warlock));
      const stashCopiesBefore = (await parseFile(stash)).filter(
        (entry) => entry.item.id === warTravelerId,
      ).length;
      const cell = await findFreeStashCell(stash, 2, 2);
      await moveWarTravelerToStash(cell);
      const movedEntry = (await parseFile(stash)).find(
        (entry) =>
          entry.item.unique_name === 'War Traveler' &&
          entry.stashTab === 0 &&
          entry.item.position_x === cell.x &&
          entry.item.position_y === cell.y,
      ) as ParsedEntry;

      // Act
      await moveItemBetweenSaveFiles({
        sourceFilePath: stash,
        sourceFileType: 'd2i',
        ...toLocator(movedEntry),
        targetFilePath: warlock,
        targetFileType: 'd2s',
        targetLocationContext: 'inventory',
        targetGridX: 0,
        targetGridY: 0,
      });

      // Assert
      const warlockAfter = readFileSync(warlock);
      const warlockSave = await d2s.read(warlockAfter);
      expect(countCharacterItems(warlockSave, warTravelerId)).toBe(1);
      expect(characterItemCodes(warlockSave)).toEqual(itemCodesBefore);
      expectOnlyCharacterItemsChanged(warlockBefore, warlockAfter);
      const stashEntries = await parseFile(stash);
      expect(stashEntries.filter((entry) => entry.item.id === warTravelerId)).toHaveLength(
        stashCopiesBefore,
      );
    }, 30000);
  });

  describe('If an item of a high level Warlock with a hired mercenary is moved to a stash', () => {
    it('Then the mercenary, its items and the Reign of the Warlock section are kept byte for byte', async () => {
      // Arrange
      const chaosBefore = readFileSync(chaos);
      const cell = await findFreeStashCell(stash);

      // Act
      await moveAnnihilusToStash(cell);

      // Assert
      const chaosAfter = readFileSync(chaos);
      expect(countCharacterItems(await d2s.read(chaosAfter), ANNIHILUS_ID)).toBe(0);
      expectOnlyCharacterItemsChanged(chaosBefore, chaosAfter);
      expect(
        (await parseFile(stash)).filter((entry) => entry.item.id === ANNIHILUS_ID),
      ).toHaveLength(1);
    }, 30000);
  });

  describe('If an item of a high level Warlock with a hired mercenary is moved back from a stash', () => {
    it('Then the item is in the save once and the mercenary, its items and the Reign of the Warlock section are kept byte for byte', async () => {
      // Arrange
      const chaosBefore = readFileSync(chaos);
      const saveBefore = await d2s.read(chaosBefore);
      const cell = await findFreeStashCell(stash);
      await moveAnnihilusToStash(cell);
      const movedEntry = (await parseFile(stash)).find(
        (entry) => entry.item.id === ANNIHILUS_ID,
      ) as ParsedEntry;

      // Act
      await moveItemBetweenSaveFiles({
        sourceFilePath: stash,
        sourceFileType: 'd2i',
        ...toLocator(movedEntry),
        targetFilePath: chaos,
        targetFileType: 'd2s',
        targetLocationContext: 'inventory',
        targetGridX: 9,
        targetGridY: 0,
      });

      // Assert
      const chaosAfter = readFileSync(chaos);
      const saveAfter = await d2s.read(chaosAfter);
      expect(countCharacterItems(saveAfter, ANNIHILUS_ID)).toBe(1);
      expect(characterItemCodes(saveAfter)).toEqual(characterItemCodes(saveBefore));
      expect(saveAfter.merc_items.map((item: d2sTypes.IItem) => item.runeword_name)).toEqual(
        saveBefore.merc_items.map((item: d2sTypes.IItem) => item.runeword_name),
      );
      expectOnlyCharacterItemsChanged(chaosBefore, chaosAfter);
      expect((await parseFile(stash)).filter((entry) => entry.item.id === ANNIHILUS_ID)).toEqual(
        [],
      );
    }, 30000);
  });

  describe('If an item is moved within the Warlock save, from the inventory to the personal stash', () => {
    it('Then the item is in its new place once and the rest of the save is unchanged', async () => {
      // Arrange
      const chaosBefore = readFileSync(chaos);

      // Act
      await moveItemBetweenSaveFiles({
        sourceFilePath: chaos,
        sourceFileType: 'd2s',
        sourceItemId: ANNIHILUS_ID,
        targetFilePath: chaos,
        targetFileType: 'd2s',
        targetLocationContext: 'stash',
        targetGridX: 0,
        targetGridY: 0,
      });

      // Assert
      const chaosAfter = readFileSync(chaos);
      const moved = (await d2s.read(chaosAfter)).items.filter(
        (item: d2sTypes.IItem) => item.id === ANNIHILUS_ID,
      );
      expect(moved).toHaveLength(1);
      expect(moved[0]).toMatchObject({ alt_position_id: 5, position_x: 0, position_y: 0 });
      expectOnlyCharacterItemsChanged(chaosBefore, chaosAfter);
    }, 30000);
  });

  describe('If an item of the Warlock is vaulted', () => {
    it('Then the vault keeps the item, it is removed from the save once and the rest of the save is unchanged', async () => {
      // Arrange
      const chaosBefore = readFileSync(chaos);
      const { service, vaultRows } = createVaultService(directory);
      const torch = (await readSaveFileItem(chaos, 'd2s', HELLFIRE_TORCH_ID)) as d2sTypes.IItem;

      // Act
      await service.addItem(toVaultInput(torch, chaos));

      // Assert
      const chaosAfter = readFileSync(chaos);
      expect(countCharacterItems(await d2s.read(chaosAfter), HELLFIRE_TORCH_ID)).toBe(0);
      expectOnlyCharacterItemsChanged(chaosBefore, chaosAfter);
      expect(vaultRows()).toHaveLength(1);
      expect(JSON.parse(vaultRows()[0]?.rawItemJson ?? '{}')).toMatchObject({
        id: HELLFIRE_TORCH_ID,
        unique_name: 'Hellfire Torch',
      });
    }, 30000);
  });

  describe('If a vaulted item of the Warlock is unvaulted into the save', () => {
    it('Then it is back in the save once and the rest of the save is unchanged', async () => {
      // Arrange
      const chaosBefore = readFileSync(chaos);
      const { service, vaultRows } = createVaultService(directory);
      const torch = (await readSaveFileItem(chaos, 'd2s', HELLFIRE_TORCH_ID)) as d2sTypes.IItem;
      await service.addItem(toVaultInput(torch, chaos));
      const vaultRowId = vaultRows()[0]?.id as string;

      // Act
      await service.unvaultItem(vaultRowId, {
        targetFilePath: chaos,
        targetFileType: 'd2s',
        targetLocationContext: 'inventory',
        targetGridX: 9,
        targetGridY: 1,
      });

      // Assert
      const chaosAfter = readFileSync(chaos);
      const restored = (await d2s.read(chaosAfter)).items.filter(
        (item: d2sTypes.IItem) => item.id === HELLFIRE_TORCH_ID,
      );
      expect(restored).toHaveLength(1);
      expect(restored[0]).toMatchObject({ unique_name: 'Hellfire Torch', position_x: 9 });
      expectOnlyCharacterItemsChanged(chaosBefore, chaosAfter);
    }, 30000);
  });

  describe('If a rune stack is split into a free shared cell and into the Warlock', () => {
    it('Then each target gets one rune, the stack shrinks by two and the Warlock save stays valid', async () => {
      // Arrange
      const entries = await parseFile(stash);
      const stack = entries.find(
        (entry) => entry.stashTabKind === 'runes' && entry.stackCount > 2,
      ) as ParsedEntry;
      const cell = findFreeCell(entries, 0);
      const warlockBefore = readFileSync(warlock);
      const runeCode = String(stack.item.code);

      // Act
      await splitStackInSaveFile({
        sourceFilePath: stash,
        sourceFileType: 'd2i',
        sourceStashTab: stack.stashTab,
        sourceItemCode: runeCode,
        sourceRawItemJson: JSON.stringify(stack.item),
        splitCount: 2,
        targets: [
          {
            targetFilePath: stash,
            targetFileType: 'd2i',
            targetLocationContext: 'stash',
            targetStashTab: 0,
            targetGridX: cell.x,
            targetGridY: cell.y,
          },
          {
            targetFilePath: warlock,
            targetFileType: 'd2s',
            targetLocationContext: 'inventory',
            targetGridX: 5,
            targetGridY: 0,
          },
        ],
      });

      // Assert
      const after = await parseFile(stash);
      const afterStack = after.find(
        (entry) => entry.stashTabKind === 'runes' && entry.item.code === stack.item.code,
      ) as ParsedEntry;
      expect(afterStack.stackCount).toBe(stack.stackCount - 2);
      expect(
        after.filter((entry) => entry.stashTab === 0 && entry.item.code === stack.item.code),
      ).toHaveLength(1);
      const warlockAfter = readFileSync(warlock);
      const runes = (await d2s.read(warlockAfter)).items.filter(
        (item: d2sTypes.IItem) => item.type.trim() === runeCode.trim(),
      );
      expect(runes).toHaveLength(1);
      expect(runes[0]).toMatchObject({ position_x: 5, position_y: 0, alt_position_id: 1 });
      expectOnlyCharacterItemsChanged(warlockBefore, warlockAfter);
    }, 30000);
  });

  describe('If a potion is split off within the Warlock save', () => {
    it('Then it lands in the target cell, no potion is lost and the rest of the save is unchanged', async () => {
      // Arrange
      const warlockBefore = readFileSync(warlock);
      const isPotion = (item: d2sTypes.IItem) => item.type.trim() === 'hp1';
      const potionsBefore = (await d2s.read(warlockBefore)).items.filter(isPotion).length;

      // Act
      await splitStackInSaveFile({
        sourceFilePath: warlock,
        sourceFileType: 'd2s',
        sourceStashTab: 0,
        sourceItemCode: 'hp1',
        splitCount: 1,
        targets: [
          {
            targetFilePath: warlock,
            targetFileType: 'd2s',
            targetLocationContext: 'inventory',
            targetGridX: 5,
            targetGridY: 0,
          },
        ],
      });

      // Assert
      const warlockAfter = readFileSync(warlock);
      const potionsAfter = (await d2s.read(warlockAfter)).items.filter(isPotion);
      expect(potionsAfter).toHaveLength(potionsBefore);
      expect(
        potionsAfter.filter(
          (item: d2sTypes.IItem) => item.position_x === 5 && item.alt_position_id === 1,
        ),
      ).toHaveLength(1);
      expectOnlyCharacterItemsChanged(warlockBefore, warlockAfter);
    }, 30000);
  });

  describe('If a Warlock save holds data the d2s library cannot write back unchanged', () => {
    let unsupported: string;
    let backups: string;

    /** Bytes and modification time of files, to prove that a refused edit touched none of them. */
    function fileStates(...paths: string[]) {
      return paths.map((path) => ({ bytes: readFileSync(path), mtimeMs: statSync(path).mtimeMs }));
    }

    /** Id of an item in the unsupported save (potions and other simple items have none). */
    async function unsupportedItemId(): Promise<number> {
      const items = (await readCharacter(unsupported)).items;
      return items.find((item: d2sTypes.IItem) => typeof item.id === 'number')?.id as number;
    }

    beforeEach(() => {
      unsupported = join(directory, 'TwoCorpses.d2s');
      backups = join(directory, 'backups');
      writeFileSync(unsupported, withTwoEmptyCorpses(readWarlockSave()));
      configureSaveFileBackups(backups);
    });

    afterEach(() => {
      configureSaveFileBackups(undefined);
    });

    it('Then an item move into it is refused and neither file changes', async () => {
      // Arrange
      const source = (await parseFile(stash)).find(
        (entry) => entry.stashTab === 0 && entry.item.inv_width === 1,
      ) as ParsedEntry;
      const before = fileStates(unsupported, stash);

      // Act
      const act = moveItemBetweenSaveFiles({
        sourceFilePath: stash,
        sourceFileType: 'd2i',
        ...toLocator(source),
        targetFilePath: unsupported,
        targetFileType: 'd2s',
        targetLocationContext: 'inventory',
        targetGridX: 5,
        targetGridY: 0,
      });

      // Assert
      await expect(act).rejects.toThrow('CHARACTER_SAVE_READ_ONLY');
      expect(fileStates(unsupported, stash)).toEqual(before);
      expect(existsSync(backups)).toBe(false);
    }, 30000);

    it('Then an item move out of it is refused and neither file changes', async () => {
      // Arrange
      const itemId = await unsupportedItemId();
      const cell = await findFreeStashCell(stash);
      const before = fileStates(unsupported, stash);

      // Act
      const act = moveItemBetweenSaveFiles({
        sourceFilePath: unsupported,
        sourceFileType: 'd2s',
        sourceItemId: itemId,
        targetFilePath: stash,
        targetFileType: 'd2i',
        targetLocationContext: 'stash',
        targetStashTab: 0,
        targetGridX: cell.x,
        targetGridY: cell.y,
      });

      // Assert
      await expect(act).rejects.toThrow('CHARACTER_SAVE_READ_ONLY');
      expect(fileStates(unsupported, stash)).toEqual(before);
      expect(existsSync(backups)).toBe(false);
    }, 30000);

    it('Then an item move within it is refused and the file does not change', async () => {
      // Arrange
      const itemId = await unsupportedItemId();
      const before = fileStates(unsupported);

      // Act
      const act = moveItemBetweenSaveFiles({
        sourceFilePath: unsupported,
        sourceFileType: 'd2s',
        sourceItemId: itemId,
        targetFilePath: unsupported,
        targetFileType: 'd2s',
        targetLocationContext: 'stash',
        targetGridX: 0,
        targetGridY: 0,
      });

      // Assert
      await expect(act).rejects.toThrow('CHARACTER_SAVE_READ_ONLY');
      expect(fileStates(unsupported)).toEqual(before);
      expect(existsSync(backups)).toBe(false);
    }, 30000);

    it('Then adding an item to it is refused and the file does not change', async () => {
      // Arrange
      const entry = (await parseFile(stash)).find(
        (candidate) => candidate.stashTab === 0 && candidate.item.inv_width === 1,
      ) as ParsedEntry;
      const before = fileStates(unsupported);

      // Act
      const act = addItemToSaveFile({
        filePath: unsupported,
        fileType: 'd2s',
        item: entry.item as unknown as d2sTypes.IItem,
        locationContext: 'inventory',
        targetGridX: 5,
        targetGridY: 0,
      });

      // Assert
      await expect(act).rejects.toThrow('CHARACTER_SAVE_READ_ONLY');
      expect(fileStates(unsupported)).toEqual(before);
      expect(existsSync(backups)).toBe(false);
    }, 30000);

    it('Then removing an item from it is refused and the file does not change', async () => {
      // Arrange
      const itemId = await unsupportedItemId();
      const before = fileStates(unsupported);

      // Act
      const act = removeItemFromSaveFile(unsupported, 'd2s', itemId);

      // Assert
      await expect(act).rejects.toThrow('CHARACTER_SAVE_READ_ONLY');
      expect(fileStates(unsupported)).toEqual(before);
      expect(existsSync(backups)).toBe(false);
    }, 30000);

    it('Then splitting a stack out of it is refused and neither file changes', async () => {
      // Arrange
      const cell = await findFreeStashCell(stash);
      const before = fileStates(unsupported, stash);

      // Act
      const act = splitStackInSaveFile({
        sourceFilePath: unsupported,
        sourceFileType: 'd2s',
        sourceStashTab: 0,
        sourceItemCode: 'hp1',
        splitCount: 1,
        targets: [
          {
            targetFilePath: stash,
            targetFileType: 'd2i',
            targetLocationContext: 'stash',
            targetStashTab: 0,
            targetGridX: cell.x,
            targetGridY: cell.y,
          },
        ],
      });

      // Assert
      await expect(act).rejects.toThrow('CHARACTER_SAVE_READ_ONLY');
      expect(fileStates(unsupported, stash)).toEqual(before);
      expect(existsSync(backups)).toBe(false);
    }, 30000);

    it('Then splitting a stack into it is refused and neither file changes', async () => {
      // Arrange
      const before = fileStates(unsupported, warlock);

      // Act
      const act = splitStackInSaveFile({
        sourceFilePath: warlock,
        sourceFileType: 'd2s',
        sourceStashTab: 0,
        sourceItemCode: 'hp1',
        splitCount: 1,
        targets: [
          {
            targetFilePath: unsupported,
            targetFileType: 'd2s',
            targetLocationContext: 'inventory',
            targetGridX: 5,
            targetGridY: 0,
          },
        ],
      });

      // Assert
      await expect(act).rejects.toThrow('CHARACTER_SAVE_READ_ONLY');
      expect(fileStates(unsupported, warlock)).toEqual(before);
      expect(existsSync(backups)).toBe(false);
    }, 30000);

    it('Then the up-front check for removing an item refuses it and the file does not change', async () => {
      // Arrange
      const before = fileStates(unsupported);

      // Act
      const act = assertSaveFileAllowsItemRemoval(unsupported, 'd2s');

      // Assert
      await expect(act).rejects.toThrow('CHARACTER_SAVE_READ_ONLY');
      expect(fileStates(unsupported)).toEqual(before);
    }, 30000);

    it('Then the up-front check for removing an item accepts the regular Warlock save', async () => {
      // Arrange
      const before = fileStates(warlock);

      // Act
      const act = assertSaveFileAllowsItemRemoval(warlock, 'd2s');

      // Assert
      await expect(act).resolves.toBeUndefined();
      expect(fileStates(warlock)).toEqual(before);
    }, 30000);

    it('Then splitting a rune stack of a modern stash into it is refused before any copy is written', async () => {
      // Arrange
      const entries = await parseFile(stash);
      const stack = entries.find(
        (entry) => entry.stashTabKind === 'runes' && entry.stackCount > 2,
      ) as ParsedEntry;
      const cell = findFreeCell(entries, 0);
      const before = fileStates(unsupported, stash);

      // Act
      const act = splitStackInSaveFile({
        sourceFilePath: stash,
        sourceFileType: 'd2i',
        sourceStashTab: stack.stashTab,
        sourceItemCode: String(stack.item.code),
        sourceRawItemJson: JSON.stringify(stack.item),
        splitCount: 2,
        targets: [
          {
            targetFilePath: stash,
            targetFileType: 'd2i',
            targetLocationContext: 'stash',
            targetStashTab: 0,
            targetGridX: cell.x,
            targetGridY: cell.y,
          },
          {
            targetFilePath: unsupported,
            targetFileType: 'd2s',
            targetLocationContext: 'inventory',
            targetGridX: 5,
            targetGridY: 0,
          },
        ],
      });

      // Assert
      await expect(act).rejects.toThrow('CHARACTER_SAVE_READ_ONLY');
      expect(fileStates(unsupported, stash)).toEqual(before);
      expect(existsSync(backups)).toBe(false);
    }, 30000);
  });
});
