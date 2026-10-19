import { describe, expect, it } from 'vitest';
import { CharacterBuilder, GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import {
  calculateFindStreaks,
  computeGrailStatistics,
  computeTypeProgress,
} from './grailStatistics';

const NOW = new Date(2024, 5, 15, 12, 0, 0);
const NORMAL_ONLY = { grailNormal: true, grailEthereal: false };
const NORMAL_AND_ETHEREAL = { grailNormal: true, grailEthereal: true };

const daysAgo = (days: number, hour = 12): Date =>
  new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - days, hour);

const find = (id: string, itemId: string, foundDate: Date, characterId = 'c1') =>
  GrailProgressBuilder.new()
    .withId(id)
    .withCharacterId(characterId)
    .withItemId(itemId)
    .withFoundDate(foundDate)
    .withFromInitialScan(false);

describe('When computeGrailStatistics is called', () => {
  describe('If there is no data', () => {
    it('Then every count, streak and breakdown is empty', () => {
      // Arrange
      const input = { items: [], progress: [], characters: [], settings: NORMAL_ONLY, now: NOW };

      // Act
      const stats = computeGrailStatistics(input);

      // Assert
      expect(stats).toMatchObject({
        totalItems: 0,
        foundItems: 0,
        completionPercentage: 0,
        recentFinds: 0,
        currentStreak: 0,
        maxStreak: 0,
        averageItemsPerDay: 0,
        categoryStats: [],
        characterStats: [],
      });
    });
  });

  describe('If only normal versions are tracked', () => {
    it('Then ethereal-only items and ethereal finds do not count', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('shako').withEtherealType('optional').build(),
        HolyGrailItemBuilder.new().withId('soj').withEtherealType('none').build(),
        HolyGrailItemBuilder.new().withId('eth-only').withEtherealType('only').build(),
      ];
      const progress = [
        find('p1', 'shako', daysAgo(30)).asEthereal().build(),
        find('p2', 'soj', daysAgo(30)).asNormal().build(),
      ];

      // Act
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [],
        settings: NORMAL_ONLY,
        now: NOW,
      });

      // Assert
      expect(stats.totalItems).toBe(2);
      expect(stats.foundItems).toBe(1);
      expect(stats.completionPercentage).toBe(50);
      expect(stats.etherealItems).toEqual({ total: 0, found: 0, percentage: 0 });
    });
  });

  describe('If normal and ethereal versions are tracked', () => {
    it('Then each version counts separately', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('shako').withEtherealType('optional').build(),
        HolyGrailItemBuilder.new().withId('eth-only').withEtherealType('only').build(),
      ];
      const progress = [
        find('p1', 'shako', daysAgo(30)).asNormal().build(),
        find('p2', 'eth-only', daysAgo(30)).asEthereal().build(),
      ];

      // Act
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [],
        settings: NORMAL_AND_ETHEREAL,
        now: NOW,
      });

      // Assert
      expect(stats.totalItems).toBe(3);
      expect(stats.foundItems).toBe(2);
      expect(stats.normalItems).toEqual({ total: 1, found: 1, percentage: 100 });
      expect(stats.etherealItems).toEqual({ total: 2, found: 1, percentage: 50 });
    });
  });

  describe('If some finds come from the initial scan', () => {
    it('Then they count as found but not as recent finds', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('item1').build(),
        HolyGrailItemBuilder.new().withId('item2').build(),
      ];
      const progress = [
        find('p1', 'item1', daysAgo(1)).asFromInitialScan().build(),
        find('p2', 'item2', daysAgo(1)).build(),
      ];

      // Act
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [],
        settings: NORMAL_ONLY,
        now: NOW,
      });

      // Assert
      expect(stats.foundItems).toBe(2);
      expect(stats.recentFinds).toBe(1);
      expect(stats.averageItemsPerDay).toBeCloseTo(1 / 7);
    });
  });

  describe('If a later startup scan found items', () => {
    it('Then they are recent finds on the day of that scan, and the first scan stays the baseline', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('item1').withCategory('armor').build(),
        HolyGrailItemBuilder.new().withId('item2').withCategory('armor').build(),
      ];
      const progress = [
        find('baseline', 'item1', daysAgo(30)).asFromInitialScan().build(),
        find('later-scan', 'item2', daysAgo(1)).asFromInitialScan().build(),
      ];

      // Act
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [],
        settings: NORMAL_ONLY,
        now: NOW,
      });

      // Assert
      expect(stats.recentFinds).toBe(1);
      expect(stats.currentStreak).toBe(1);
      expect(stats.categoryStats[0].recent).toBe(1);
    });
  });

  describe('If a second character is first seen later and records an item another character already found', () => {
    it('Then the repeat does not count as a recent find, a streak day or a category find, while the characters keep their own finds', () => {
      // Arrange
      const first = CharacterBuilder.new().withId('first').build();
      const second = CharacterBuilder.new().withId('second').build();
      const items = [
        HolyGrailItemBuilder.new().withId('found-before').withCategory('armor').build(),
        HolyGrailItemBuilder.new().withId('new-item').withCategory('weapons').build(),
      ];
      const progress = [
        find('original', 'found-before', daysAgo(30), 'first').build(),
        find('repeat', 'found-before', daysAgo(1), 'second').asFromInitialScan().build(),
        find('new', 'new-item', daysAgo(3), 'second').build(),
      ];

      // Act
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [first, second],
        settings: NORMAL_ONLY,
        now: NOW,
      });

      // Assert
      expect(stats.recentFinds).toBe(1);
      expect(stats.averageItemsPerDay).toBeCloseTo(1 / 7);
      expect(stats.currentStreak).toBe(0);
      expect(stats.maxStreak).toBe(1);
      expect(stats.categoryStats.map(({ category, recent }) => [category, recent]).sort()).toEqual([
        ['armor', 0],
        ['weapons', 1],
      ]);
      expect(stats.characterStats).toEqual([
        { character: second, totalFound: 2, recentFinds: 2 },
        { character: first, totalFound: 1, recentFinds: 0 },
      ]);
    });
  });

  describe('If records of untracked versions and items exist next to normal finds', () => {
    it('Then the recent finds match the found count and a character total counts only its tracked finds', () => {
      // Arrange
      const sorc = CharacterBuilder.new().withId('sorc').build();
      const items = [
        HolyGrailItemBuilder.new().withId('shako').withEtherealType('optional').build(),
        HolyGrailItemBuilder.new().withId('soj').withEtherealType('none').build(),
        HolyGrailItemBuilder.new().withId('eth-only').withEtherealType('only').build(),
      ];
      const progress = [
        find('p1', 'shako', daysAgo(2), 'sorc').asNormal().build(),
        find('p2', 'shako', daysAgo(1), 'other').asNormal().build(),
        find('p3', 'shako', daysAgo(1), 'sorc').asEthereal().build(),
        find('p4', 'soj', daysAgo(1), 'sorc').asNormal().build(),
        find('p5', 'eth-only', daysAgo(1), 'sorc').asNormal().build(),
        find('p6', 'not-tracked', daysAgo(1), 'sorc').build(),
      ];

      // Act
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [sorc],
        settings: NORMAL_ONLY,
        now: NOW,
      });

      // Assert
      expect(stats.foundItems).toBe(2);
      expect(stats.recentFinds).toBe(stats.foundItems);
      expect(stats.characterStats[0].totalFound).toBe(2);
    });
  });

  describe('If a character found a version that is not tracked', () => {
    it('Then it counts neither as a find of that character nor as a recent find', () => {
      // Arrange
      const sorc = CharacterBuilder.new().withId('sorc').build();
      const items = [
        HolyGrailItemBuilder.new().withId('shako').withEtherealType('optional').build(),
        HolyGrailItemBuilder.new().withId('eth-only').withEtherealType('only').build(),
      ];
      const progress = [
        find('p1', 'shako', daysAgo(30), 'sorc').asNormal().build(),
        find('p2', 'shako', daysAgo(1), 'sorc').asEthereal().build(),
        find('p3', 'eth-only', daysAgo(1), 'sorc').asNormal().build(),
        find('p4', 'not-tracked', daysAgo(1), 'sorc').build(),
      ];

      // Act
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [sorc],
        settings: NORMAL_ONLY,
        now: NOW,
      });

      // Assert
      expect(stats.recentFinds).toBe(0);
      expect(stats.characterStats).toEqual([{ character: sorc, totalFound: 1, recentFinds: 0 }]);
    });
  });

  describe('If finds are older than a week', () => {
    it('Then they are not recent', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('item1').build()];
      const progress = [find('p1', 'item1', daysAgo(8)).build()];

      // Act
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [],
        settings: NORMAL_ONLY,
        now: NOW,
      });

      // Assert
      expect(stats.recentFinds).toBe(0);
    });
  });

  describe('If items belong to several categories', () => {
    it('Then the categories are sorted by completion with their recent finds', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('sword').withCategory('weapons').build(),
        HolyGrailItemBuilder.new().withId('axe').withCategory('weapons').build(),
        HolyGrailItemBuilder.new().withId('shako').withCategory('armor').build(),
      ];
      const progress = [
        find('p1', 'shako', daysAgo(1)).build(),
        find('p2', 'sword', daysAgo(30)).build(),
      ];

      // Act
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [],
        settings: NORMAL_ONLY,
        now: NOW,
      });

      // Assert
      expect(stats.categoryStats).toEqual([
        { category: 'armor', total: 1, found: 1, percentage: 100, recent: 1 },
        { category: 'weapons', total: 2, found: 1, percentage: 50, recent: 0 },
      ]);
    });
  });

  describe('If several characters found items', () => {
    it('Then the characters are sorted by their number of finds', () => {
      // Arrange
      const sorc = CharacterBuilder.new().withId('sorc').withName('Sorc').build();
      const pala = CharacterBuilder.new().withId('pala').withName('Pala').build();
      const items = [
        HolyGrailItemBuilder.new().withId('item1').build(),
        HolyGrailItemBuilder.new().withId('item2').build(),
      ];
      const progress = [
        find('p1', 'item1', daysAgo(1), 'pala').build(),
        find('p2', 'item2', daysAgo(30), 'pala').build(),
        find('p3', 'item1', daysAgo(30), 'sorc').build(),
      ];

      // Act
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [sorc, pala],
        settings: NORMAL_ONLY,
        now: NOW,
      });

      // Assert
      expect(stats.characterStats).toEqual([
        { character: pala, totalFound: 2, recentFinds: 1 },
        { character: sorc, totalFound: 1, recentFinds: 0 },
      ]);
    });
  });
});

describe('When computeTypeProgress is called', () => {
  describe('If items of several types are tracked', () => {
    it('Then each type counts its own tracked versions and the types add up to the overall progress', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new()
          .withId('shako')
          .withType('unique')
          .withEtherealType('optional')
          .build(),
        HolyGrailItemBuilder.new()
          .withId('soj')
          .withType('unique')
          .withEtherealType('none')
          .build(),
        HolyGrailItemBuilder.new()
          .withId('tal-armor')
          .withType('set')
          .withEtherealType('none')
          .build(),
        HolyGrailItemBuilder.new().withId('ber').withType('rune').withEtherealType('none').build(),
      ];
      const progress = [
        find('p1', 'shako', daysAgo(30)).asEthereal().build(),
        find('p2', 'soj', daysAgo(30)).asNormal().build(),
        find('p3', 'ber', daysAgo(2)).asNormal().build(),
        GrailProgressBuilder.new().withItemId('tal-armor').withoutFoundDate().build(),
      ];

      // Act
      const typeProgress = computeTypeProgress({
        items,
        progress,
        settings: NORMAL_AND_ETHEREAL,
      });
      const stats = computeGrailStatistics({
        items,
        progress,
        characters: [],
        settings: NORMAL_AND_ETHEREAL,
        now: NOW,
      });

      // Assert
      expect(typeProgress).toEqual({
        unique: { total: 3, found: 2, percentage: (2 / 3) * 100 },
        set: { total: 1, found: 0, percentage: 0 },
        rune: { total: 1, found: 1, percentage: 100 },
      });
      const types = Object.values(typeProgress);
      expect(types.reduce((sum, type) => sum + type.total, 0)).toBe(stats.totalItems);
      expect(types.reduce((sum, type) => sum + type.found, 0)).toBe(stats.foundItems);
    });
  });

  describe('If only normal versions are tracked', () => {
    it('Then ethereal finds do not count towards the type progress', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new()
          .withId('shako')
          .withType('unique')
          .withEtherealType('optional')
          .build(),
      ];
      const progress = [find('p1', 'shako', daysAgo(30)).asEthereal().build()];

      // Act
      const typeProgress = computeTypeProgress({ items, progress, settings: NORMAL_ONLY });

      // Assert
      expect(typeProgress).toEqual({ unique: { total: 1, found: 0, percentage: 0 } });
    });
  });
});

describe('When calculateFindStreaks is called', () => {
  describe('If there were finds on consecutive days up to today', () => {
    it('Then the current streak counts those days once each', () => {
      // Arrange
      const dates = [daysAgo(0, 9), daysAgo(0, 18), daysAgo(1), daysAgo(2), daysAgo(5)];

      // Act
      const streaks = calculateFindStreaks(dates, NOW);

      // Assert
      expect(streaks).toEqual({ currentStreak: 3, maxStreak: 3 });
    });
  });

  describe('If nothing was found today but yesterday', () => {
    it('Then the current streak continues from yesterday', () => {
      // Arrange
      const dates = [daysAgo(1), daysAgo(2)];

      // Act
      const streaks = calculateFindStreaks(dates, NOW);

      // Assert
      expect(streaks.currentStreak).toBe(2);
    });
  });

  describe('If the last find was two days ago', () => {
    it('Then there is no current streak but the longest one is kept', () => {
      // Arrange
      const dates = [daysAgo(2), daysAgo(10), daysAgo(11), daysAgo(12), daysAgo(13)];

      // Act
      const streaks = calculateFindStreaks(dates, NOW);

      // Assert
      expect(streaks).toEqual({ currentStreak: 0, maxStreak: 4 });
    });
  });

  describe('If the finds are not in chronological order and span months', () => {
    it('Then the streaks are still calculated by calendar day', () => {
      // Arrange
      const dates = [new Date(2024, 1, 1), new Date(2024, 0, 31), new Date(2024, 0, 30)];

      // Act
      const streaks = calculateFindStreaks(dates, NOW);

      // Assert
      expect(streaks.maxStreak).toBe(3);
    });
  });
});
