import { describe, expect, it } from 'vitest';
import { getGrailItemIconSize } from './itemIconSize';

describe('When the icon size of the grail page is resolved', () => {
  it.each([
    [true, 'large', 'large'],
    [true, undefined, 'default'],
    [false, 'extraLarge', 'default'],
  ] as const)('If item icons are shown is %s and the preset is %s, Then %s is used', (showItemIcons, itemIconSize, expected) => {
    // Act
    const iconSize = getGrailItemIconSize({ showItemIcons, itemIconSize });

    // Assert
    expect(iconSize).toBe(expected);
  });
});
