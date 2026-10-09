import type { IItem } from '@dschu012/d2s/lib/d2/types';
import { describe, expect, it } from 'vitest';
import { isRune, simplifyItemName } from './objects';

describe('When simplifyItemName is called', () => {
  describe('If item name contains special characters', () => {
    it('Then should remove all non-alphanumeric characters and convert to lowercase', () => {
      // Arrange
      const itemName = 'Windforce (Hydra Bow)';

      // Act
      const result = simplifyItemName(itemName);

      // Assert
      expect(result).toBe('windforcehydrabow');
    });
  });

  describe('If item name contains numbers', () => {
    it('Then should preserve numbers in the simplified name', () => {
      // Arrange
      const itemName = 'Rune 33 - Zod';

      // Act
      const result = simplifyItemName(itemName);

      // Assert
      expect(result).toBe('rune33zod');
    });
  });

  describe('If item name is already simple', () => {
    it('Then should return lowercase version', () => {
      // Arrange
      const itemName = 'Shako';

      // Act
      const result = simplifyItemName(itemName);

      // Assert
      expect(result).toBe('shako');
    });
  });
});

describe('When isRune is called', () => {
  describe('If item type matches rune pattern', () => {
    it('Then should return true for valid rune types', () => {
      // Arrange
      const runeItem: IItem = { type: 'r01' } as IItem;

      // Act
      const result = isRune(runeItem);

      // Assert
      expect(result).toBe(true);
    });

    it('Then should return true for higher rune types', () => {
      // Arrange
      const runeItem: IItem = { type: 'r33' } as IItem;

      // Act
      const result = isRune(runeItem);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If item type does not match rune pattern', () => {
    it('Then should return false for non-rune types', () => {
      // Arrange
      const nonRuneItem: IItem = { type: 'swor' } as IItem;

      // Act
      const result = isRune(nonRuneItem);

      // Assert
      expect(result).toBe(false);
    });

    it('Then should return false for items without type', () => {
      // Arrange
      const itemWithoutType: IItem = {} as IItem;

      // Act
      const result = isRune(itemWithoutType);

      // Assert
      expect(result).toBe(false);
    });
  });
});
