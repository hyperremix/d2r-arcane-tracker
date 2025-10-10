import { renderHook } from '@testing-library/react';
import type { GrailProgress, Item, Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { describe, expect, it, vi } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { useProgressLookup } from './useProgressLookup';

// Default settings for testing
const settings: Settings = {
  saveDir: '',
  lang: 'en',
  gameMode: GameMode.Both,
  grailNormal: true,
  grailEthereal: false,
  grailRunes: false,
  grailRunewords: false,
  gameVersion: GameVersion.Resurrected,
  enableSounds: true,
  notificationVolume: 0.5,
  inAppNotifications: true,
  nativeNotifications: true,
  needsSeeding: true,
  theme: 'system',
  showItemIcons: true,
};

// Mock the ethereal functions
vi.mock('@/lib/ethereal', () => ({
  shouldShowNormalStatus: vi.fn(),
  shouldShowEtherealStatus: vi.fn(),
}));

import { shouldShowEtherealStatus, shouldShowNormalStatus } from '@/lib/ethereal';

describe('When useProgressLookup is used', () => {
  describe('If no items are provided', () => {
    it('Then should return empty lookup map', () => {
      // Arrange
      const items: Item[] = [];
      const progress: GrailProgress[] = [];
      const selectedCharacterId = null;

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      expect(result.current.size).toBe(0);
    });
  });

  describe('If items are provided with no progress', () => {
    it('Then should return lookup with all items not found', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build(),
        HolyGrailItemBuilder.new().withId('item2').withName('Test Item 2').build(),
      ];
      const progress: GrailProgress[] = [];
      const selectedCharacterId = null;

      // Mock ethereal functions to return true
      vi.mocked(shouldShowNormalStatus).mockReturnValue(true);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(true);

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      expect(result.current.size).toBe(2);
      expect(result.current.get('item1')).toEqual({
        normalFound: false,
        etherealFound: false,
        normalProgress: [],
        etherealProgress: [],
        overallFound: false,
      });
      expect(result.current.get('item2')).toEqual({
        normalFound: false,
        etherealFound: false,
        normalProgress: [],
        etherealProgress: [],
        overallFound: false,
      });
    });
  });

  describe('If normal items are found', () => {
    it('Then should return correct normal found status', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build()];
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog1')
          .withCharacterId('char1')
          .withItemId('item1')
          .withFoundDate(new Date('2024-01-01'))
          .build(),
      ];
      const selectedCharacterId = null;

      // Mock ethereal functions
      vi.mocked(shouldShowNormalStatus).mockReturnValue(true);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(true);

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      const lookupData = result.current.get('item1');
      expect(lookupData).toEqual({
        normalFound: true,
        etherealFound: false,
        normalProgress: [progress[0]],
        etherealProgress: [],
        overallFound: true,
      });
    });
  });

  describe('If ethereal items are found', () => {
    it('Then should return correct ethereal found status', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build()];
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog1')
          .withCharacterId('char1')
          .withItemId('item1')
          .withFoundDate(new Date('2024-01-01'))
          .asEthereal()
          .build(),
      ];
      const selectedCharacterId = null;

      // Mock ethereal functions
      vi.mocked(shouldShowNormalStatus).mockReturnValue(true);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(true);

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      const lookupData = result.current.get('item1');
      expect(lookupData).toEqual({
        normalFound: false,
        etherealFound: true,
        normalProgress: [],
        etherealProgress: [progress[0]],
        overallFound: true,
      });
    });
  });

  describe('If both normal and ethereal items are found', () => {
    it('Then should return both found statuses', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build()];
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog1')
          .withCharacterId('char1')
          .withItemId('item1')
          .withFoundDate(new Date('2024-01-01'))
          .build(),
        GrailProgressBuilder.new()
          .withId('prog2')
          .withCharacterId('char1')
          .withItemId('item1')
          .withFoundDate(new Date('2024-01-01'))
          .asEthereal()
          .build(),
      ];
      const selectedCharacterId = null;

      // Mock ethereal functions
      vi.mocked(shouldShowNormalStatus).mockReturnValue(true);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(true);

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      const lookupData = result.current.get('item1');
      expect(lookupData).toEqual({
        normalFound: true,
        etherealFound: true,
        normalProgress: [progress[0]],
        etherealProgress: [progress[1]],
        overallFound: true,
      });
    });
  });

  describe('If character-specific progress is requested', () => {
    it('Then should return only progress for selected character', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build()];
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog1')
          .withCharacterId('char1')
          .withItemId('item1')
          .withFoundDate(new Date('2024-01-01'))
          .build(),
        GrailProgressBuilder.new()
          .withId('prog2')
          .withCharacterId('char2')
          .withItemId('item1')
          .withFoundDate(new Date('2024-01-01'))
          .build(),
      ];
      const selectedCharacterId = 'char1';

      // Mock ethereal functions
      vi.mocked(shouldShowNormalStatus).mockReturnValue(true);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(true);

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      const lookupData = result.current.get('item1');
      expect(lookupData).toEqual({
        normalFound: true,
        etherealFound: false,
        normalProgress: [progress[0]], // Only char1's progress
        etherealProgress: [],
        overallFound: true,
      });
    });
  });

  describe('If character-specific progress is not found', () => {
    it('Then should return not found for selected character', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build()];
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog1')
          .withCharacterId('char2')
          .withItemId('item1')
          .withFoundDate(new Date('2024-01-01'))
          .build(),
      ];
      const selectedCharacterId = 'char1';

      // Mock ethereal functions
      vi.mocked(shouldShowNormalStatus).mockReturnValue(true);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(true);

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      const lookupData = result.current.get('item1');
      expect(lookupData).toEqual({
        normalFound: false,
        etherealFound: false,
        normalProgress: [],
        etherealProgress: [],
        overallFound: false,
      });
    });
  });

  describe('If shouldShowNormalStatus returns false', () => {
    it('Then should return not found for normal progress', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build()];
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog1')
          .withCharacterId('char1')
          .withItemId('item1')
          .withFoundDate(new Date('2024-01-01'))
          .build(),
      ];
      const selectedCharacterId = null;

      // Mock ethereal functions
      vi.mocked(shouldShowNormalStatus).mockReturnValue(false);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(true);

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      const lookupData = result.current.get('item1');
      expect(lookupData).toEqual({
        normalFound: false,
        etherealFound: false,
        normalProgress: [],
        etherealProgress: [],
        overallFound: false,
      });
    });
  });

  describe('If shouldShowEtherealStatus returns false', () => {
    it('Then should return not found for ethereal progress', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build()];
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog1')
          .withCharacterId('char1')
          .withItemId('eth_item1')
          .withFoundDate(new Date('2024-01-01'))
          .build(),
      ];
      const selectedCharacterId = null;

      // Mock ethereal functions
      vi.mocked(shouldShowNormalStatus).mockReturnValue(true);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(false);

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      const lookupData = result.current.get('item1');
      expect(lookupData).toEqual({
        normalFound: false,
        etherealFound: false,
        normalProgress: [],
        etherealProgress: [],
        overallFound: false,
      });
    });
  });

  describe('If multiple items with mixed progress', () => {
    it('Then should return correct lookup for each item', () => {
      // Arrange
      const items = [
        HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build(),
        HolyGrailItemBuilder.new().withId('item2').withName('Test Item 2').build(),
        HolyGrailItemBuilder.new().withId('item3').withName('Test Item 3').build(),
      ];
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog1')
          .withCharacterId('char1')
          .withItemId('item1')
          .withFoundDate(new Date('2024-01-01'))
          .build(),
        GrailProgressBuilder.new()
          .withId('prog2')
          .withCharacterId('char1')
          .withItemId('item2')
          .withFoundDate(new Date('2024-01-01'))
          .asEthereal()
          .build(),
        // item3 has no progress
      ];
      const selectedCharacterId = null;

      // Mock ethereal functions
      vi.mocked(shouldShowNormalStatus).mockReturnValue(true);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(true);

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      expect(result.current.size).toBe(3);

      // Item 1: normal found
      expect(result.current.get('item1')).toEqual({
        normalFound: true,
        etherealFound: false,
        normalProgress: [progress[0]],
        etherealProgress: [],
        overallFound: true,
      });

      // Item 2: ethereal found
      expect(result.current.get('item2')).toEqual({
        normalFound: false,
        etherealFound: true,
        normalProgress: [],
        etherealProgress: [progress[1]],
        overallFound: true,
      });

      // Item 3: not found
      expect(result.current.get('item3')).toEqual({
        normalFound: false,
        etherealFound: false,
        normalProgress: [],
        etherealProgress: [],
        overallFound: false,
      });
    });
  });

  describe('If progress entries are not found', () => {
    it('Then should return not found status', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build()];
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog1')
          .withCharacterId('char1')
          .withItemId('item1')
          .withoutFoundDate()
          .build(),
      ];
      const selectedCharacterId = null;

      // Mock ethereal functions
      vi.mocked(shouldShowNormalStatus).mockReturnValue(true);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(true);

      // Act
      const { result } = renderHook(() =>
        useProgressLookup(items, progress, settings, selectedCharacterId),
      );

      // Assert
      const lookupData = result.current.get('item1');
      expect(lookupData).toEqual({
        normalFound: false,
        etherealFound: false,
        normalProgress: [],
        etherealProgress: [],
        overallFound: false,
      });
    });
  });

  describe('If hook dependencies change', () => {
    it('Then should recalculate lookup', () => {
      // Arrange
      const items = [HolyGrailItemBuilder.new().withId('item1').withName('Test Item 1').build()];
      const initialProgress: GrailProgress[] = [];
      const updatedProgress = [
        GrailProgressBuilder.new()
          .withId('prog1')
          .withCharacterId('char1')
          .withItemId('item1')
          .withFoundDate(new Date('2024-01-01'))
          .build(),
      ];
      const selectedCharacterId = null;

      // Mock ethereal functions
      vi.mocked(shouldShowNormalStatus).mockReturnValue(true);
      vi.mocked(shouldShowEtherealStatus).mockReturnValue(true);

      // Act
      const { result, rerender } = renderHook(
        ({ progress }) => useProgressLookup(items, progress, settings, selectedCharacterId),
        { initialProps: { progress: initialProgress } },
      );

      // Assert initial state
      expect(result.current.get('item1')?.normalFound).toBe(false);

      // Update progress and rerender
      rerender({ progress: updatedProgress });

      // Assert updated state
      expect(result.current.get('item1')?.normalFound).toBe(true);
    });
  });
});
