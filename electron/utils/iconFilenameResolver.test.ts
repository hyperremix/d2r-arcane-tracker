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
});
