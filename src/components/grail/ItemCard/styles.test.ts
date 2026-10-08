import type { ItemType } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { getCardStateClasses, getItemQualityTextClass } from './styles';

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

describe('When getCardStateClasses is called', () => {
  it('If the item is found, Then it returns a solid quality frame with an inner quality line', () => {
    // Arrange
    const type: ItemType = 'set';

    // Act
    const classes = getCardStateClasses(type, true).split(' ');

    // Assert
    expect(classes).toEqual(
      expect.arrayContaining([
        'border-solid',
        'border-item-set',
        'inset-ring-1',
        'inset-ring-item-set/25',
        'bg-card',
      ]),
    );
  });

  it('If the item is missing, Then it returns a dashed softened border without the inner frame', () => {
    // Arrange
    const type: ItemType = 'rune';

    // Act
    const classes = getCardStateClasses(type, false).split(' ');

    // Assert
    expect(classes).toEqual(
      expect.arrayContaining(['border-dashed', 'border-item-rune/60', 'bg-muted/40']),
    );
    expect(classes).not.toContain('inset-ring-1');
  });

  it.each([
    true,
    false,
  ])('If found is %s and the card is interactive, Then hover uses a quality glow instead of scaling', (isFound) => {
    // Arrange
    const type: ItemType = 'runeword';

    // Act
    const classes = getCardStateClasses(type, isFound, true);

    // Assert
    expect(classes).toContain('hover:ring-2');
    expect(classes).toContain('hover:ring-item-runeword/40');
    expect(classes).not.toMatch(/scale-/);
    expect(classes).not.toMatch(/(^|\s)transition-all/);
  });

  it('If a found card is interactive, Then it also lifts its shadow on hover', () => {
    // Arrange
    const type: ItemType = 'unique';

    // Act
    const classes = getCardStateClasses(type, true, true).split(' ');

    // Assert
    expect(classes).toContain('hover:shadow-md');
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
    expect(classes).toContain('border-item-set');
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
