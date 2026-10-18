import type { ItemRollProperty } from 'electron/items/itemRollRanges';
import { describe, expect, it } from 'vitest';
import { getItemRollQuality, rateRolledProperties } from './rollQuality';

// Attribute values as the d2s parser stores them (taken from the ChaosSCV105.d2s fixture)
const ANNIHILUS = {
  quality: 7,
  unique_id: 381,
  magic_attributes: [
    { id: 0, name: 'strength', values: [20] },
    { id: 1, name: 'energy', values: [20] },
    { id: 2, name: 'dexterity', values: [20] },
    { id: 3, name: 'vitality', values: [20] },
    { id: 39, name: 'fireresist', values: [20] },
    { id: 41, name: 'lightresist', values: [20] },
    { id: 43, name: 'coldresist', values: [20] },
    { id: 45, name: 'poisonresist', values: [20] },
    { id: 85, name: 'item_addexperience', values: [10] },
    { id: 127, name: 'item_allskills', values: [1] },
  ],
};

describe('When getItemRollQuality rates a unique item', () => {
  describe('If every variable stat is at its max', () => {
    it('Then it rates each variable stat at 100% and the item as perfect', () => {
      // Arrange
      const item = ANNIHILUS;

      // Act
      const result = getItemRollQuality(item);

      // Assert
      expect(result).toEqual({
        stats: [
          { propertyCode: 'all-stats', min: 10, max: 20, value: 20, percent: 100 },
          { propertyCode: 'res-all', min: 10, max: 20, value: 20, percent: 100 },
          { propertyCode: 'addxp', min: 5, max: 10, value: 10, percent: 100 },
        ],
        percent: 100,
        isPerfect: true,
        unratedCount: 0,
      });
    });
  });

  describe('If the stats rolled in the middle of their ranges', () => {
    it('Then the overall percent is the average of the stat percents and it is not perfect', () => {
      // Arrange
      const item = {
        ...ANNIHILUS,
        magic_attributes: ANNIHILUS.magic_attributes.map((attribute) => {
          if (attribute.name === 'item_addexperience') return { ...attribute, values: [5] };
          if (attribute.name === 'strength') return { ...attribute, values: [15] };
          return attribute;
        }),
      };

      // Act
      const result = getItemRollQuality(item);

      // Assert
      expect(result?.stats.map((stat) => stat.percent)).toEqual([50, 100, 0]);
      expect(result?.percent).toBe(50);
      expect(result?.isPerfect).toBe(false);
    });
  });

  describe('If the parsed attribute has a tooltip description', () => {
    it('Then the stat carries that description', () => {
      // Arrange
      const item = {
        quality: 7,
        unique_id: 406,
        magic_attributes: [
          { id: 37, name: 'magicresist', values: [-50] },
          { id: 193, name: 'item_pierce_magic_immunity', values: [300] },
        ],
        displayed_magic_attributes: [
          { id: 37, name: 'magicresist', values: [-50], description: 'Magic Resist -50%' },
          { id: 193, name: 'item_pierce_magic_immunity', values: [300], description: 'x' },
        ],
      };

      // Act
      const result = getItemRollQuality(item);

      // Assert
      expect(result?.stats).toEqual([
        {
          propertyCode: 'res-mag',
          min: -65,
          max: -45,
          value: -50,
          percent: 75,
          description: 'Magic Resist -50%',
        },
      ]);
    });
  });

  describe('If the displayed attributes are in a different order than the saved ones', () => {
    it('Then each stat still carries its own description', () => {
      // Arrange: Maelstromwrath-like skills share a stat name, so values tell them apart
      const item = {
        quality: 7,
        unique_id: 11,
        magic_attributes: [
          { id: 107, name: 'item_singleskill', values: [74, 3] },
          { id: 107, name: 'item_singleskill', values: [77, 1] },
          { id: 107, name: 'item_singleskill', values: [66, 2] },
          { id: 107, name: 'item_singleskill', values: [76, 3] },
        ],
        displayed_magic_attributes: [
          { id: 107, name: 'item_singleskill', values: [76, 3], description: 'Skill 76' },
          { id: 107, name: 'item_singleskill', values: [66, 2], description: 'Skill 66' },
          { id: 107, name: 'item_singleskill', values: [77, 1], description: 'Skill 77' },
          { id: 107, name: 'item_singleskill', values: [74, 3], description: 'Skill 74' },
        ],
      };

      // Act
      const result = getItemRollQuality(item);

      // Assert
      expect(result?.stats.map((stat) => stat.description)).toEqual([
        'Skill 74',
        'Skill 77',
        'Skill 66',
        'Skill 76',
      ]);
    });
  });

  describe('If a value lies outside the range of the game data', () => {
    it('Then the stat shows the value but is not rated', () => {
      // Arrange: Bone Break with -25% damage reduction (the game data range is -20 to -10)
      const item = {
        quality: 7,
        unique_id: 405,
        magic_attributes: [{ id: 36, name: 'damageresist', values: [-25] }],
      };

      // Act
      const result = getItemRollQuality(item);

      // Assert
      expect(result).toEqual({
        stats: [{ propertyCode: 'red-dmg%', min: -20, max: -10, value: -25 }],
        percent: undefined,
        isPerfect: false,
        unratedCount: 1,
      });
    });
  });

  describe('If the item has an elemental damage range', () => {
    it('Then it is left out because the save stores it as one merged attribute', () => {
      // Arrange: Mindrend, +1 to +12-15 lightning damage, +50-100 to attack rating, +60-100% damage
      const item = {
        quality: 7,
        unique_id: 3,
        magic_attributes: [
          { name: 'lightmindam', values: [1, 14] },
          { name: 'tohit', values: [75] },
          { name: 'item_maxdamage_percent', values: [80, 80] },
        ],
      };

      // Act
      const result = getItemRollQuality(item);

      // Assert
      expect(result?.stats.map((stat) => stat.propertyCode)).toEqual(['att', 'dmg%']);
      expect(result?.unratedCount).toBe(0);
    });
  });

  describe('If the item has several skill bonuses with their own ranges', () => {
    it('Then each one is matched by its skill', () => {
      // Arrange: Maelstromwrath, +1-3 to four sorceress skills (ids 74, 77, 66, 76)
      const item = {
        quality: 7,
        unique_id: 11,
        magic_attributes: [
          { name: 'item_singleskill', values: [74, 3] },
          { name: 'item_singleskill', values: [77, 1] },
          { name: 'item_singleskill', values: [66, 2] },
          { name: 'item_singleskill', values: [76, 3] },
        ],
      };

      // Act
      const result = getItemRollQuality(item);

      // Assert
      expect(result?.stats.map((stat) => stat.value)).toEqual([3, 1, 2, 3]);
      expect(result?.stats.map((stat) => stat.percent)).toEqual([100, 0, 50, 100]);
    });
  });

  describe('If the item is a set item', () => {
    it('Then it is rated against its set item entry', () => {
      // Arrange: set item 62 rolls defense, dexterity, strength and all resistances
      const item = {
        quality: 5,
        set_id: 62,
        magic_attributes: [
          { name: 'armorclass', values: [175] },
          { name: 'dexterity', values: [25] },
          { name: 'strength', values: [10] },
          { name: 'fireresist', values: [20] },
        ],
      };

      // Act
      const result = getItemRollQuality(item);

      // Assert
      expect(result?.stats.map((stat) => stat.percent)).toEqual([100, 50, 0, 100]);
    });
  });

  describe('If the item is neither unique nor set, or all its stats are fixed', () => {
    it('Then it has no roll quality', () => {
      // Arrange
      const rare = { quality: 6, magic_attributes: ANNIHILUS.magic_attributes };
      const stoneOfJordan = { quality: 7, unique_id: 122, magic_attributes: [] };

      // Act
      const results = [getItemRollQuality(rare), getItemRollQuality(stoneOfJordan)];

      // Assert
      expect(results).toEqual([undefined, undefined]);
    });
  });
});

describe('When rateRolledProperties rates properties that share a stat', () => {
  describe('If a fixed property adds to the same stat as a variable one', () => {
    it('Then the fixed amount is subtracted from the stored value', () => {
      // Arrange: +10-20 all resistances and a fixed +30 fire resistance
      const properties: ItemRollProperty[] = [
        ['res-all', 10, 20],
        ['res-fire', 30, 30],
      ];
      const attributes = [
        { name: 'fireresist', values: [45] },
        { name: 'lightresist', values: [15] },
      ];

      // Act
      const result = rateRolledProperties(properties, attributes);

      // Assert
      expect(result?.stats).toEqual([
        { propertyCode: 'res-all', min: 10, max: 20, value: 15, percent: 50 },
      ]);
    });
  });

  describe('If a value sits exactly on a whole percent of its range', () => {
    it('Then the percent is that whole number without float rounding error', () => {
      // Arrange: 229 in 200 to 300 is 29%, but (229 - 200) / 100 * 100 is 28.999...
      const properties: ItemRollProperty[] = [['ac%', 200, 300]];
      const attributes = [{ name: 'item_armor_percent', values: [229] }];

      // Act
      const result = rateRolledProperties(properties, attributes);

      // Assert
      expect(result?.stats[0]?.percent).toBe(29);
    });
  });

  describe('If two variable properties add to the only stat they could be read from', () => {
    it('Then neither can be rated and the item is not perfect', () => {
      // Arrange
      const properties: ItemRollProperty[] = [
        ['str', 10, 20],
        ['all-stats', 5, 10],
      ];
      const attributes = [
        { name: 'strength', values: [30] },
        { name: 'energy', values: [10] },
      ];

      // Act
      const result = rateRolledProperties(properties, attributes);

      // Assert: all-stats is read from energy instead, strength is shared and can't be split
      expect(result?.stats.map((stat) => stat.percent)).toEqual([undefined, 100]);
      expect(result?.unratedCount).toBe(1);
      expect(result?.isPerfect).toBe(false);
      expect(result?.percent).toBe(100);
    });
  });
});
