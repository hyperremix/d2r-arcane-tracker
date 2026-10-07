import { items } from 'electron/items';
import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  etherealTypeLabelKeys,
  itemCategoryLabelKeys,
  itemSubCategoryLabelKeys,
  itemTreasureClassLabelKeys,
  itemTypeLabelKeys,
  saveFileEventTypeLabelKeys,
} from './labelKeys';

const labelMaps: Record<string, Record<string, string>> = {
  itemTypeLabelKeys,
  itemCategoryLabelKeys,
  itemSubCategoryLabelKeys,
  itemTreasureClassLabelKeys,
  etherealTypeLabelKeys,
  saveFileEventTypeLabelKeys,
};

describe('When item label key maps are used', () => {
  describe.each(Object.entries(labelMaps))('If the %s map is resolved', (_name, labelKeys) => {
    it('Then every value maps to an existing English translation', () => {
      // Arrange
      const entries = Object.entries(labelKeys);

      // Act
      const missing = entries.filter(([, key]) => !i18n.exists(key));

      // Assert
      expect(entries.length).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    });

    it('Then no translated label is the raw enum value', () => {
      // Arrange
      const entries = Object.entries(labelKeys);

      // Act
      const untranslated = entries.filter(([value, key]) => i18n.t(key) === value);

      // Assert
      expect(untranslated).toEqual([]);
    });
  });

  describe('If every value used by the bundled item data is looked up', () => {
    it('Then each type, category, sub-category, treasure class and ethereal type has a key', () => {
      // Arrange
      const fields = [
        ['type', itemTypeLabelKeys],
        ['category', itemCategoryLabelKeys],
        ['subCategory', itemSubCategoryLabelKeys],
        ['treasureClass', itemTreasureClassLabelKeys],
        ['etherealType', etherealTypeLabelKeys],
      ] as const;

      // Act
      const missing = fields.flatMap(([field, labelKeys]) =>
        items
          .map((item) => item[field])
          .filter((value) => !(value in labelKeys))
          .map((value) => `${field}:${value}`),
      );

      // Assert
      expect(items.length).toBeGreaterThan(0);
      expect([...new Set(missing)]).toEqual([]);
    });
  });
});
