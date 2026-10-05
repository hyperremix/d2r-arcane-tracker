import { describe, expect, it } from 'vitest';
import { isStackableFromRawJson, resolveStackCountFromRawJson } from './stackableItems';

describe('When isStackableFromRawJson is called', () => {
  describe('If itemCode matches rune pattern', () => {
    it('Then returns true for rune codes r01–r39', () => {
      // Arrange
      const runeCodes = ['r01', 'r33', 'R20'];

      // Act
      const results = runeCodes.map((code) => isStackableFromRawJson('{}', code));

      // Assert
      expect(results).toEqual([true, true, true]);
    });
  });

  describe('If raw JSON contains a rune code in code field', () => {
    it('Then returns true', () => {
      // Arrange
      const rawJson = '{"code":"r07"}';

      // Act
      const result = isStackableFromRawJson(rawJson);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If raw JSON contains a rune code in type field', () => {
    it('Then returns true', () => {
      // Arrange
      const rawJson = '{"type":"r15"}';

      // Act
      const result = isStackableFromRawJson(rawJson);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If raw JSON contains magic attribute 381', () => {
    it('Then returns true', () => {
      // Arrange
      const rawJson = JSON.stringify({
        magic_attributes: [{ id: 381, values: [5] }],
      });

      // Act
      const result = isStackableFromRawJson(rawJson);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If raw JSON has quantity > 1', () => {
    it('Then returns true', () => {
      // Arrange
      const rawJson = '{"quantity":3}';

      // Act
      const result = isStackableFromRawJson(rawJson);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If raw JSON has quantity = 1', () => {
    it('Then returns false', () => {
      // Arrange
      const rawJson = '{"quantity":1}';

      // Act
      const result = isStackableFromRawJson(rawJson);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If item is a non-stackable unique', () => {
    it('Then returns false', () => {
      // Arrange
      const rawJson = '{"code":"uap","quality":7}';

      // Act
      const result = isStackableFromRawJson(rawJson);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If raw JSON is invalid', () => {
    it('Then returns false', () => {
      // Arrange
      const rawJson = 'not-json';

      // Act
      const result = isStackableFromRawJson(rawJson);

      // Assert
      expect(result).toBe(false);
    });
  });
});

describe('When resolveStackCountFromRawJson is called', () => {
  describe('If raw JSON contains magic attribute 381', () => {
    it('Then returns that attribute value', () => {
      // Arrange
      const rawJson = JSON.stringify({
        magic_attributes: [{ id: 381, values: [12] }],
      });

      // Act
      const result = resolveStackCountFromRawJson(rawJson);

      // Assert
      expect(result).toBe(12);
    });
  });

  describe('If raw JSON contains quantity', () => {
    it('Then returns the quantity', () => {
      // Arrange
      const rawJson = '{"quantity":7}';

      // Act
      const result = resolveStackCountFromRawJson(rawJson);

      // Assert
      expect(result).toBe(7);
    });
  });

  describe('If raw JSON has both attr 381 and quantity', () => {
    it('Then attr 381 takes priority', () => {
      // Arrange
      const rawJson = JSON.stringify({
        quantity: 3,
        magic_attributes: [{ id: 381, values: [9] }],
      });

      // Act
      const result = resolveStackCountFromRawJson(rawJson);

      // Assert
      expect(result).toBe(9);
    });
  });

  describe('If raw JSON has no stack information', () => {
    it('Then returns 1', () => {
      // Arrange
      const rawJson = '{"code":"uap"}';

      // Act
      const result = resolveStackCountFromRawJson(rawJson);

      // Assert
      expect(result).toBe(1);
    });
  });

  describe('If raw JSON is invalid', () => {
    it('Then returns 1', () => {
      // Arrange
      const rawJson = 'not-json';

      // Act
      const result = resolveStackCountFromRawJson(rawJson);

      // Assert
      expect(result).toBe(1);
    });
  });

  describe('If quantity exceeds 511', () => {
    it('Then falls back to 1', () => {
      // Arrange
      const rawJson = '{"quantity":512}';

      // Act
      const result = resolveStackCountFromRawJson(rawJson);

      // Assert
      expect(result).toBe(1);
    });
  });
});
