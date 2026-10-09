// @vitest-environment node
import type { Database as DatabaseType } from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDrizzleDb } from '../database/drizzle';
import * as settingsModule from '../database/settings';
import type { DatabaseContext } from '../database/types';
import { createInMemoryDatabase, initializeDatabaseSchema } from '../test/helpers/databaseHelpers';
import { EventBus } from './EventBus';
import { SettingsService, type SettingsStore } from './settingsService';

describe('When settings are changed through the settings service', () => {
  let rawDb: DatabaseType;
  let ctx: DatabaseContext;
  let eventBus: EventBus;
  let service: SettingsService;

  function storedValue(key: string): string | undefined {
    const row = rawDb.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  beforeEach(() => {
    rawDb = createInMemoryDatabase();
    initializeDatabaseSchema(rawDb);
    ctx = { rawDb, db: createDrizzleDb(rawDb), dbPath: ':memory:' };
    const store: SettingsStore = {
      getAllSettings: () => settingsModule.getAllSettings(ctx),
      setSetting: (key, value) => settingsModule.setSetting(ctx, key, value),
      transaction: (fn) => rawDb.transaction(fn)(),
    };
    eventBus = new EventBus();
    service = new SettingsService(store, eventBus);
  });

  afterEach(() => {
    rawDb.close();
  });

  describe('If one setting is set', () => {
    it('Then it is stored as codec text and listeners receive the change', () => {
      // Arrange
      const listener = vi.fn();
      service.onUpdated(listener);

      // Act
      service.set('widgetPosition', { x: 5, y: 7 });

      // Assert
      expect(storedValue('widgetPosition')).toBe('{"x":5,"y":7}');
      expect(service.get('widgetPosition')).toEqual({ x: 5, y: 7 });
      expect(listener).toHaveBeenCalledWith({ widgetPosition: { x: 5, y: 7 } });
    });
  });

  describe('If a setting is set to undefined', () => {
    it('Then the stored value is cleared', () => {
      // Arrange
      service.set('terrorZoneConfig', { 'Act1-Pit': true });

      // Act
      service.set('terrorZoneConfig', undefined);

      // Assert
      expect(storedValue('terrorZoneConfig')).toBe('');
      expect(service.get('terrorZoneConfig')).toBeUndefined();
    });
  });

  describe('If several settings are updated', () => {
    it('Then the defined values are stored and listeners are notified once', () => {
      // Arrange
      const listener = vi.fn();
      service.onUpdated(listener);

      // Act
      const stored = service.update({
        runTrackerMemoryReading: true,
        runTrackerMemoryPollingInterval: 250,
        theme: undefined,
      });

      // Assert
      expect(storedValue('runTrackerMemoryReading')).toBe('true');
      expect(storedValue('runTrackerMemoryPollingInterval')).toBe('250');
      expect(storedValue('theme')).toBeUndefined();
      expect(stored).toEqual({
        runTrackerMemoryReading: true,
        runTrackerMemoryPollingInterval: 250,
      });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(stored);
    });

    it('If no value is defined, Then nothing is stored and listeners are not notified', () => {
      // Arrange
      const listener = vi.fn();
      service.onUpdated(listener);

      // Act
      service.update({ theme: undefined });

      // Assert
      expect(storedValue('theme')).toBeUndefined();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('If the settings were replaced by a database restore', () => {
    it('Then listeners receive all restored settings', () => {
      // Arrange
      settingsModule.setSetting(ctx, 'gameMode', 'manual');
      const listener = vi.fn();
      service.onUpdated(listener);

      // Act
      service.notifyRestored();

      // Assert
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ gameMode: 'manual' }));
    });
  });

  describe('If a listener unsubscribes', () => {
    it('Then it no longer receives changes', () => {
      // Arrange
      const listener = vi.fn();
      const unsubscribe = service.onUpdated(listener);

      // Act
      unsubscribe();
      service.set('widgetLocked', true);

      // Assert
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
