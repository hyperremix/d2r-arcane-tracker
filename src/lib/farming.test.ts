import { describe, expect, it } from 'vitest';
import { CharacterBuilder, GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import {
  clampInteger,
  getDefaultFarmingCharacterLevel,
  getMissingFarmingItems,
  toDropRateDisplay,
} from './farming';

const unique = (id: string, etherealType: 'none' | 'optional' = 'none') =>
  HolyGrailItemBuilder.new().withId(id).withType('unique').withEtherealType(etherealType).build();

describe('When the missing items to farm are listed', () => {
  it('Then found items and runewords are left out', () => {
    // Arrange
    const items = [
      unique('shako'),
      unique('griffon'),
      HolyGrailItemBuilder.new().withId('enigma').withType('runeword').build(),
    ];
    const progress = [
      GrailProgressBuilder.new().withItemId('shako').withFoundDate(new Date()).asNormal().build(),
    ];

    // Act
    const missing = getMissingFarmingItems(items, progress, {
      grailNormal: true,
      grailEthereal: false,
    });

    // Assert
    expect(missing.map((item) => item.id)).toEqual(['griffon']);
  });

  it('If an item is a crafted sunder charm upgrade, Then it is left out', () => {
    // Arrange
    const items = [unique('latentblackcleft'), unique('renewedflamerift'), unique('shako')];

    // Act
    const missing = getMissingFarmingItems(items, [], { grailNormal: true, grailEthereal: false });

    // Assert
    expect(missing.map((item) => item.id)).toEqual(['shako']);
  });

  it('If ethereal versions are tracked, Then an item found only as normal is still missing', () => {
    // Arrange
    const items = [unique('titan', 'optional'), unique('shako')];
    const progress = [
      GrailProgressBuilder.new().withItemId('titan').withFoundDate(new Date()).asNormal().build(),
      GrailProgressBuilder.new().withItemId('shako').withFoundDate(new Date()).asNormal().build(),
    ];

    // Act
    const missing = getMissingFarmingItems(items, progress, {
      grailNormal: true,
      grailEthereal: true,
    });

    // Assert
    expect(missing.map((item) => item.id)).toEqual(['titan']);
  });

  it('If a record has no found date, Then the item is still missing', () => {
    // Arrange
    const items = [unique('shako')];
    const progress = [GrailProgressBuilder.new().withItemId('shako').withoutFoundDate().build()];

    // Act
    const missing = getMissingFarmingItems(items, progress, {
      grailNormal: true,
      grailEthereal: false,
    });

    // Assert
    expect(missing).toHaveLength(1);
  });
});

describe('When the default character level for terror zones is chosen', () => {
  it('Then it is the highest level of the characters that are not deleted', () => {
    // Arrange
    const characters = [
      CharacterBuilder.new().withLevel(80).withoutDeleted().build(),
      CharacterBuilder.new().withLevel(95).withDeleted(new Date()).build(),
      CharacterBuilder.new().withLevel(88).withoutDeleted().build(),
    ];

    // Act
    const level = getDefaultFarmingCharacterLevel(characters);

    // Assert
    expect(level).toBe(88);
  });

  it('If there are no characters, Then it is 99', () => {
    // Arrange & Act
    const level = getDefaultFarmingCharacterLevel([]);

    // Assert
    expect(level).toBe(99);
  });
});

describe('When a drop rate is prepared for display', () => {
  it.each([
    [1 / 1234.4, { kind: 'oneIn', kills: 1234 }],
    [0.5, { kind: 'oneIn', kills: 2 }],
    [1, { kind: 'perKill', drops: 1 }],
    [2.345, { kind: 'perKill', drops: 2.35 }],
  ])('If %f drops are expected per kill, Then it is shown as %j', (drops, expected) => {
    // Arrange & Act
    const display = toDropRateDisplay(drops);

    // Assert
    expect(display).toEqual(expected);
  });
});

describe('When a number input is clamped', () => {
  it.each([
    [5.7, 5],
    [-3, 1],
    [120, 99],
    [Number.NaN, 1],
  ])('If %f is entered, Then %i is used', (value, expected) => {
    // Arrange & Act
    const clamped = clampInteger(value, 1, 99);

    // Assert
    expect(clamped).toBe(expected);
  });
});
