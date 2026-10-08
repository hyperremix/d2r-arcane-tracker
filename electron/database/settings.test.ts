import { describe, expect, it } from 'vitest';
import { getAllSettings } from './settings';
import type { DatabaseContext } from './types';

/**
 * Builds a database context whose settings table contains the given key/value rows.
 */
function createContext(rows: Record<string, string>): DatabaseContext {
  const settingRows = Object.entries(rows).map(([key, value]) => ({ key, value }));
  return {
    db: { select: () => ({ from: () => ({ all: () => settingRows }) }) },
  } as unknown as DatabaseContext;
}

describe('When widget settings are read from the database', () => {
  it('If nothing is stored, Then the widget is unlocked and the run-only item list is shown', () => {
    // Arrange
    const ctx = createContext({});

    // Act
    const settings = getAllSettings(ctx);

    // Assert
    expect(settings.widgetLocked).toBe(false);
    expect(settings.widgetRunOnlyShowItems).toBe(true);
    expect(settings.widgetSizeRunOnly).toBeUndefined();
  });

  it('If widget preferences are stored, Then the lock, item list flag and run-only size are parsed', () => {
    // Arrange
    const ctx = createContext({
      widgetLocked: 'true',
      widgetRunOnlyShowItems: 'false',
      widgetSizeRunOnly: JSON.stringify({ width: 280, height: 400 }),
    });

    // Act
    const settings = getAllSettings(ctx);

    // Assert
    expect(settings.widgetLocked).toBe(true);
    expect(settings.widgetRunOnlyShowItems).toBe(false);
    expect(settings.widgetSizeRunOnly).toEqual({ width: 280, height: 400 });
  });
});
