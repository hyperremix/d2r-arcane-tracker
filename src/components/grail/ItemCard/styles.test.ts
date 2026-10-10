import type { ItemType } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import {
  getCardStateClasses,
  getItemNameClasses,
  getItemQualityTextClass,
  getVersionPillClasses,
} from './styles';

describe('When getItemQualityTextClass is called', () => {
  it.each([
    ['unique', 'text-item-unique'],
    ['set', 'text-item-set'],
    ['rune', 'text-item-rune'],
    ['runeword', 'text-item-runeword'],
  ] as const)('If the item type is %s, Then it returns %s', (itemType, expected) => {
    // Arrange
    const type: ItemType = itemType;

    // Act
    const result = getItemQualityTextClass(type);

    // Assert
    expect(result).toBe(expected);
  });

  it('If the item type is unknown, Then it falls back to the foreground color', () => {
    // Arrange
    const type = 'magic' as ItemType;

    // Act
    const result = getItemQualityTextClass(type);

    // Assert
    expect(result).toBe('text-foreground');
  });
});

describe('When getItemNameClasses is called', () => {
  it.each([
    ['unique', 'text-item-unique'],
    ['set', 'text-item-set'],
    ['rune', 'text-item-rune'],
    ['runeword', 'text-item-runeword'],
  ] as const)('If a %s item is found, Then the name is lit in %s and bold', (type, expected) => {
    // Arrange
    const isFound = true;

    // Act
    const classes = getItemNameClasses(type, isFound).split(' ');

    // Assert
    expect(classes).toEqual(expect.arrayContaining([expected, 'font-semibold']));
  });

  it.each([
    'unique',
    'set',
    'rune',
    'runeword',
  ] as const)('If a %s item is missing, Then the name uses the muted neutral color', (type) => {
    // Arrange
    const isFound = false;

    // Act
    const classes = getItemNameClasses(type, isFound);

    // Assert
    expect(classes.split(' ')).toContain('text-muted-foreground');
    expect(classes).not.toMatch(/text-item-/);
    expect(classes).not.toMatch(/font-semibold/);
  });
});

describe('When getCardStateClasses is called', () => {
  it('If the item is found, Then it returns a quality-colored hairline border on the card surface', () => {
    // Arrange
    const type: ItemType = 'set';

    // Act
    const classes = getCardStateClasses(type, true).split(' ');

    // Assert
    expect(classes).toEqual(expect.arrayContaining(['border-item-set/60', 'bg-card']));
    expect(classes).not.toContain('border-dashed');
    expect(classes.some((cls) => cls.includes('inset-ring'))).toBe(false);
  });

  it.each([
    'unique',
    'set',
    'rune',
    'runeword',
  ] as const)('If a %s item is missing, Then it returns a neutral border and muted surface without any quality color', (type) => {
    // Arrange
    const isFound = false;

    // Act
    const classes = getCardStateClasses(type, isFound, true);

    // Assert
    expect(classes.split(' ')).toEqual(expect.arrayContaining(['border-border', 'bg-muted/40']));
    expect(classes).not.toMatch(/item-/);
  });

  it('If a found card is interactive, Then hover strengthens its quality border and lifts its shadow', () => {
    // Arrange
    const type: ItemType = 'runeword';

    // Act
    const classes = getCardStateClasses(type, true, true).split(' ');

    // Assert
    expect(classes).toEqual(
      expect.arrayContaining(['hover:border-item-runeword', 'hover:shadow-md']),
    );
  });

  it.each([
    true,
    false,
  ])('If found is %s and the card is interactive, Then hover neither scales nor adds a colored ring', (isFound) => {
    // Arrange
    const type: ItemType = 'runeword';

    // Act
    const classes = getCardStateClasses(type, isFound, true);

    // Assert
    expect(classes).not.toMatch(/scale-/);
    expect(classes).not.toMatch(/hover:ring/);
    expect(classes).not.toMatch(/(^|\s)transition-all/);
  });

  it.each([
    true,
    false,
  ])('If found is %s and the card is not interactive, Then it has no hover or transition classes', (isFound) => {
    // Arrange
    const type: ItemType = 'set';

    // Act
    const classes = getCardStateClasses(type, isFound);

    // Assert
    expect(classes).not.toMatch(/hover:/);
    expect(classes).not.toMatch(/transition/);
  });

  it('If the card is interactive, Then the hover transition only runs when motion is allowed', () => {
    // Arrange
    const type: ItemType = 'unique';

    // Act
    const classes = getCardStateClasses(type, true, true).split(' ');

    // Assert
    const transitionClasses = classes.filter((cls) => cls.includes('transition'));
    expect(transitionClasses.length).toBeGreaterThan(0);
    for (const cls of transitionClasses) {
      expect(cls.startsWith('motion-safe:')).toBe(true);
    }
  });
});

describe('When getVersionPillClasses is called', () => {
  it('If the version is found, Then the pill is solid and lit in the quality color', () => {
    // Arrange
    const type: ItemType = 'unique';

    // Act
    const classes = getVersionPillClasses(type, true).split(' ');

    // Assert
    expect(classes).toEqual(
      expect.arrayContaining(['border-solid', 'text-item-unique', 'bg-item-unique/10']),
    );
  });

  it('If the version is missing, Then the pill is dashed and muted without a quality color', () => {
    // Arrange
    const type: ItemType = 'unique';

    // Act
    const classes = getVersionPillClasses(type, false);

    // Assert
    expect(classes.split(' ')).toEqual(
      expect.arrayContaining(['border-dashed', 'text-muted-foreground']),
    );
    expect(classes).not.toMatch(/item-/);
  });
});
