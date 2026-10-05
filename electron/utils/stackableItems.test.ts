import { describe, expect, it } from 'vitest';
import { resolveStackCountFromRawJson } from './stackableItems';

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
