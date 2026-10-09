import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseModernStash } from '../modernStashParser';
import {
  addItemToSaveFile,
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
      await addItemToSaveFile(
        stashA,
        'd2i',
        vaulted as NonNullable<typeof vaulted>,
        'stash',
        0,
        locator.gridX,
        locator.gridY,
      );
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
      await addItemToSaveFile(
        stashA,
        'd2i',
        vaulted as NonNullable<typeof vaulted>,
        'stash',
        stack.stashTab,
        0,
        0,
        undefined,
        stack.stackCount,
      );
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
      const act = addItemToSaveFile(
        stashA,
        'd2i',
        raw,
        'stash',
        0,
        cell.x,
        cell.y,
        undefined,
        stack.stackCount,
      );

      // Assert
      await expect(act).rejects.toThrow('STACK_MOVE_REQUIRES_SPLIT');
      expect(readFileSync(stashA).equals(originalBytes)).toBe(true);
    }, 30000);
  });
});
