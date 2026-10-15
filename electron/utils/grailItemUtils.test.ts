import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import { describe, expect, it } from 'vitest';
import { getGrailItemId } from './grailItemUtils';

describe('When getGrailItemId is called for a rune', () => {
  it('If the rune type is a lowercase d2s code, Then returns the rune id', () => {
    // Arrange
    const item = { type: 'r01' };

    // Act
    const result = getGrailItemId(item);

    // Assert
    expect(result).toBe('el');
  });

  it('If the rune type is upper-cased or padded, Then resolves the same rune as the normalized code', () => {
    // Arrange
    const items = [{ type: 'R01' }, { type: ' r01 ' }, { type: 'r01\0\0' }];

    // Act
    const result = items.map((item) => getGrailItemId(item));

    // Assert
    expect(result).toEqual(['el', 'el', 'el']);
  });

  it('If the rune code matches the pattern but is not a known rune, Then returns null', () => {
    // Arrange
    const item = { type: 'r39', unique_name: 'Harlequin Crest' };

    // Act
    const result = getGrailItemId(item);

    // Assert
    expect(result).toBeNull();
  });
});

describe('When getGrailItemId is called for a non-rune item', () => {
  it('If the type is not a rune code, Then falls through to the unique name lookup', () => {
    // Arrange
    const item = { type: 'uap', unique_name: 'Harlequin Crest' };

    // Act
    const result = getGrailItemId(item);

    // Assert
    expect(result).toBe('harlequincrest');
  });

  it('If a unique shares its name with a runeword, Then returns the unique, not the runeword', () => {
    // Arrange
    const item = { type: 'amu', unique_name: 'Crescent Moon' };

    // Act
    const result = getGrailItemId(item);

    // Assert
    expect(result).toBe('crescentmoon-amulet');
  });

  it('If the runeword name is the d2s "Love" bug, Then returns the Lore runeword', () => {
    // Arrange
    const item = { type: 'cap', runeword_name: 'Love' };

    // Act
    const result = getGrailItemId(item);

    // Assert
    expect(result).toBe('lore');
  });

  it('If the runeword is Hustle, Then returns Hysteria for body armor and Mania for weapons', () => {
    // Arrange
    const items = [
      { type: 'uui', runeword_name: 'Hustle' },
      { type: '7cr', runeword_name: 'Hustle' },
    ];

    // Act
    const result = items.map((item) => getGrailItemId(item));

    // Assert
    expect(result).toEqual(['hysteria', 'mania']);
  });
});

describe('When getGrailItemId is called for an item parsed with the v105 constant data', () => {
  it('If the parser reports an internal name, Then returns the catalog item of the in-game name', () => {
    // Arrange
    const items = [
      { type: 'bst', unique_name: 'Iros Torch' },
      { type: 'waf', unique_name: "Ars Al'Diablolos" },
      { type: 'zmb', set_name: "Tal Rasha's Fine-Spun Cloth" },
    ];

    // Act
    const result = items.map((item) => getGrailItemId(item));

    // Assert
    expect(result).toEqual(['torchofiro', 'arsaldiabolos', 'talrashasfinespuncloth']);
  });

  it('If the item is a PreCrafted or Crafted sunder charm, Then returns the Latent or Renewed charm', () => {
    // Arrange
    const items = [
      { type: 'cm3', unique_name: 'PreCrafted Cold Rupture' },
      { type: 'cs2', unique_name: 'Crafted Cold Rupture' },
      { type: 'cm3', unique_name: 'Cold Rupture' },
    ];

    // Act
    const result = items.map((item) => getGrailItemId(item));

    // Assert
    expect(result).toEqual(['latentcoldrupture', 'renewedcoldrupture', 'coldrupture']);
  });

  it('If the item is any unique or set item of the game data, Then it resolves to a catalog item', () => {
    // Arrange
    // Quest items, unused game data rows and Rainbow Facets (resolved by their stats) are no grail items
    const nonGrailNames = new Set([
      'Amulet of the Viper',
      'Staff of Kings',
      'Horadric Staff',
      'Hell Forge Hammer',
      'KhalimFlail',
      "Khalim's Will",
      'Constricting Ring',
      'Darkfear',
      'Rainbow Facet',
      "Warlord's Conquest",
      "Warlord's Lust",
      "Warlord's Mantle",
      "Warlord's Crushers",
      "Warlord's Authority",
    ]);
    const toNames = (entries: Array<{ n?: string; c?: string } | null>) =>
      entries.flatMap((entry) =>
        entry?.n && entry.c && !nonGrailNames.has(entry.n) ? [entry.n] : [],
      );
    const uniqueNames = toNames(constants105.unq_items);
    const setNames = toNames(constants105.set_items);

    // Act
    const unresolved = [
      ...uniqueNames.filter((name) => !getGrailItemId({ unique_name: name })),
      ...setNames.filter((name) => !getGrailItemId({ set_name: name })),
    ];

    // Assert
    expect(unresolved).toEqual([]);
  });
});
