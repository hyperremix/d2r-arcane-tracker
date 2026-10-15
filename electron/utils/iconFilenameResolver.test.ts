import { describe, expect, it } from 'vitest';
import { resolveCanonicalIconFilename } from './iconFilenameResolver';

describe('When resolveCanonicalIconFilename is called', () => {
  describe('If a cm2 item has generic large charm naming', () => {
    it('Then it resolves to the large charm base icon instead of torch', () => {
      // Arrange
      const input = {
        itemCode: 'cm2',
        itemName: 'Large Charm',
        parsedName: 'Large Charm',
        typeName: 'Large Charm',
      };

      // Act
      const result = resolveCanonicalIconFilename(input);

      // Assert
      expect(result).toBe('large_charm.png');
    });
  });

  describe('If a cm1 item has generic small charm naming', () => {
    it('Then it resolves to the small charm base icon instead of annihilus', () => {
      // Arrange
      const input = {
        itemCode: 'cm1',
        itemName: 'Small Charm',
        parsedName: 'Small Charm',
        typeName: 'Small Charm',
      };

      // Act
      const result = resolveCanonicalIconFilename(input);

      // Assert
      expect(result).toBe('small_charm.png');
    });
  });

  describe('If a cm2 item is explicitly Hellfire Torch', () => {
    it('Then it still resolves to torch icon', () => {
      // Arrange
      const input = {
        itemCode: 'cm2',
        itemName: 'Hellfire Torch',
      };

      // Act
      const result = resolveCanonicalIconFilename(input);

      // Assert
      expect(result).toBe('torch.png');
    });
  });

  describe('If a cm1 item is explicitly Annihilus', () => {
    it('Then it still resolves to annihilus icon', () => {
      // Arrange
      const input = {
        itemCode: 'cm1',
        itemName: 'Annihilus',
      };

      // Act
      const result = resolveCanonicalIconFilename(input);

      // Assert
      expect(result).toBe('mephisto_soul_stone.png');
    });
  });

  describe('If a grimoire is not a unique or set item', () => {
    it('Then it resolves to the base grimoire icon instead of the unique icon of its code', () => {
      // Arrange
      const input = {
        itemCode: 'wa6',
        itemName: 'Burnt Text',
        parsedName: 'Burnt Text',
        typeName: 'Burnt Text',
      };

      // Act
      const result = resolveCanonicalIconFilename(input);

      // Assert
      expect(result).toBe('oldbook.png');
    });
  });

  describe('If a grimoire is the unique Measured Wrath', () => {
    it('Then it resolves to the unique icon', () => {
      // Arrange
      const input = {
        grailItemId: 'measuredwrath',
        itemCode: 'wa6',
        itemName: 'Measured Wrath',
        uniqueName: 'Measured Wrath',
      };

      // Act
      const result = resolveCanonicalIconFilename(input);

      // Assert
      expect(result).toBe('measured_wrath.png');
    });
  });

  describe('If a grimoire set item is only known by its set name', () => {
    it('Then the catalog name match beats the base grimoire icon', () => {
      // Arrange
      const input = {
        itemCode: 'wad',
        setName: "Horazon's Secrets",
      };

      // Act
      const result = resolveCanonicalIconFilename(input);

      // Assert
      expect(result).toBe('ars_torbaalos.png');
    });
  });

  describe('If a Colossal Jewel is not a unique item', () => {
    it('Then it resolves to the base jewel icon instead of a Colossal Ancient jewel icon', () => {
      // Arrange
      const input = {
        itemCode: 'cjw',
        itemName: 'Colossal Jewel',
        typeName: 'Colossal Jewel',
      };

      // Act
      const result = resolveCanonicalIconFilename(input);

      // Assert
      expect(result).toBe('perfect_diamond.png');
    });
  });
});
