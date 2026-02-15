import { describe, expect, it } from 'vitest';
import {
  buildEquippedSlotMapForSet,
  buildOverflowBoardLayout,
  classifyBoardItems,
  DEFAULT_INVENTORY_GRID_SIZE,
  DEFAULT_STASH_GRID_SIZE,
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
});
