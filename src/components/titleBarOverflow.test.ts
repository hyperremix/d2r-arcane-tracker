import { describe, expect, it } from 'vitest';
import { getTitleBarOverflow } from './titleBarOverflow';

/** Three destinations of 100px with 4px between them take 308px; the More trigger is 60px. */
const BASE = {
  nameWidth: 150,
  itemWidths: [100, 100, 100],
  moreWidth: 60,
  listGap: 4,
  nameGap: 8,
};

describe('When getTitleBarOverflow is called', () => {
  it('If every destination and the app name fit, Then all destinations and the name are shown', () => {
    // Arrange
    const availableWidth = 308 + 8 + 150;

    // Act
    const result = getTitleBarOverflow({ ...BASE, availableWidth });

    // Assert
    expect(result).toEqual({ visibleCount: 3, showName: true });
  });

  it('If every destination fits but the app name does not, Then the name collapses before any destination moves', () => {
    // Arrange
    const availableWidth = 308 + 8 + 150 - 1;

    // Act
    const result = getTitleBarOverflow({ ...BASE, availableWidth });

    // Assert
    expect(result).toEqual({ visibleCount: 3, showName: false });
  });

  it('If the destinations do not fit, Then the last ones move into the More menu', () => {
    // Arrange - two destinations, the More trigger and two gaps take 268px
    const availableWidth = 300;

    // Act
    const result = getTitleBarOverflow({ ...BASE, availableWidth });

    // Assert
    expect(result).toEqual({ visibleCount: 2, showName: false });
  });

  it('If only the More trigger fits next to one destination, Then one destination stays visible', () => {
    // Arrange - one destination, the More trigger and one gap take 164px
    const availableWidth = 164;

    // Act
    const result = getTitleBarOverflow({ ...BASE, availableWidth });

    // Assert
    expect(result).toEqual({ visibleCount: 1, showName: false });
  });

  it('If not even one destination fits next to the More trigger, Then every destination moves into the More menu', () => {
    // Arrange
    const availableWidth = 100;

    // Act
    const result = getTitleBarOverflow({ ...BASE, availableWidth });

    // Assert
    expect(result).toEqual({ visibleCount: 0, showName: false });
  });

  it('If nothing has been laid out yet (all widths 0), Then everything is shown', () => {
    // Arrange & Act
    const result = getTitleBarOverflow({
      availableWidth: 0,
      nameWidth: 0,
      itemWidths: [0, 0, 0],
      moreWidth: 0,
      listGap: 0,
      nameGap: 0,
    });

    // Assert
    expect(result).toEqual({ visibleCount: 3, showName: true });
  });
});
