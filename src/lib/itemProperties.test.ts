import { describe, expect, it } from 'vitest';
import { getItemProperties, getItemStatValue } from './itemProperties';

describe('When getItemProperties reads an item', () => {
  describe('If the raw item is a socketed ethereal base', () => {
    it('Then it reads the base item, categories and total sockets', () => {
      // Arrange: d2s sets `socketed` to 1 for any socketed item; the total is total_nr_of_sockets
      const item = {
        rawItemJson: JSON.stringify({
          type: '7s8',
          type_name: 'Thresher',
          categories: ['Polearm', 'Melee Weapon', 'Weapon'],
          socketed: 1,
          total_nr_of_sockets: 4,
        }),
        socketCount: 1,
      };

      // Act
      const result = getItemProperties(item);

      // Assert
      expect(result).toMatchObject({
        baseCode: '7s8',
        baseName: 'Thresher',
        categories: ['Polearm', 'Melee Weapon', 'Weapon'],
        socketCount: 4,
      });
    });
  });

  describe('If the raw item has no socket total', () => {
    it('Then it falls back to the socket count of the item', () => {
      // Arrange
      const item = { rawItemJson: '{}', socketCount: 2 };

      // Act
      const result = getItemProperties(item);

      // Assert
      expect(result.socketCount).toBe(2);
    });
  });

  describe('If the same item object is read twice', () => {
    it('Then the cached result is returned', () => {
      // Arrange
      const item = { rawItemJson: '{"type":"cm1"}' };

      // Act
      const first = getItemProperties(item);
      const second = getItemProperties(item);

      // Assert
      expect(second).toBe(first);
    });
  });
});

describe('When getItemStatValue reads a filter stat', () => {
  const smallCharm = {
    rawItemJson: JSON.stringify({
      combined_magic_attributes: [
        { name: 'maxhp', values: [20] },
        { name: 'item_fastergethitrate', values: [5] },
        { name: 'fireresist', values: [11] },
        { name: 'coldresist', values: [11] },
        { name: 'lightresist', values: [11] },
        { name: 'poisonresist', values: [9] },
        { name: 'item_addskill_tab', values: [1, 3, 1] },
        { name: 'item_addskill_tab', values: [2, 3, 2] },
      ],
    }),
  };

  describe('If the item has the stat', () => {
    it('Then it returns the stored value', () => {
      // Arrange
      const properties = getItemProperties(smallCharm);

      // Act
      const life = getItemStatValue(properties, 'life');
      const fhr = getItemStatValue(properties, 'fasterHitRecovery');

      // Assert
      expect([life, fhr]).toEqual([20, 5]);
    });
  });

  describe('If the filter stat spans several resistances', () => {
    it('Then the lowest resistance counts', () => {
      // Arrange
      const properties = getItemProperties(smallCharm);

      // Act
      const result = getItemStatValue(properties, 'allResistances');

      // Assert
      expect(result).toBe(9);
    });
  });

  describe('If the stat appears with several parameters', () => {
    it('Then the highest value counts', () => {
      // Arrange
      const properties = getItemProperties(smallCharm);

      // Act
      const result = getItemStatValue(properties, 'skillTreeSkills');

      // Assert
      expect(result).toBe(2);
    });
  });

  describe('If the item lacks the stat', () => {
    it('Then it returns undefined', () => {
      // Arrange
      const properties = getItemProperties(smallCharm);

      // Act
      const result = getItemStatValue(properties, 'magicFind');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('If the raw item has no combined attributes', () => {
    it('Then it reads the item and runeword attributes', () => {
      // Arrange
      const item = {
        rawItemJson: JSON.stringify({
          magic_attributes: [{ name: 'item_maxdamage_percent', values: [15, 15] }],
          runeword_attributes: [{ name: 'item_fastercastrate', values: [35] }],
        }),
      };

      // Act
      const properties = getItemProperties(item);

      // Assert
      expect(getItemStatValue(properties, 'enhancedDamage')).toBe(15);
      expect(getItemStatValue(properties, 'fasterCastRate')).toBe(35);
    });
  });
});
