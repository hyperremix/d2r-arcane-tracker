import { describe, expect, it } from 'vitest';
import {
  clampWidgetOpacity,
  DEFAULT_WIDGET_OPACITY,
  MIN_WIDGET_OPACITY,
  resolveWidgetDisplayMode,
} from './widget';

describe('When clampWidgetOpacity is called', () => {
  it('If the value is below the minimum, Then it returns the minimum opacity', () => {
    // Arrange
    const storedOpacity = 0;

    // Act
    const result = clampWidgetOpacity(storedOpacity);

    // Assert
    expect(result).toBe(MIN_WIDGET_OPACITY);
  });

  it('If the value is within range, Then it returns the value unchanged', () => {
    // Arrange
    const storedOpacity = 0.55;

    // Act
    const result = clampWidgetOpacity(storedOpacity);

    // Assert
    expect(result).toBe(0.55);
  });

  it('If the value is above the maximum, Then it returns full opacity', () => {
    // Arrange
    const storedOpacity = 1.4;

    // Act
    const result = clampWidgetOpacity(storedOpacity);

    // Assert
    expect(result).toBe(1);
  });

  it('If the value is missing or not a number, Then it returns the default opacity', () => {
    // Arrange
    const values = [undefined, Number.NaN];

    // Act
    const results = values.map((value) => clampWidgetOpacity(value));

    // Assert
    expect(results).toEqual([DEFAULT_WIDGET_OPACITY, DEFAULT_WIDGET_OPACITY]);
  });
});

describe('When resolveWidgetDisplayMode is called', () => {
  it('If ethereal tracking is off and mode is split, Then it falls back to overall', () => {
    // Arrange
    const grailEthereal = false;

    // Act
    const result = resolveWidgetDisplayMode('split', grailEthereal);

    // Assert
    expect(result).toBe('overall');
  });

  it('If ethereal tracking is off and mode is all, Then it falls back to overall', () => {
    // Arrange
    const grailEthereal = undefined;

    // Act
    const result = resolveWidgetDisplayMode('all', grailEthereal);

    // Assert
    expect(result).toBe('overall');
  });

  it('If ethereal tracking is on, Then it keeps the split mode', () => {
    // Arrange
    const grailEthereal = true;

    // Act
    const result = resolveWidgetDisplayMode('split', grailEthereal);

    // Assert
    expect(result).toBe('split');
  });

  it('If ethereal tracking is off and mode is run-only, Then it keeps run-only', () => {
    // Arrange
    const grailEthereal = false;

    // Act
    const result = resolveWidgetDisplayMode('run-only', grailEthereal);

    // Assert
    expect(result).toBe('run-only');
  });

  it('If no mode is stored, Then it defaults to overall', () => {
    // Arrange
    const displayMode = undefined;

    // Act
    const result = resolveWidgetDisplayMode(displayMode, true);

    // Assert
    expect(result).toBe('overall');
  });
});
