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
  {
    id: 'annihilus',
    name: 'Annihilus',
    code: 'cm1',
    itemBase: 'Small Charm',
    imageFilename: 'mephisto_soul_stone.png',
    link: 'https://example.com/annihilus',
    etherealType: 'none',
    type: 'unique',
    category: 'charms',
    subCategory: 'small_charms',
    treasureClass: 'normal',
  } as Item,
  {
    id: 'hellfiretorch',
    name: 'Hellfire Torch',
    code: 'cm2',
    itemBase: 'Large Charm',
    imageFilename: 'torch.png',
    link: 'https://example.com/hellfire-torch',
    etherealType: 'none',
    type: 'unique',
    category: 'charms',
    subCategory: 'large_charms',
    treasureClass: 'normal',
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

  describe('If a cm2 item has a generic large charm name', () => {
    it('Then it does not include torch icon from code-based lookup', () => {
      // Arrange
      const lookup = createSpriteIconLookupIndex(grailItems);

      // Act
      const candidates = createSpatialIconCandidates(
        {
          iconFileName: undefined,
          grailItemId: undefined,
          itemCode: 'cm2',
          itemName: 'Large Charm',
          rawItemJson: JSON.stringify({ code: 'cm2', type_name: 'Large Charm' }),
        },
        lookup,
      );

      // Assert
      expect(candidates).not.toContain('torch.png');
    });

    it('Then it includes large charm fallback icon candidates', () => {
      // Arrange
      const lookup = createSpriteIconLookupIndex(grailItems);

      // Act
      const candidates = createSpatialIconCandidates(
        {
          iconFileName: undefined,
          grailItemId: undefined,
          itemCode: 'cm2',
          itemName: 'Large Charm',
          rawItemJson: JSON.stringify({ code: 'cm2', type_name: 'Large Charm' }),
        },
        lookup,
      );

      // Assert
      expect(candidates).toContain('large_charm.png');
    });
  });

  describe('If a cm1 item has a generic small charm name', () => {
    it('Then it does not include annihilus icon from code-based lookup', () => {
      // Arrange
      const lookup = createSpriteIconLookupIndex(grailItems);

      // Act
      const candidates = createSpatialIconCandidates(
        {
          iconFileName: undefined,
          grailItemId: undefined,
          itemCode: 'cm1',
          itemName: 'Small Charm',
          rawItemJson: JSON.stringify({ code: 'cm1', type_name: 'Small Charm' }),
        },
        lookup,
      );

      // Assert
      expect(candidates).not.toContain('mephisto_soul_stone.png');
    });

    it('Then it includes small charm fallback icon candidates', () => {
      // Arrange
      const lookup = createSpriteIconLookupIndex(grailItems);

      // Act
      const candidates = createSpatialIconCandidates(
        {
          iconFileName: undefined,
          grailItemId: undefined,
          itemCode: 'cm1',
          itemName: 'Small Charm',
          rawItemJson: JSON.stringify({ code: 'cm1', type_name: 'Small Charm' }),
        },
        lookup,
      );

      // Assert
      expect(candidates).toContain('small_charm.png');
    });
  });

  describe('If a cm2 item is Hellfire Torch', () => {
    it('Then it keeps torch icon in candidates', () => {
      // Arrange
      const lookup = createSpriteIconLookupIndex(grailItems);

      // Act
      const candidates = createSpatialIconCandidates(
        {
          iconFileName: undefined,
          grailItemId: undefined,
          itemCode: 'cm2',
          itemName: 'Hellfire Torch',
          rawItemJson: JSON.stringify({ code: 'cm2', unique_name: 'Hellfire Torch' }),
        },
        lookup,
      );

      // Assert
      expect(candidates).toContain('torch.png');
    });
  });

  describe('If a cm1 item is Annihilus', () => {
    it('Then it keeps annihilus icon in candidates', () => {
      // Arrange
      const lookup = createSpriteIconLookupIndex(grailItems);

      // Act
      const candidates = createSpatialIconCandidates(
        {
          iconFileName: undefined,
          grailItemId: undefined,
          itemCode: 'cm1',
          itemName: 'Annihilus',
          rawItemJson: JSON.stringify({ code: 'cm1', unique_name: 'Annihilus' }),
        },
        lookup,
      );

      // Assert
      expect(candidates).toContain('mephisto_soul_stone.png');
    });
  });
});
