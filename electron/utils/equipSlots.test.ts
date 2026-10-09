import { describe, expect, it } from 'vitest';
import {
  buildItemEquipMetadataByCode,
  normalizeEquipCategories,
  normalizeOccupiedWeaponSetSlotId,
  normalizeWeaponSetSlotId,
  resolveEligibleEquippedSlotIds,
  resolveRequiredCharacterClass,
} from './equipSlots';

function eligibleSlots(categories: string[]): number[] {
  return [...(resolveEligibleEquippedSlotIds(normalizeEquipCategories(categories)) ?? [])].sort(
    (left, right) => left - right,
  );
}

describe('When equipment slots are resolved from item categories', () => {
  it.each([
    ['a helm', ['Helm', 'Any Armor'], [1]],
    ['a circlet', ['Circlet', 'Helm', 'Any Armor'], [1]],
    ['a druid pelt', ['Pelt', 'Helm', 'Any Armor', 'Druid Item', 'Class Specific'], [1]],
    ['body armor', ['Armor', 'Any Armor'], [3]],
    ['gloves', ['Gloves', 'Any Armor'], [10]],
    ['boots', ['Boots', 'Any Armor'], [9]],
    ['a belt', ['Belt', 'Any Armor'], [8]],
    ['a shield', ['Shield', 'Any Shield', 'Any Armor', 'Second Hand'], [5]],
    ['a weapon', ['Sword', 'Swords and Knives', 'Melee Weapon', 'Weapon'], [4, 5]],
    ['a ring', ['Ring', 'Miscellaneous'], [6, 7]],
    ['an amulet', ['Amulet', 'Miscellaneous'], [2]],
    ['a rune', ['Rune', 'Socket Filler', 'Miscellaneous'], []],
  ])('Then %s is eligible for its slots only', (_label, categories, expectedSlots) => {
    // Arrange / Act
    const slots = eligibleSlots(categories);

    // Assert
    expect(slots).toEqual(expectedSlots);
  });

  it('Then unknown categories have no eligible slots', () => {
    // Arrange / Act
    const slots = resolveEligibleEquippedSlotIds(undefined);

    // Assert
    expect(slots).toBeUndefined();
  });
});

describe('When item categories are normalized', () => {
  it('Then names are trimmed and lower-cased and non-strings are dropped', () => {
    // Arrange / Act
    const categories = normalizeEquipCategories([' Helm ', 'Any Armor', 7, '']);

    // Assert
    expect(categories).toEqual(new Set(['helm', 'any armor']));
  });

  it('If the value is not an array, Then it returns undefined', () => {
    // Arrange / Act
    const categories = normalizeEquipCategories('Helm');

    // Assert
    expect(categories).toBeUndefined();
  });
});

describe('When equip metadata is built from constant data', () => {
  it('Then categories and damage flags of all tables are merged per lower-cased code', () => {
    // Arrange
    const first = { weapon_items: { FLB: { c: ['Sword', 'Weapon'], mind: 9, maxd: 15 } } };
    const second = { weapon_items: { flb: { c: ['Melee Weapon'], min2d: '13', max2d: 26 } } };

    // Act
    const metadata = buildItemEquipMetadataByCode([first, second]).get('flb');

    // Assert
    expect(metadata).toEqual({
      categories: new Set(['sword', 'weapon', 'melee weapon']),
      hasOneHandDamage: true,
      hasTwoHandDamage: true,
    });
  });

  it('If an entry has no category list, Then its categories stay undefined', () => {
    // Arrange
    const constantData = { other_items: { xyz: { c: 'Misc' } } };

    // Act
    const metadata = buildItemEquipMetadataByCode([constantData]).get('xyz');

    // Assert
    expect(metadata).toEqual({
      categories: undefined,
      hasOneHandDamage: false,
      hasTwoHandDamage: false,
    });
  });
});

describe('When class-specific items are checked', () => {
  it('Then the class category decides the required class', () => {
    // Arrange / Act
    const requiredClass = resolveRequiredCharacterClass(
      normalizeEquipCategories(['Orb', 'Weapon', 'Sorceress Item', 'Class Specific']),
    );

    // Assert
    expect(requiredClass).toBe('sorceress');
  });

  it('If the item has no class category, Then no class is required', () => {
    // Arrange / Act
    const requiredClass = resolveRequiredCharacterClass(normalizeEquipCategories(['Helm']));

    // Assert
    expect(requiredClass).toBeUndefined();
  });
});

describe('When weapon set slot ids are normalized', () => {
  it.each([
    [11, 4, 11],
    [12, 5, 12],
    [13, 4, 11],
    [14, 5, 12],
    [1, 1, 1],
  ])('Then slot %i maps to hand slot %i and occupied slot %i', (slotId, hand, occupied) => {
    // Arrange / Act / Assert
    expect(normalizeWeaponSetSlotId(slotId)).toBe(hand);
    expect(normalizeOccupiedWeaponSetSlotId(slotId)).toBe(occupied);
  });
});
