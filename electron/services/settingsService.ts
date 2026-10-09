import type { GrailDatabase } from '../database/database';
import type { Settings } from '../types/grail';
import { serializeSetting } from '../utils/settingsCodec';
import type { EventBus } from './EventBus';

type SettingEntry = [keyof Settings, Settings[keyof Settings]];

/** Database operations the settings service needs. */
export type SettingsStore = Pick<GrailDatabase, 'getAllSettings' | 'setSetting' | 'transaction'>;

/**
 * Reads and writes the app settings. Every write goes through this service, which stores the value
 * through the settings codec and then emits `settings-updated` on the event bus, so main-process
 * services (run tracker, global hotkeys) can react to changes without a restart.
 */
export class SettingsService {
  constructor(
    private readonly database: SettingsStore,
    private readonly eventBus: EventBus,
  ) {}

  /** Returns all settings; settings that are not stored have their default. */
  getAll(): Settings {
    return this.database.getAllSettings();
  }

  /**
   * Returns one setting.
   * @param key - The setting
   */
  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.getAll()[key];
  }

  /**
   * Stores one setting and notifies the listeners.
   * @param key - The setting
   * @param value - The new value; undefined clears the stored value
   */
  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.database.setSetting(key, serializeSetting(key, value));
    this.eventBus.emit('settings-updated', { [key]: value } as Partial<Settings>);
  }

  /**
   * Stores several settings in one transaction and notifies the listeners once.
   * Settings whose value is undefined are left unchanged.
   * @param changes - The settings to change
   * @returns The settings that were stored
   */
  update(changes: Partial<Settings>): Partial<Settings> {
    const entries = Object.entries(changes).filter(
      ([, value]) => value !== undefined,
    ) as SettingEntry[];
    if (entries.length === 0) {
      return {};
    }

    this.database.transaction(() => {
      for (const [key, value] of entries) {
        this.database.setSetting(key, serializeSetting(key, value));
      }
    });

    const stored = Object.fromEntries(entries) as Partial<Settings>;
    this.eventBus.emit('settings-updated', stored);
    return stored;
  }

  /**
   * Notifies the listeners with all settings after they were replaced without this service (a
   * database restore), so the main process follows the restored values (e.g. the game mode).
   */
  notifyRestored(): void {
    try {
      this.eventBus.emit('settings-updated', this.getAll());
    } catch (error) {
      console.error('Failed to notify listeners about restored settings:', error);
    }
  }

  /**
   * Subscribes to stored setting changes.
   * @param listener - Called with the changed settings after they were stored
   * @returns Function that removes the listener
   */
  onUpdated(listener: (changes: Partial<Settings>) => void): () => void {
    return this.eventBus.on('settings-updated', listener);
  }
}
