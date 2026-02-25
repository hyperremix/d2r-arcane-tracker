import { describe, expect, it } from 'vitest';
import {
  buildEquippedSlotMapForSet,
  buildOverflowBoardLayout,
  classifyBoardItems,
  DEFAULT_INVENTORY_GRID_SIZE,
  DEFAULT_STASH_GRID_SIZE,
  EQUIPPED_BOARD_SIZE,
  EQUIPPED_SLOT_LAYOUT,
  type SpatialItemLike,
} from './spatialLayout';

type TestItem = SpatialItemLike & {
  id: string;
  equippedSlotId?: number;
};

describe('When spatial layout classifiers are used', () => {
  describe('If board items are checked against canonical inventory bounds', () => {
    it('Then out-of-bounds and incomplete items are routed to unplaced reasons', () => {
      // Arrange
      const items: TestItem[] = [
        {
          id: 'placed',
          locationContext: 'inventory',
          gridX: 0,
          gridY: 0,
          gridWidth: 2,
          gridHeight: 2,
        },
        {
          id: 'missing-position',
          locationContext: 'inventory',
          gridWidth: 1,
          gridHeight: 1,
        },
        {
          id: 'missing-dimensions',
          locationContext: 'inventory',
          gridX: 1,
          gridY: 1,
        },
        {
          id: 'out-of-bounds',
          locationContext: 'inventory',
          gridX: 9,
          gridY: 3,
          gridWidth: 2,
          gridHeight: 1,
        },
      ];

      // Act
      const classification = classifyBoardItems(items, DEFAULT_INVENTORY_GRID_SIZE);

      // Assert
      expect(classification.placed.map((item) => item.id)).toEqual(['placed']);
      expect(
        classification.unplaced
          .map(({ item, reason }) => ({
            id: item.id,
            reason,
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      ).toEqual([
        { id: 'missing-dimensions', reason: 'missingDimensions' },
        { id: 'missing-position', reason: 'missingPosition' },
        { id: 'out-of-bounds', reason: 'outOfBounds' },
      ]);
    });

    it('Then an item at x9,y3 with 1x1 dimensions remains within canonical inventory bounds', () => {
      // Arrange
      const edgeItem: TestItem = {
        id: 'edge-item',
        locationContext: 'inventory',
        gridX: 9,
        gridY: 3,
        gridWidth: 1,
        gridHeight: 1,
      };

      // Act
      const classification = classifyBoardItems([edgeItem], DEFAULT_INVENTORY_GRID_SIZE);

      // Assert
      expect(classification.placed.map((item) => item.id)).toEqual(['edge-item']);
      expect(classification.unplaced).toHaveLength(0);
    });

    it('Then items starting at x10 or y4 are routed to outOfBounds', () => {
      // Arrange
      const xOverflow: TestItem = {
        id: 'x-overflow',
        locationContext: 'inventory',
        gridX: 10,
        gridY: 0,
        gridWidth: 1,
        gridHeight: 1,
      };
      const yOverflow: TestItem = {
        id: 'y-overflow',
        locationContext: 'inventory',
        gridX: 0,
        gridY: 4,
        gridWidth: 1,
        gridHeight: 1,
      };

      // Act
      const classification = classifyBoardItems(
        [xOverflow, yOverflow],
        DEFAULT_INVENTORY_GRID_SIZE,
      );

      // Assert
      expect(classification.placed).toHaveLength(0);
      expect(
        classification.unplaced.map(({ item, reason }) => ({
          id: item.id,
          reason,
        })),
      ).toEqual([
        { id: 'x-overflow', reason: 'outOfBounds' },
        { id: 'y-overflow', reason: 'outOfBounds' },
      ]);
    });
  });

  describe('If overflow layout is built from unplaced items', () => {
    it('Then it rebases out-of-bounds items to a compact overflow grid', () => {
      // Arrange
      const classified = classifyBoardItems(
        [
          {
            id: 'overflow-a',
            locationContext: 'inventory',
            gridX: 12,
            gridY: 1,
            gridWidth: 2,
            gridHeight: 2,
          },
          {
            id: 'overflow-b',
            locationContext: 'inventory',
            gridX: 14,
            gridY: 2,
            gridWidth: 1,
            gridHeight: 1,
          },
          {
            id: 'missing-position',
            locationContext: 'inventory',
            gridWidth: 1,
            gridHeight: 1,
          },
        ],
        DEFAULT_INVENTORY_GRID_SIZE,
      );

      // Act
      const overflow = buildOverflowBoardLayout(classified.unplaced, (item) => item.id);

      // Assert
      expect(overflow.items.map((item) => item.id)).toEqual(['overflow-a', 'overflow-b']);
      expect([...overflow.itemKeys]).toEqual(['overflow-a', 'overflow-b']);
      expect(overflow.origin).toEqual({ x: 12, y: 1 });
      expect(overflow.gridSize).toEqual({ columns: 3, rows: 2 });
    });
  });

  describe('If stash placement is classified with strict 10x10 bounds', () => {
    it('Then valid stash footprints remain placed without expanding the board', () => {
      // Arrange
      const stashItem: TestItem = {
        id: 'stash-placed',
        locationContext: 'stash',
        stashTab: 0,
        gridX: 8,
        gridY: 8,
        gridWidth: 2,
        gridHeight: 2,
      };

      // Act
      const classification = classifyBoardItems([stashItem], DEFAULT_STASH_GRID_SIZE);

      // Assert
      expect(classification.placed).toHaveLength(1);
      expect(classification.unplaced).toHaveLength(0);
    });
  });

  describe('If two items overlap on the same board cells', () => {
    it('Then the later colliding item is routed to unplaced with overlap reason', () => {
      // Arrange
      const items: TestItem[] = [
        {
          id: 'first',
          locationContext: 'inventory',
          gridX: 0,
          gridY: 0,
          gridWidth: 2,
          gridHeight: 2,
        },
        {
          id: 'second',
          locationContext: 'inventory',
          gridX: 1,
          gridY: 1,
          gridWidth: 2,
          gridHeight: 2,
        },
      ];

      // Act
      const classification = classifyBoardItems(items, DEFAULT_INVENTORY_GRID_SIZE);

      // Assert
      expect(classification.placed.map((item) => item.id)).toEqual(['first']);
      expect(
        classification.unplaced.map(({ item, reason }) => ({
          id: item.id,
          reason,
        })),
      ).toEqual([{ id: 'second', reason: 'overlap' }]);
    });
  });

  describe('If equipped items are mapped for weapon set II', () => {
    it('Then slot IDs 11/12 take precedence over alias 13/14', () => {
      // Arrange
      const items: TestItem[] = [
        {
          id: 'primary-right',
          locationContext: 'equipped',
          equippedSlotId: 11,
        },
        {
          id: 'primary-left',
          locationContext: 'equipped',
          equippedSlotId: 12,
        },
        {
          id: 'alias-right',
          locationContext: 'equipped',
          equippedSlotId: 13,
        },
        {
          id: 'alias-left',
          locationContext: 'equipped',
          equippedSlotId: 14,
        },
      ];

      // Act
      const mapped = buildEquippedSlotMapForSet(items, 'ii');

      // Assert
      expect(mapped.slotItems.get('rightHand')?.id).toBe('primary-right');
      expect(mapped.slotItems.get('leftHand')?.id).toBe('primary-left');
      expect(mapped.unplaced.map((item) => item.id)).toEqual(['alias-right', 'alias-left']);
    });
  });

  describe('If equipped slot layout is compacted to remove empty lanes', () => {
    it('Then weapon slots are vertically aligned with gloves and boots', () => {
      // Arrange
      const leftHand = EQUIPPED_SLOT_LAYOUT.leftHand;
      const rightHand = EQUIPPED_SLOT_LAYOUT.rightHand;
      const gloves = EQUIPPED_SLOT_LAYOUT.gloves;
      const boots = EQUIPPED_SLOT_LAYOUT.boots;

      // Act
      const leftWeaponAlignedWithGloves =
        leftHand.column === gloves.column && leftHand.width === gloves.width;
      const rightWeaponAlignedWithBoots =
        rightHand.column === boots.column && rightHand.width === boots.width;

      // Assert
      expect(leftWeaponAlignedWithGloves).toBe(true);
      expect(rightWeaponAlignedWithBoots).toBe(true);
    });

    it('Then every equipped slot footprint remains within equipped board bounds', () => {
      // Arrange
      const layouts = Object.values(EQUIPPED_SLOT_LAYOUT);

      // Act
      const allWithinBounds = layouts.every((layout) => {
        const rightEdge = layout.column + layout.width - 1;
        const bottomEdge = layout.row + layout.height - 1;

        return (
          layout.column >= 1 &&
          layout.row >= 1 &&
          rightEdge <= EQUIPPED_BOARD_SIZE.columns &&
          bottomEdge <= EQUIPPED_BOARD_SIZE.rows
        );
      });

      // Assert
      expect(allWithinBounds).toBe(true);
    });

    it('Then every equipped board column has at least one slot cell', () => {
      // Arrange
      const occupiedColumns = new Set<number>();

      // Act
      for (const layout of Object.values(EQUIPPED_SLOT_LAYOUT)) {
        for (let column = layout.column; column < layout.column + layout.width; column += 1) {
          occupiedColumns.add(column);
        }
      }

      const hasNoEmptyColumns = Array.from(
        { length: EQUIPPED_BOARD_SIZE.columns },
        (_, index) => index + 1,
      ).every((column) => occupiedColumns.has(column));

      // Assert
      expect(hasNoEmptyColumns).toBe(true);
    });

    it('Then every equipped board row has at least one slot cell', () => {
      // Arrange
      const occupiedRows = new Set<number>();

      // Act
      for (const layout of Object.values(EQUIPPED_SLOT_LAYOUT)) {
        for (let row = layout.row; row < layout.row + layout.height; row += 1) {
          occupiedRows.add(row);
        }
      }

      const hasNoEmptyRows = Array.from(
        { length: EQUIPPED_BOARD_SIZE.rows },
        (_, index) => index + 1,
      ).every((row) => occupiedRows.has(row));

      // Assert
      expect(hasNoEmptyRows).toBe(true);
    });
  });
});
