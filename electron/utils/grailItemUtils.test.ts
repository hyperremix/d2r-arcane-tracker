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
});
