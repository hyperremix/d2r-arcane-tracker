import { describe, expect, it } from 'vitest';
import { isStackableFromRawJson, resolveStackCountFromRawJson } from './stackableItems';

describe('When isStackableFromRawJson is called', () => {
  describe('If itemCode matches rune pattern', () => {
    it('Then returns true for rune codes r01–r39', () => {
      expect(isStackableFromRawJson('{}', 'r01')).toBe(true);
      expect(isStackableFromRawJson('{}', 'r33')).toBe(true);
      expect(isStackableFromRawJson('{}', 'R20')).toBe(true);
    });
  });

  describe('If raw JSON contains a rune code in code field', () => {
    it('Then returns true', () => {
      expect(isStackableFromRawJson('{"code":"r07"}')).toBe(true);
    });
  });

  describe('If raw JSON contains a rune code in type field', () => {
    it('Then returns true', () => {
      expect(isStackableFromRawJson('{"type":"r15"}')).toBe(true);
    });
  });

  describe('If raw JSON contains magic attribute 381', () => {
    it('Then returns true', () => {
      const rawJson = JSON.stringify({
        magic_attributes: [{ id: 381, values: [5] }],
      });
      expect(isStackableFromRawJson(rawJson)).toBe(true);
    });
  });

  describe('If raw JSON has quantity > 1', () => {
    it('Then returns true', () => {
      expect(isStackableFromRawJson('{"quantity":3}')).toBe(true);
    });
  });

  describe('If raw JSON has quantity = 1', () => {
    it('Then returns false', () => {
      expect(isStackableFromRawJson('{"quantity":1}')).toBe(false);
    });
  });

  describe('If item is a non-stackable unique', () => {
    it('Then returns false', () => {
      expect(isStackableFromRawJson('{"code":"uap","quality":7}')).toBe(false);
    });
  });

  describe('If raw JSON is invalid', () => {
    it('Then returns false', () => {
      expect(isStackableFromRawJson('not-json')).toBe(false);
    });
  });
});

describe('When resolveStackCountFromRawJson is called', () => {
  describe('If raw JSON contains magic attribute 381', () => {
    it('Then returns that attribute value', () => {
      const rawJson = JSON.stringify({
        magic_attributes: [{ id: 381, values: [12] }],
      });
      expect(resolveStackCountFromRawJson(rawJson)).toBe(12);
    });
  });

  describe('If raw JSON contains quantity', () => {
    it('Then returns the quantity', () => {
      expect(resolveStackCountFromRawJson('{"quantity":7}')).toBe(7);
    });
  });

  describe('If raw JSON has both attr 381 and quantity', () => {
    it('Then attr 381 takes priority', () => {
      const rawJson = JSON.stringify({
        quantity: 3,
        magic_attributes: [{ id: 381, values: [9] }],
      });
      expect(resolveStackCountFromRawJson(rawJson)).toBe(9);
    });
  });

  describe('If raw JSON has no stack information', () => {
    it('Then returns 1', () => {
      expect(resolveStackCountFromRawJson('{"code":"uap"}')).toBe(1);
    });
  });

  describe('If raw JSON is invalid', () => {
    it('Then returns 1', () => {
      expect(resolveStackCountFromRawJson('not-json')).toBe(1);
    });
  });

  describe('If quantity exceeds 511', () => {
    it('Then falls back to 1', () => {
      expect(resolveStackCountFromRawJson('{"quantity":512}')).toBe(1);
    });
  });
});
