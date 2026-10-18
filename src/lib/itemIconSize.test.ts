import { describe, expect, it } from 'vitest';
import { getGrailItemIconSize, getListRowHeightEstimate } from './itemIconSize';

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

describe('When the height of a list row is estimated', () => {
  it.each([
    ['default', 80],
    ['large', 128],
    ['extraLarge', 176],
  ] as const)('If the preset is %s, Then the row is %ipx high', (iconSize, height) => {
    // Act
    const estimate = getListRowHeightEstimate(iconSize);

    // Assert
    expect(estimate).toBe(height);
  });
});
