import type { types as d2sTypes } from '@dschu012/d2s';
import { describe, expect, it } from 'vitest';
import {
  assertCharacterGridCellsFree,
  assertTargetCellsFree,
  withD2SLocationContext,
  withTargetCoordinates,
} from './itemPlacement';

function item(fields: Record<string, unknown>): d2sTypes.IItem {
  return fields as unknown as d2sTypes.IItem;
}

describe('When an item is placed on a grid cell', () => {
  describe('If the item would overlap an item that is already there', () => {
    it('Then the placement is refused, using the item sizes when they are known', () => {
      // Arrange
      const armor = item({ position_x: 0, position_y: 0, inv_width: 2, inv_height: 3 });
      const overlapping = item({ position_x: 1, position_y: 2 });
      const besideIt = item({ position_x: 2, position_y: 0, inv_width: 1, inv_height: 1 });

      // Act
      const placeOverlapping = () => assertTargetCellsFree([armor], overlapping);
      const placeBeside = () => assertTargetCellsFree([armor], besideIt);

      // Assert
      expect(placeOverlapping).toThrow('TARGET_CELL_OCCUPIED');
      expect(placeBeside).not.toThrow();
    });
  });

  describe('If the item is placed in a character save', () => {
    it('Then only items of the same grid (inventory, stash or cube) are obstacles', () => {
      // Arrange
      const inStash = item({ location_id: 0, alt_position_id: 5, position_x: 0, position_y: 0 });
      const intoInventory = item({
        location_id: 0,
        alt_position_id: 1,
        position_x: 0,
        position_y: 0,
      });
      const intoStash = item({ location_id: 0, alt_position_id: 5, position_x: 0, position_y: 0 });
      const equipped = item({ location_id: 1, position_x: 0, position_y: 0 });

      // Act
      const placeIntoInventory = () => assertCharacterGridCellsFree([inStash], intoInventory);
      const placeIntoStash = () => assertCharacterGridCellsFree([inStash], intoStash);
      const placeEquipped = () => assertCharacterGridCellsFree([inStash], equipped);

      // Assert
      expect(placeIntoInventory).not.toThrow();
      expect(placeIntoStash).toThrow('TARGET_CELL_OCCUPIED');
      expect(placeEquipped).not.toThrow();
    });
  });
});

describe('When an item gets a new location in a character save', () => {
  it('Then the location fields of the target container are set', () => {
    // Arrange
    const source = item({ code: 'rin', location_id: 1, equipped_id: 6, position_x: 0 });

    // Act
    const inventory = withD2SLocationContext(source, 'inventory', [], 'sorceress');
    const stash = withD2SLocationContext(source, 'stash', [], 'sorceress');
    const mercenary = withD2SLocationContext(source, 'mercenary', [], 'sorceress');
    const equipped = withD2SLocationContext(source, 'equipped', [], 'sorceress', 7);

    // Assert
    expect(inventory).toEqual(
      expect.objectContaining({ location_id: 0, alt_position_id: 1, equipped_id: 0 }),
    );
    expect(stash).toEqual(
      expect.objectContaining({ location_id: 0, alt_position_id: 5, equipped_id: 0 }),
    );
    expect(mercenary).toEqual(
      expect.objectContaining({ location_id: 3, alt_position_id: 0, equipped_id: 0 }),
    );
    expect(equipped).toEqual(
      expect.objectContaining({ location_id: 1, equipped_id: 7, position_x: 0, position_y: 0 }),
    );
  });

  it('Then target coordinates are only applied when both are given', () => {
    // Arrange
    const source = item({ position_x: 1, position_y: 1 });

    // Act
    const moved = withTargetCoordinates(source, 4, 2);
    const unchanged = withTargetCoordinates(source, 4, undefined);

    // Assert
    expect(moved).toEqual(expect.objectContaining({ position_x: 4, position_y: 2 }));
    expect(unchanged).toBe(source);
  });
});
