import { describe, expect, it, vi } from 'vitest';
import { createInMemoryDatabase } from '../test/helpers/databaseHelpers';
import { createDrizzleDb } from './drizzle';
import { initializeSchema } from './schema';
import { getAllSettings, setSetting } from './settings';
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

describe('When the database schema is initialized', () => {
  function createSchemaContext(): DatabaseContext {
    const rawDb = createInMemoryDatabase();
    return { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
  }

  it('Then the default settings are stored, and settings changed later are kept on restart', () => {
    // Arrange
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const ctx = createSchemaContext();
    initializeSchema(ctx);
    const storedDefault = ctx.rawDb
      .prepare("SELECT value FROM settings WHERE key = 'grailNormal'")
      .get() as { value: string };
    setSetting(ctx, 'grailNormal', 'false');

    // Act
    initializeSchema(ctx);

    // Assert
    expect(storedDefault.value).toBe('true');
    expect(getAllSettings(ctx).grailNormal).toBe(false);
    consoleLog.mockRestore();
    ctx.rawDb.close();
  });

  it('If the database is new, Then exactly the seeded settings rows are stored', () => {
    // Arrange
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const ctx = createSchemaContext();

    // Act
    initializeSchema(ctx);

    // Assert
    // The item catalog hash is bookkeeping of the item sync, not a setting
    const rows = ctx.rawDb
      .prepare("SELECT key, value FROM settings WHERE key != 'grailItemCatalogHash'")
      .all() as Array<{
      key: string;
      value: string;
    }>;
    expect(Object.fromEntries(rows.map(({ key, value }) => [key, value]))).toEqual({
      saveDir: '',
      lang: 'en',
      gameMode: 'both',
      grailNormal: 'true',
      grailEthereal: 'false',
      grailRunes: 'false',
      grailRunewords: 'false',
      enableSounds: 'true',
      notificationVolume: '0.5',
      inAppNotifications: 'true',
      nativeNotifications: 'true',
      needsSeeding: 'true',
      theme: 'system',
      showItemIcons: 'false',
      wizardCompleted: 'false',
      wizardSkipped: 'false',
      runTrackerAutoStart: 'true',
      runTrackerEndThreshold: '10',
      // Turned on by the one-time run tracker migration, which runs before the defaults are added
      runTrackerMemoryReading: 'true',
      runTrackerMemoryPollingInterval: '500',
    });
    consoleLog.mockRestore();
    ctx.rawDb.close();
  });
});
