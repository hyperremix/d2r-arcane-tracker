import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ITEM_PROPERTY_FILTERS,
  hasActiveItemPropertyFilters,
  type ItemPropertyFilters,
  matchesItemPropertyFilters,
  sortItems,
} from './itemPropertyFilters';

function makeItem(raw: Record<string, unknown>, ethereal = false) {
  return { rawItemJson: JSON.stringify(raw), ethereal };
}

const etherealThresher = makeItem(
  { type: '7s8', type_name: 'Thresher', categories: ['Polearm'], total_nr_of_sockets: 4 },
  true,
);
const giantThresher = makeItem({
  type: '7wc',
  type_name: 'Giant Thresher',
  categories: ['Polearm'],
  total_nr_of_sockets: 5,
});
const lifeFhrCharm = makeItem({
  type: 'cm1',
  type_name: 'Small Charm',
  categories: ['Small Charm', 'Charm'],
  combined_magic_attributes: [
    { name: 'maxhp', values: [20] },
    { name: 'item_fastergethitrate', values: [5] },
  ],
});
// Annihilus (unique id 381) rolling 15 of 10-20 stats, 20 of 10-20 resistances, 10 of 5-10 xp
const annihilus = makeItem({
  type: 'cm1',
  type_name: 'Small Charm',
  quality: 7,
  unique_id: 381,
  magic_attributes: [
    { name: 'strength', values: [15] },
    { name: 'fireresist', values: [20] },
    { name: 'item_addexperience', values: [10] },
  ],
});

function withFilters(overrides: Partial<ItemPropertyFilters>): ItemPropertyFilters {
  return { ...DEFAULT_ITEM_PROPERTY_FILTERS, ...overrides };
}

describe('When matchesItemPropertyFilters checks items', () => {
  describe('If no property filter is set', () => {
    it('Then every item matches and the filters are not active', () => {
      // Arrange
      const filters = DEFAULT_ITEM_PROPERTY_FILTERS;

      // Act
      const results = [etherealThresher, lifeFhrCharm].map((item) =>
        matchesItemPropertyFilters(item, filters),
      );

      // Assert
      expect(results).toEqual([true, true]);
      expect(hasActiveItemPropertyFilters(filters)).toBe(false);
    });
  });

  describe('If the filter asks for exactly 4 sockets', () => {
    it('Then only items with 4 sockets match', () => {
      // Arrange
      const filters = withFilters({ socketCount: 4, socketMatch: 'exactly' });

      // Act
      const results = [etherealThresher, giantThresher].map((item) =>
        matchesItemPropertyFilters(item, filters),
      );

      // Assert
      expect(results).toEqual([true, false]);
    });
  });

  describe('If the filter asks for at least 4 sockets', () => {
    it('Then items with 4 or more sockets match', () => {
      // Arrange
      const filters = withFilters({ socketCount: 4, socketMatch: 'atLeast' });

      // Act
      const results = [etherealThresher, giantThresher, lifeFhrCharm].map((item) =>
        matchesItemPropertyFilters(item, filters),
      );

      // Assert
      expect(results).toEqual([true, true, false]);
    });
  });

  describe('If the filter asks for ethereal Thresher bases', () => {
    it('Then the base text matches both Thresher bases and ethereal narrows them', () => {
      // Arrange
      const filters = withFilters({ baseText: 'thresher', ethereal: 'ethereal' });

      // Act
      const results = [etherealThresher, giantThresher, lifeFhrCharm].map((item) =>
        matchesItemPropertyFilters(item, filters),
      );

      // Assert
      expect(results).toEqual([true, false, false]);
    });
  });

  describe('If the base text names a category', () => {
    it('Then items of that category match', () => {
      // Arrange
      const filters = withFilters({ baseText: 'polearm', ethereal: 'notEthereal' });

      // Act
      const results = [etherealThresher, giantThresher].map((item) =>
        matchesItemPropertyFilters(item, filters),
      );

      // Assert
      expect(results).toEqual([false, true]);
    });
  });

  describe('If the filter asks for life and faster hit recovery', () => {
    it('Then only items with both stats at the minimum match', () => {
      // Arrange
      const filters = withFilters({
        statConditions: [
          { id: 1, stat: 'life', minValue: 15 },
          { id: 2, stat: 'fasterHitRecovery' },
        ],
      });
      const tooLittleLife = withFilters({
        statConditions: [{ id: 1, stat: 'life', minValue: 21 }],
      });

      // Act
      const results = [lifeFhrCharm, annihilus].map((item) =>
        matchesItemPropertyFilters(item, filters),
      );
      const tooLittleLifeResult = matchesItemPropertyFilters(lifeFhrCharm, tooLittleLife);

      // Assert
      expect(results).toEqual([true, false]);
      expect(tooLittleLifeResult).toBe(false);
    });
  });

  describe('If the filter asks for a minimum roll quality', () => {
    it('Then only rated items at or above it match', () => {
      // Arrange: the Annihilus averages (50 + 100 + 100) / 3 = 83.3%
      const reachable = withFilters({ minRollPercent: 80 });
      const tooHigh = withFilters({ minRollPercent: 90 });

      // Act
      const reachableResults = [annihilus, lifeFhrCharm].map((item) =>
        matchesItemPropertyFilters(item, reachable),
      );
      const tooHighResult = matchesItemPropertyFilters(annihilus, tooHigh);

      // Assert
      expect(reachableResults).toEqual([true, false]);
      expect(tooHighResult).toBe(false);
    });
  });
});

describe('When sortItems orders items', () => {
  describe('If the order is by roll quality', () => {
    it('Then the best roll comes first and items without one come last', () => {
      // Arrange
      const perfectAnnihilus = makeItem({
        quality: 7,
        unique_id: 381,
        magic_attributes: [
          { name: 'strength', values: [20] },
          { name: 'fireresist', values: [20] },
          { name: 'item_addexperience', values: [10] },
        ],
      });
      const items = [lifeFhrCharm, annihilus, perfectAnnihilus];

      // Act
      const result = sortItems(items, 'rollQuality');

      // Assert
      expect(result).toEqual([perfectAnnihilus, annihilus, lifeFhrCharm]);
    });
  });

  describe('If the order is the default', () => {
    it('Then the items keep their order', () => {
      // Arrange
      const items = [lifeFhrCharm, annihilus];

      // Act
      const result = sortItems(items, 'default');

      // Assert
      expect(result).toEqual([lifeFhrCharm, annihilus]);
    });
  });
});
