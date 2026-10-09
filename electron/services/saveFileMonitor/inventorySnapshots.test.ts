import { describe, expect, it } from 'vitest';
import type { CharacterInventorySnapshot, ParsedInventoryItem } from '../../types/grail';
import { countAvailableRunes, mergeInventorySnapshots } from './inventorySnapshots';

function createSnapshot(
  snapshotId: string,
  sourceFilePath: string,
  items: Partial<ParsedInventoryItem>[] = [],
): CharacterInventorySnapshot {
  return {
    snapshotId,
    characterName: snapshotId,
    sourceFileType: 'd2s',
    sourceFilePath,
    readOnly: false,
    capturedAt: new Date('2024-01-01T00:00:00.000Z'),
    items: items as ParsedInventoryItem[],
  };
}

function rune(type: string, stackCount?: number): Partial<ParsedInventoryItem> {
  return {
    rawParsedItem: { type } as ParsedInventoryItem['rawParsedItem'],
    isSocketedItem: false,
    stackCount,
  };
}

describe('When inventory snapshots of a scan are merged', () => {
  describe('If only one of two files was parsed again', () => {
    it('Then the parsed file gets its new snapshot and the other file keeps its old one', () => {
      // Arrange
      const oldA = createSnapshot('a-old', '/saves/a.d2s');
      const oldB = createSnapshot('b-old', '/saves/b.d2s');
      const newA = createSnapshot('a-new', '/saves/a.d2s');

      // Act
      const merged = mergeInventorySnapshots(
        [oldA, oldB],
        ['/saves/a.d2s', '/saves/b.d2s'],
        ['/saves/a.d2s'],
        [newA],
      );

      // Assert
      expect(merged.map((snapshot) => snapshot.snapshotId)).toEqual(['b-old', 'a-new']);
    });
  });

  describe('If a parsed file failed and produced no snapshot', () => {
    it('Then its previous snapshot is kept', () => {
      // Arrange
      const oldA = createSnapshot('a-old', '/saves/a.d2s');

      // Act
      const merged = mergeInventorySnapshots([oldA], ['/saves/a.d2s'], ['/saves/a.d2s'], []);

      // Assert
      expect(merged).toEqual([oldA]);
    });
  });

  describe('If a file is no longer part of the scan', () => {
    it('Then its snapshot is dropped', () => {
      // Arrange
      const oldA = createSnapshot('a-old', '/saves/a.d2s');
      const oldB = createSnapshot('b-old', '/saves/b.d2s');

      // Act
      const merged = mergeInventorySnapshots([oldA, oldB], ['/saves/a.d2s'], [], []);

      // Assert
      expect(merged).toEqual([oldA]);
    });
  });
});

describe('When available runes are counted', () => {
  describe('If runes are stacked, loose or socketed', () => {
    it('Then stacks count with their size and socketed runes are not counted', () => {
      // Arrange
      const socketedRune = { ...rune('r02'), isSocketedItem: true };
      const runeInSocketedParent = rune('r03');
      runeInSocketedParent.rawParsedItem = {
        type: 'r03',
        socketed: 1,
      } as ParsedInventoryItem['rawParsedItem'];
      const snapshots = [
        createSnapshot('a', '/saves/a.d2s', [rune('r01', 3), rune('r01', 2), socketedRune]),
        createSnapshot('b', '/saves/b.d2s', [rune('r01'), runeInSocketedParent]),
      ];

      // Act
      const counts = countAvailableRunes(snapshots);

      // Assert
      expect(counts).toEqual({ el: 6 });
    });
  });

  describe('If the snapshots hold no runes', () => {
    it('Then no rune is counted', () => {
      // Arrange
      const snapshots = [createSnapshot('a', '/saves/a.d2s', [rune('uap')])];

      // Act
      const counts = countAvailableRunes(snapshots);

      // Assert
      expect(counts).toEqual({});
    });
  });
});
