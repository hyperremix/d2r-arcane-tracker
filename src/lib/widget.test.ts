import { describe, expect, it } from 'vitest';
import {
  clampWidgetOpacity,
  DEFAULT_WIDGET_OPACITY,
  getDefaultWidgetSize,
  getWidgetSizeSettingKey,
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

describe('When getWidgetSizeSettingKey is called', () => {
  it.each([
    ['overall', 'widgetSizeOverall'],
    ['split', 'widgetSizeSplit'],
    ['all', 'widgetSizeAll'],
    ['run-only', 'widgetSizeRunOnly'],
  ] as const)('If the display mode is %s, Then it returns %s', (displayMode, expectedKey) => {
    // Arrange: the display mode comes from the test table

    // Act
    const key = getWidgetSizeSettingKey(displayMode);

    // Assert
    expect(key).toBe(expectedKey);
  });
});

describe('When getDefaultWidgetSize is called', () => {
  it('If run-only shows the item list, Then it is taller than the stats-only layout', () => {
    // Arrange
    const showItems = true;

    // Act
    const withItems = getDefaultWidgetSize('run-only', showItems);
    const statsOnly = getDefaultWidgetSize('run-only', false);

    // Assert
    expect(withItems).toEqual({ width: 270, height: 320 });
    expect(statsOnly).toEqual({ width: 270, height: 190 });
  });

  it('If the item list flag is not stored, Then run-only defaults to the item list layout', () => {
    // Arrange
    const showItems = undefined;

    // Act
    const size = getDefaultWidgetSize('run-only', showItems);

    // Assert
    expect(size).toEqual({ width: 270, height: 320 });
  });

  it('If the returned size is changed, Then the stored defaults stay untouched', () => {
    // Arrange
    const size = getDefaultWidgetSize('overall', undefined);

    // Act
    size.width = 1;

    // Assert
    expect(getDefaultWidgetSize('overall', undefined)).toEqual({ width: 250, height: 250 });
  });
});
