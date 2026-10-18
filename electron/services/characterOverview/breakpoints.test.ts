import { describe, expect, it } from 'vitest';
import { findBreakpoint } from './breakpoints';

describe('When findBreakpoint looks up a speed stat', () => {
  it('If the total lies between two breakpoints, then it returns the lower and the next one', () => {
    // Arrange
    const total = 110;

    // Act
    const position = findBreakpoint('sorceress', 'fasterCastRate', total);

    // Assert
    expect(position).toEqual({ reached: 105, next: 200 });
  });

  it('If the total is exactly a breakpoint, then that breakpoint is reached', () => {
    // Arrange
    const total = 75;

    // Act
    const position = findBreakpoint('warlock', 'fasterCastRate', total);

    // Assert
    expect(position).toEqual({ reached: 75, next: 125 });
  });

  it('If the total is past the last breakpoint, then there is no next one', () => {
    // Arrange
    const total = 250;

    // Act
    const position = findBreakpoint('paladin', 'fasterCastRate', total);

    // Assert
    expect(position).toEqual({ reached: 125 });
  });

  it('If the total is zero, then the first breakpoint is reached', () => {
    // Arrange
    const total = 0;

    // Act
    const position = findBreakpoint('amazon', 'fasterHitRecovery', total);

    // Assert
    expect(position).toEqual({ reached: 0, next: 6 });
  });

  it('If the class is unknown, then no position is returned', () => {
    // Arrange
    const characterClass = undefined;

    // Act
    const position = findBreakpoint(characterClass, 'fasterBlockRate', 20);

    // Assert
    expect(position).toBeUndefined();
  });
});
