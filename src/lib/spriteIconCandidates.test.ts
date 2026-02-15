import type { Item } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { createSpatialIconCandidates, createSpriteIconLookupIndex } from './spriteIconCandidates';

const grailItems: Item[] = [
  {
    id: 'harlequincrest',
    name: 'Harlequin Crest',
    code: 'uap',
    itemBase: 'Shako',
    imageFilename: 'harlequin_crest.png',
    link: 'https://example.com/item',
    etherealType: 'none',
    type: 'unique',
    category: 'armor',
    subCategory: 'helms',
    treasureClass: 'elite',
  } as Item,
];

describe('When sprite icon candidates are generated', () => {
  describe('If parser-provided icon filename exists', () => {
    it('Then it is returned as the first lookup candidate', () => {
      // Arrange
      const lookup = createSpriteIconLookupIndex(grailItems);

      // Act
      const candidates = createSpatialIconCandidates(
        {
          iconFileName: 'invhamm.png',
          grailItemId: undefined,
          itemCode: undefined,
          itemName: 'Battle Hammer',
          rawItemJson: '{}',
        },
        lookup,
      );

      // Assert
      expect(candidates[0]).toBe('invhamm.png');
    });
  });

  describe('If a grail item code match exists', () => {
    it('Then it includes the corresponding grail image filename candidate', () => {
      // Arrange
      const lookup = createSpriteIconLookupIndex(grailItems);

      // Act
      const candidates = createSpatialIconCandidates(
        {
          iconFileName: undefined,
          grailItemId: undefined,
          itemCode: 'uap',
          itemName: 'Shako',
          rawItemJson: '{}',
        },
        lookup,
      );

      // Assert
      expect(candidates).toContain('harlequin_crest.png');
    });
  });

  describe('If raw item metadata contains inv_file', () => {
    it('Then it adds that filename as a candidate', () => {
      // Arrange
      const lookup = createSpriteIconLookupIndex(grailItems);

      // Act
      const candidates = createSpatialIconCandidates(
        {
          iconFileName: undefined,
          grailItemId: undefined,
          itemCode: undefined,
          itemName: 'Any Item',
          rawItemJson: JSON.stringify({ inv_file: 'invwhm' }),
        },
        lookup,
      );

      // Assert
      expect(candidates).toContain('invwhm');
    });
  });

  describe('If name-based image fallback is required', () => {
    it('Then it appends snake_case filename candidates from type_name', () => {
      // Arrange
      const lookup = createSpriteIconLookupIndex(grailItems);

      // Act
      const candidates = createSpatialIconCandidates(
        {
          iconFileName: undefined,
          grailItemId: undefined,
          itemCode: undefined,
          itemName: 'Unknown Item',
          rawItemJson: JSON.stringify({ type_name: 'Grand Charm' }),
        },
        lookup,
      );

      // Assert
      expect(candidates).toContain('grand_charm.png');
    });
  });
});
