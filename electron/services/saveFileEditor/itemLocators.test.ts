import type { types as d2sTypes } from '@dschu012/d2s';
import { describe, expect, it } from 'vitest';
import {
  extractItemById,
  findItemByCode,
  itemMatchesLocator,
  normalizeSaveFileItemLocator,
  type SaveFileItemLocator,
} from './itemLocators';

function item(fields: Record<string, unknown>): d2sTypes.IItem {
  return fields as unknown as d2sTypes.IItem;
}

describe('When an item locator from the renderer is normalized', () => {
  describe('If the locator is a number', () => {
    it('Then integers become an id locator and other numbers are rejected', () => {
      // Act
      const locator = normalizeSaveFileItemLocator(42);
      const act = () => normalizeSaveFileItemLocator(4.2);

      // Assert
      expect(locator).toEqual({ itemId: 42 });
      expect(act).toThrow('itemId must be an integer');
    });
  });

  describe('If the locator is an object with string fields', () => {
    it('Then numeric strings are parsed and the item code is normalized', () => {
      // Arrange
      const raw = {
        itemId: '7',
        itemCode: ' R01 ',
        stashTab: '2',
        gridX: '3',
        gridY: 0,
      } as unknown as SaveFileItemLocator;

      // Act
      const locator = normalizeSaveFileItemLocator(raw);

      // Assert
      expect(locator).toEqual({ itemId: 7, itemCode: 'r01', stashTab: 2, gridX: 3, gridY: 0 });
    });
  });

  describe('If the locator is invalid', () => {
    it('Then it is rejected with a message naming the problem', () => {
      // Act
      const notAnObject = () => normalizeSaveFileItemLocator(undefined as never);
      const negativeTab = () => normalizeSaveFileItemLocator({ itemId: 1, stashTab: -1 });
      const noPosition = () => normalizeSaveFileItemLocator({ gridX: 1 });

      // Assert
      expect(notAnObject).toThrow('itemLocator must be a number or an object');
      expect(negativeTab).toThrow('stashTab must be a non-negative integer');
      expect(noPosition).toThrow('itemLocator must include itemId or both gridX and gridY');
    });
  });
});

describe('When an item is matched against a locator', () => {
  describe('If the locator has a grid position', () => {
    it('Then the position decides and a known id must agree', () => {
      // Arrange
      const stored = item({ id: 5, code: 'r01', position_x: 2, position_y: 3 });

      // Act
      const samePosition = itemMatchesLocator(stored, undefined, 2, 3);
      const otherPosition = itemMatchesLocator(stored, 5, 4, 3);
      const otherId = itemMatchesLocator(stored, 6, 2, 3);

      // Assert
      expect(samePosition).toBe(true);
      expect(otherPosition).toBe(false);
      expect(otherId).toBe(false);
    });
  });

  describe('If the locator has an item code', () => {
    it('Then a different code never matches and resource-tab locators match by code alone', () => {
      // Arrange
      const stored = item({ code: 'r01', position_x: 0, position_y: 0 });

      // Act
      const otherCode = itemMatchesLocator(stored, undefined, 0, 0, 'r02');
      const resourceTabByCode = itemMatchesLocator(stored, undefined, 9, 9, 'r01', true);

      // Assert
      expect(otherCode).toBe(false);
      expect(resourceTabByCode).toBe(true);
    });
  });

  describe('If the locator only has an id', () => {
    it('Then the stored id must be equal', () => {
      // Arrange
      const stored = item({ id: '12' });

      // Act & Assert
      expect(itemMatchesLocator(stored, 12)).toBe(true);
      expect(itemMatchesLocator(stored, 13)).toBe(false);
      expect(itemMatchesLocator(stored, undefined)).toBe(false);
    });
  });
});

describe('When items are looked up in a list', () => {
  it('Then extractItemById removes only the first item with that id', () => {
    // Arrange
    const items = [item({ id: 1, code: 'a' }), item({ id: 1, code: 'b' })];

    // Act
    const extracted = extractItemById(items, 1);

    // Assert
    expect((extracted as unknown as { code: string }).code).toBe('a');
    expect(items).toHaveLength(1);
  });

  it('Then findItemByCode compares normalized codes from code or type', () => {
    // Arrange
    const items = [item({ type: 'r01' }), item({ code: 'GEM' })];

    // Act & Assert
    expect(findItemByCode(items, 'r01')).toBe(items[0]);
    expect(findItemByCode(items, 'gem')).toBe(items[1]);
    expect(findItemByCode(items, 'r02')).toBeUndefined();
  });
});
