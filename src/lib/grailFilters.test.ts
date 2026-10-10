import type { AdvancedGrailFilter, GrailFilter } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import {
  countActiveFilters,
  filterAndSortItems,
  parseSubCategoryFilterValue,
  toSubCategoryFilterValue,
} from './grailFilters';

describe('When filterAndSortItems is called', () => {
  const defaultSort: AdvancedGrailFilter = {
    rarities: [],
    difficulties: [],
    levelRange: { min: 1, max: 99 },
    requiredLevelRange: { min: 1, max: 99 },
    sortBy: 'found_date',
    sortOrder: 'desc',
    fuzzySearch: false,
  };
  const noFilter: GrailFilter = { foundStatus: 'all' };

  describe('If sorting by found date and several items are missing', () => {
    it('Then found items come first and missing items are ordered by name', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('c').withName('Cranebeak').build(),
        HolyGrailItemBuilder.new().withId('a').withName('Arreat').build(),
        HolyGrailItemBuilder.new().withId('f').withName('Found Item').build(),
        HolyGrailItemBuilder.new().withId('b').withName('Bloodfist').build(),
      ];
      const progress = [
        GrailProgressBuilder.new()
          .withId('p1')
          .withItemId('f')
          .withFoundDate(new Date('2024-01-01'))
          .build(),
      ];

      // Act
      const result = filterAndSortItems(items, progress, noFilter, defaultSort);

      // Assert
      expect(result.map((item) => item.id)).toEqual(['f', 'a', 'b', 'c']);
    });
  });

  describe('If items have the same sort key regardless of input order', () => {
    it('Then the order is the same for both sort directions within equal keys', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('z').withName('Zephyr').withType('set').build(),
        HolyGrailItemBuilder.new().withId('m').withName('Magefist').withType('unique').build(),
        HolyGrailItemBuilder.new().withId('a').withName('Angelic Halo').withType('set').build(),
        HolyGrailItemBuilder.new().withId('b').withName('Bul-Kathos').withType('unique').build(),
      ];

      // Act
      const ascending = filterAndSortItems(items, [], noFilter, {
        ...defaultSort,
        sortBy: 'type',
        sortOrder: 'asc',
      });
      const descending = filterAndSortItems([...items].reverse(), [], noFilter, {
        ...defaultSort,
        sortBy: 'type',
        sortOrder: 'desc',
      });

      // Assert
      expect(ascending.map((item) => item.id)).toEqual(['b', 'm', 'a', 'z']);
      expect(descending.map((item) => item.id)).toEqual(['a', 'z', 'b', 'm']);
    });
  });

  describe('If sorting by type', () => {
    it('Then types follow the quality order (unique, set, rune, runeword) instead of the alphabet', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('runeword').withType('runeword').build(),
        HolyGrailItemBuilder.new().withId('set').withType('set').build(),
        HolyGrailItemBuilder.new().withId('rune').withType('rune').build(),
        HolyGrailItemBuilder.new().withId('unique').withType('unique').build(),
      ];

      // Act
      const ascending = filterAndSortItems(items, [], noFilter, {
        ...defaultSort,
        sortBy: 'type',
        sortOrder: 'asc',
      });
      const descending = filterAndSortItems(items, [], noFilter, {
        ...defaultSort,
        sortBy: 'type',
        sortOrder: 'desc',
      });

      // Assert
      expect(ascending.map((item) => item.id)).toEqual(['unique', 'set', 'rune', 'runeword']);
      expect(descending.map((item) => item.id)).toEqual(['runeword', 'rune', 'set', 'unique']);
    });
  });

  describe('If sorting by category', () => {
    it('Then categories follow the display order instead of the alphabet', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('runewords').withCategory('runewords').build(),
        HolyGrailItemBuilder.new().withId('armor').withCategory('armor').build(),
        HolyGrailItemBuilder.new().withId('charms').withCategory('charms').build(),
        HolyGrailItemBuilder.new().withId('runes').withCategory('runes').build(),
        HolyGrailItemBuilder.new().withId('weapons').withCategory('weapons').build(),
        HolyGrailItemBuilder.new().withId('jewelry').withCategory('jewelry').build(),
      ];

      // Act
      const result = filterAndSortItems(items, [], noFilter, {
        ...defaultSort,
        sortBy: 'category',
        sortOrder: 'asc',
      });

      // Assert
      expect(result.map((item) => item.id)).toEqual([
        'weapons',
        'armor',
        'jewelry',
        'charms',
        'runes',
        'runewords',
      ]);
    });
  });

  describe('If sub-categories are selected', () => {
    it('Then only items in those sub-categories are returned', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new()
          .withId('helm')
          .withCategory('armor')
          .withArmorSubCategory('helms')
          .build(),
        HolyGrailItemBuilder.new()
          .withId('boots')
          .withCategory('armor')
          .withArmorSubCategory('boots')
          .build(),
        HolyGrailItemBuilder.new()
          .withId('sword')
          .withCategory('weapons')
          .withWeaponSubCategory('1h_swords')
          .build(),
      ];

      // Act
      const result = filterAndSortItems(
        items,
        [],
        { ...noFilter, subCategories: ['helms', '1h_swords'] },
        { ...defaultSort, sortBy: 'name', sortOrder: 'asc' },
      );

      // Assert
      expect(result.map((item) => item.id).sort()).toEqual(['helm', 'sword']);
    });
  });

  describe('If a category-qualified sub-category is selected', () => {
    it('Then only items of that category and sub-category are returned', () => {
      // Arrange
      const weaponSorceress = {
        ...HolyGrailItemBuilder.new().withId('weapon').withCategory('weapons').build(),
        subCategory: 'sorceress' as const,
      };
      const armorSorceress = {
        ...HolyGrailItemBuilder.new().withId('armor').withCategory('armor').build(),
        subCategory: 'sorceress' as const,
      };

      // Act
      const result = filterAndSortItems(
        [weaponSorceress, armorSorceress],
        [],
        { ...noFilter, subCategories: ['weapons:sorceress'] },
        { ...defaultSort, sortBy: 'name', sortOrder: 'asc' },
      );

      // Assert
      expect(result.map((item) => item.id)).toEqual(['weapon']);
    });
  });

  describe('If the search term is a base item name', () => {
    it('Then returns the items with that base', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new()
          .withId('harlequincrest')
          .withName('Harlequin Crest')
          .withItemBase('Shako')
          .build(),
        HolyGrailItemBuilder.new()
          .withId('shaftstop')
          .withName('Shaftstop')
          .withItemBase('Mesh Armor')
          .build(),
      ];

      // Act
      const result = filterAndSortItems(
        items,
        [],
        { ...noFilter, searchTerm: 'shako' },
        defaultSort,
      );

      // Assert
      expect(result.map((item) => item.id)).toEqual(['harlequincrest']);
    });
  });

  describe.each([
    ['exact', false],
    ['fuzzy', true],
  ])('If fuzzy search is %s', (_mode, fuzzySearch) => {
    it.each([
      '龙',
      '???',
      "'",
    ])('Then a search term "%s" without searchable characters matches nothing', (searchTerm) => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('shako').withName('Harlequin Crest').build(),
        HolyGrailItemBuilder.new().withId('sword').withName('Windforce').build(),
      ];

      // Act
      const result = filterAndSortItems(
        items,
        [],
        { ...noFilter, searchTerm },
        {
          ...defaultSort,
          fuzzySearch,
        },
      );

      // Assert
      expect(result).toEqual([]);
    });

    it('Then a whitespace-only search term still matches every item', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('shako').withName('Harlequin Crest').build(),
        HolyGrailItemBuilder.new().withId('sword').withName('Windforce').build(),
      ];

      // Act
      const result = filterAndSortItems(
        items,
        [],
        { ...noFilter, searchTerm: '   ' },
        {
          ...defaultSort,
          fuzzySearch,
        },
      );

      // Assert
      expect(result).toHaveLength(2);
    });
  });
});

describe('When toSubCategoryFilterValue and parseSubCategoryFilterValue are used', () => {
  describe('If a qualified value is parsed', () => {
    it('Then returns the category and sub-category it was built from', () => {
      // Arrange
      const value = toSubCategoryFilterValue('weapons', 'sorceress');

      // Act
      const parsed = parseSubCategoryFilterValue(value);

      // Assert
      expect(parsed).toEqual({ category: 'weapons', subCategory: 'sorceress' });
    });
  });

  describe('If a bare sub-category is parsed', () => {
    it('Then returns no category', () => {
      // Arrange & Act
      const parsed = parseSubCategoryFilterValue('helms');

      // Assert
      expect(parsed).toEqual({ category: undefined, subCategory: 'helms' });
    });
  });
});

describe('When countActiveFilters is called', () => {
  describe('If no filters are set', () => {
    it('Then should return 0', () => {
      // Arrange
      const filter = { foundStatus: 'all' as const };

      // Act
      const count = countActiveFilters(filter);

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('If empty search term and empty arrays are set', () => {
    it('Then should return 0', () => {
      // Arrange
      const filter = { searchTerm: '', categories: [], types: [], foundStatus: 'all' as const };

      // Act
      const count = countActiveFilters(filter);

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('If search, categories, types and found status are all set', () => {
    it('Then should return 4', () => {
      // Arrange
      const filter = {
        searchTerm: 'Shako',
        categories: ['armor' as const],
        types: ['unique' as const],
        foundStatus: 'found' as const,
      };

      // Act
      const count = countActiveFilters(filter);

      // Assert
      expect(count).toBe(4);
    });
  });

  describe('If sub-categories are selected', () => {
    it('Then counts them as one active filter', () => {
      // Arrange
      const filter = { foundStatus: 'all' as const, subCategories: ['helms', 'boots'] };

      // Act
      const count = countActiveFilters(filter);

      // Assert
      expect(count).toBe(1);
    });
  });
});
