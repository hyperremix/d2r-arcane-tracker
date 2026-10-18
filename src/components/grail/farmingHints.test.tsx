import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type {
  FarmingLocation,
  FarmingOverviewData,
  GrailProgress,
  Item,
} from 'electron/types/grail';
import { MAX_FARMING_CHARACTER_LEVEL } from 'electron/types/grail';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { getFarmingHints, useFarmingHints } from './farmingHints';

const originalElectronAPI = window.electronAPI;

const shako: Item = HolyGrailItemBuilder.new()
  .withId('harlequincrest')
  .withName('Harlequin Crest')
  .withType('unique')
  .withEtherealType('none')
  .build();
const ber: Item = HolyGrailItemBuilder.new()
  .withId('ber')
  .withName('Ber')
  .withType('rune')
  .withEtherealType('none')
  .build();
const tal: Item = HolyGrailItemBuilder.new()
  .withId('tal')
  .withName('Tal')
  .withType('rune')
  .withEtherealType('none')
  .build();
const spirit: Item = HolyGrailItemBuilder.new()
  .withId('spirit')
  .withName('Spirit')
  .withType('runeword')
  .withEtherealType('none')
  .build();

function location(overrides: Partial<FarmingLocation> & Pick<FarmingLocation, 'id'>) {
  return {
    kind: 'area',
    difficulty: 'hell',
    name: overrides.id,
    monsterLevel: { min: 85, max: 85 },
    itemIndexes: [],
    ...overrides,
  } satisfies FarmingLocation;
}

function overviewOf(locations: FarmingLocation[]): FarmingOverviewData {
  return { status: 'ready', locations, terrorZones: [], unknownItemIndexes: [] };
}

describe('When getFarmingHints picks where to farm the missing items', () => {
  const requestedItems = [shako, ber, tal];

  it('If an item drops in several difficulties, Then the Hell location is picked', () => {
    // Arrange
    const overview = overviewOf([
      location({ id: 'Normal area', difficulty: 'normal', itemIndexes: [0, 1, 2] }),
      location({ id: 'Hell area', difficulty: 'hell', itemIndexes: [0] }),
    ]);

    // Act
    const hints = getFarmingHints(overview, requestedItems, new Set(['harlequincrest']));

    // Assert
    expect(hints.get('harlequincrest')).toEqual({
      location: 'Hell area',
      areaName: undefined,
      difficulty: 'hell',
      monsterLevel: { min: 85, max: 85 },
    });
  });

  it('If several locations of a difficulty drop an item, Then the one dropping the most missing items is picked', () => {
    // Arrange
    const overview = overviewOf([
      location({ id: 'Few', itemIndexes: [0], monsterLevel: { min: 90, max: 90 } }),
      location({ id: 'Many', itemIndexes: [0, 1, 2], monsterLevel: { min: 80, max: 80 } }),
    ]);

    // Act
    const hints = getFarmingHints(
      overview,
      requestedItems,
      new Set(['harlequincrest', 'ber', 'tal']),
    );

    // Assert
    expect(hints.get('harlequincrest')?.location).toBe('Many');
  });

  it('If found items drop at a location, Then they do not count and get no hint', () => {
    // Arrange
    const overview = overviewOf([
      location({ id: 'Found items', itemIndexes: [0, 1, 2], monsterLevel: { min: 80, max: 80 } }),
      location({ id: 'High level', itemIndexes: [0], monsterLevel: { min: 90, max: 90 } }),
    ]);

    // Act
    const hints = getFarmingHints(overview, requestedItems, new Set(['harlequincrest']));

    // Assert
    expect(hints.get('harlequincrest')?.location).toBe('High level');
    expect(hints.has('ber')).toBe(false);
    expect(hints.has('tal')).toBe(false);
  });

  it('If a missing item drops nowhere, Then it gets no hint', () => {
    // Arrange
    const overview = overviewOf([location({ id: 'Area', itemIndexes: [0] })]);

    // Act
    const hints = getFarmingHints(overview, requestedItems, new Set(['harlequincrest', 'ber']));

    // Assert
    expect(hints.has('ber')).toBe(false);
  });
});

describe('When useFarmingHints loads the farming hints of the grail page', () => {
  const items = [shako, ber, spirit];

  afterEach(() => {
    // Unmount before the API is restored, so no effect runs against it
    cleanup();
    window.electronAPI = originalElectronAPI;
  });

  function setup(getOverview: ReturnType<typeof vi.fn>, d2rInstallPath: string | undefined) {
    window.electronAPI = { farming: { getOverview } } as unknown as typeof window.electronAPI;
    const settings = { d2rInstallPath, grailNormal: true, grailEthereal: false };
    return renderHook(
      ({ progress }: { progress: GrailProgress[] }) => useFarmingHints(items, progress, settings),
      { initialProps: { progress: [] as GrailProgress[] } },
    );
  }

  it('If no D2R installation is set, Then it requests nothing and has no hints', () => {
    // Arrange
    const getOverview = vi.fn();

    // Act
    const { result } = setup(getOverview, undefined);

    // Assert
    expect(getOverview).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it('If the farming data can be read, Then one request covers all farmable items and missing items get hints', async () => {
    // Arrange
    const getOverview = vi
      .fn()
      .mockResolvedValue(overviewOf([location({ id: 'Chaos Sanctuary', itemIndexes: [0, 1] })]));

    // Act
    const { result } = setup(getOverview, 'C:/D2R');

    // Assert
    await waitFor(() => expect(result.current?.get('ber')?.location).toBe('Chaos Sanctuary'));
    expect(result.current?.get('harlequincrest')?.location).toBe('Chaos Sanctuary');
    expect(getOverview).toHaveBeenCalledTimes(1);
    // Runewords are made, not found, so they are not requested
    expect(getOverview).toHaveBeenCalledWith({
      itemIds: ['harlequincrest', 'ber'],
      characterLevel: MAX_FARMING_CHARACTER_LEVEL,
    });
  });

  it('If an item is found later, Then its hint goes away without a new request', async () => {
    // Arrange
    const getOverview = vi
      .fn()
      .mockResolvedValue(overviewOf([location({ id: 'Chaos Sanctuary', itemIndexes: [0, 1] })]));
    const { result, rerender } = setup(getOverview, 'C:/D2R');
    await waitFor(() => expect(result.current?.has('ber')).toBe(true));

    // Act
    rerender({
      progress: [
        GrailProgressBuilder.new()
          .withItemId('ber')
          .withFoundDate(new Date('2026-10-01'))
          .asNormal()
          .build(),
      ],
    });

    // Assert
    expect(result.current?.has('ber')).toBe(false);
    expect(result.current?.has('harlequincrest')).toBe(true);
    expect(getOverview).toHaveBeenCalledTimes(1);
  });

  it('If the game files are missing, Then there are no hints', async () => {
    // Arrange
    const getOverview = vi
      .fn()
      .mockResolvedValue({ status: 'unavailable', errorCode: 'gameFilesMissing' });

    // Act
    const { result } = setup(getOverview, 'C:/D2R');

    // Assert
    await waitFor(() => expect(getOverview).toHaveBeenCalledTimes(1));
    expect(result.current).toBeUndefined();
  });
});
