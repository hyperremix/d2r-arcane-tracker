import { NUMERIC_TO_STRING_ZONE_ID } from '../data/terrorZoneNames';
import { GameMode, GameVersion, type Settings } from '../types/grail';
import { DEFAULT_RUN_TRACKER_SHORTCUTS } from './runTrackerShortcuts';
import type { WidgetSize } from './widgetDisplay';

/**
 * How one setting is stored as text in the settings table.
 *
 * This table is the single source of the setting defaults: the database seeds and parses with it
 * and the renderer starts from {@link createDefaultSettings} until the stored settings are loaded.
 */
export interface Codec<T> {
  /** Value used when nothing is stored (undefined for optional settings without a default). */
  readonly default: T;
  /** Whether the default is written to the settings table when the database is created. */
  readonly seed?: boolean;
  /**
   * Converts the stored text to the typed value.
   * @param stored - The stored text, or undefined if the setting is not stored
   */
  parse(stored: string | undefined): T;
  /** Converts a typed value to the stored text. */
  serialize(value: NonNullable<T>): string;
}

/** The codec of the setting `K`. */
export interface SettingCodec<K extends keyof Settings> extends Codec<Settings[K]> {}

/** Converts a value to the text stored in the settings table: objects as JSON, primitives as text. */
function serializeValue(value: unknown): string {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

/** Setting keys whose malformed stored value was already reported, to avoid log spam. */
const warnedKeys = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (!warnedKeys.has(key)) {
    console.warn(message);
    warnedKeys.add(key);
  }
}

function parseJson<T>(key: string, stored: string | undefined): T | undefined {
  if (!stored || stored === 'undefined' || stored === 'null') {
    return undefined;
  }
  if (stored === '[object Object]') {
    warnOnce(
      key,
      `[parseJSON] Setting "${key}" has corrupted value "[object Object]". This will be ignored.`,
    );
    return undefined;
  }
  try {
    return JSON.parse(stored) as T;
  } catch {
    warnOnce(
      key,
      `[parseJSON] Failed to parse setting "${key}" value: "${stored}". Using undefined.`,
    );
    return undefined;
  }
}

/**
 * Migrates terror zone configuration from old numeric IDs to new string IDs.
 * @param config - The config object that may contain numeric or string keys
 * @returns Migrated config with only string keys
 */
function migrateTerrorZoneConfig(
  config: Record<string | number, boolean> | undefined,
): Record<string, boolean> | undefined {
  if (!config || Object.keys(config).length === 0) {
    return undefined;
  }

  const migrated: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(config)) {
    const numericKey = Number(key);
    // Check if the key is a numeric string and can be converted to a number
    if (!Number.isNaN(numericKey) && NUMERIC_TO_STRING_ZONE_ID[numericKey]) {
      // Migrate from numeric to string ID
      migrated[NUMERIC_TO_STRING_ZONE_ID[numericKey]] = value;
    } else {
      // Already a string ID, keep as is
      migrated[key] = value;
    }
  }

  return migrated;
}

/** Text setting; an empty stored value falls back to the default. */
function text<T extends string>(defaultValue: T, seed = false): Codec<T> {
  return {
    default: defaultValue,
    seed,
    parse: (stored) => (stored as T) || defaultValue,
    serialize: serializeValue,
  };
}

/** Optional text setting without a default. */
function optionalText<T extends string>(): Codec<T | undefined> {
  return {
    default: undefined,
    parse: (stored) => (stored as T) || undefined,
    serialize: serializeValue,
  };
}

/** Boolean setting stored as `true`/`false`; nothing stored means the default. */
function flag(defaultValue: boolean, seed = false): Codec<boolean> {
  return {
    default: defaultValue,
    seed,
    parse: (stored) => (stored === undefined || stored === '' ? defaultValue : stored === 'true'),
    serialize: serializeValue,
  };
}

/** Integer setting; nothing stored or an unparsable value means the default. */
function integer<T extends number | undefined>(defaultValue: T, seed = false): Codec<T> {
  return {
    default: defaultValue,
    seed,
    parse: (stored) => {
      const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN;
      return (Number.isNaN(parsed) ? defaultValue : parsed) as T;
    },
    serialize: serializeValue,
  };
}

/** Decimal setting; nothing stored or an unparsable value means the default. */
function decimal(defaultValue: number, seed = false): Codec<number> {
  return {
    default: defaultValue,
    seed,
    parse: (stored) => {
      const parsed = stored ? Number.parseFloat(stored) : Number.NaN;
      return Number.isNaN(parsed) ? defaultValue : parsed;
    },
    serialize: serializeValue,
  };
}

/** Setting stored as JSON; nothing stored or malformed JSON means the default. */
function json<T>(key: keyof Settings, defaultValue?: T): Codec<T | undefined> {
  return {
    default: defaultValue,
    parse: (stored) => parseJson<T>(key, stored) ?? defaultValue,
    serialize: serializeValue,
  };
}

/**
 * The codec of every setting. The mapped type forces a codec for every new setting.
 */
export const SETTINGS_CODECS: { readonly [K in keyof Settings]-?: SettingCodec<K> } = {
  saveDir: text('', true),
  lang: text('en', true),
  gameMode: text<GameMode>(GameMode.Both, true),
  grailNormal: flag(true, true),
  grailEthereal: flag(false, true),
  grailRunes: flag(false, true),
  grailRunewords: flag(false, true),
  gameVersion: text<GameVersion>(GameVersion.Resurrected),
  enableSounds: flag(true, true),
  notificationVolume: {
    ...decimal(0.5, true),
    // A stored 0 also falls back to the default (behaviour kept from the previous parser)
    parse: (stored) => (stored ? Number.parseFloat(stored) : 0) || 0.5,
  },
  inAppNotifications: flag(true, true),
  nativeNotifications: flag(true, true),
  needsSeeding: flag(true, true),
  theme: text<Settings['theme']>('system', true),
  showItemIcons: flag(false, true),
  d2rInstallPath: optionalText(),
  iconConversionStatus: optionalText<NonNullable<Settings['iconConversionStatus']>>(),
  iconConversionProgress:
    json<NonNullable<Settings['iconConversionProgress']>>('iconConversionProgress'),
  tickReaderIntervalMs: integer<number | undefined>(undefined),
  chokidarPollingIntervalMs: integer<number | undefined>(undefined),
  fileStabilityThresholdMs: integer<number | undefined>(undefined),
  fileChangeDebounceMs: integer<number | undefined>(undefined),
  widgetEnabled: flag(false),
  widgetDisplay: text<NonNullable<Settings['widgetDisplay']>>('overall'),
  widgetPosition: json<NonNullable<Settings['widgetPosition']>>('widgetPosition'),
  widgetOpacity: decimal(0.9),
  widgetSizeOverall: json<WidgetSize>('widgetSizeOverall'),
  widgetSizeSplit: json<WidgetSize>('widgetSizeSplit'),
  widgetSizeAll: json<WidgetSize>('widgetSizeAll'),
  widgetSizeRunOnly: json<WidgetSize>('widgetSizeRunOnly'),
  widgetLocked: flag(false),
  widgetRunOnlyShowItems: flag(true),
  mainWindowBounds: json<NonNullable<Settings['mainWindowBounds']>>('mainWindowBounds'),
  wizardCompleted: flag(false, true),
  wizardSkipped: flag(false, true),
  terrorZoneConfig: {
    default: undefined,
    parse: (stored) =>
      migrateTerrorZoneConfig(
        parseJson<Record<string | number, boolean>>('terrorZoneConfig', stored),
      ),
    serialize: serializeValue,
  },
  terrorZoneBackupCreated: flag(false),
  runTrackerAutoStart: flag(true, true),
  runTrackerEndThreshold: integer(10, true),
  runTrackerMemoryReading: flag(false, true),
  runTrackerMemoryPollingInterval: integer(500, true),
  runTrackerShortcuts: json<NonNullable<Settings['runTrackerShortcuts']>>(
    'runTrackerShortcuts',
    DEFAULT_RUN_TRACKER_SHORTCUTS,
  ),
  runTrackerGlobalHotkeys: flag(false),
};

const SETTING_KEYS = Object.keys(SETTINGS_CODECS) as (keyof Settings)[];

/** Returns a copy of a default, so callers can't change the shared default objects. */
function copyDefault<T>(value: T): T {
  return typeof value === 'object' && value !== null ? structuredClone(value) : value;
}

/**
 * Creates the default settings: what the app uses when nothing is stored.
 * @returns A new settings object; optional settings without a default are left out
 */
export function createDefaultSettings(): Settings {
  const settings: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    const defaultValue = SETTINGS_CODECS[key].default;
    if (defaultValue !== undefined) {
      settings[key] = copyDefault(defaultValue);
    }
  }
  return settings as Settings;
}

/**
 * Parses the stored settings rows into typed settings, using the default for missing settings.
 * @param stored - Stored text by setting key
 * @returns The typed settings
 */
export function parseSettings(stored: Readonly<Record<string, string | undefined>>): Settings {
  const settings: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    settings[key] = copyDefault(SETTINGS_CODECS[key].parse(stored[key]));
  }
  return settings as Settings;
}

/**
 * Converts a setting value to the text stored in the settings table.
 * @param key - The setting
 * @param value - The typed value; undefined clears the setting
 * @returns The text to store (empty for undefined)
 */
export function serializeSetting<K extends keyof Settings>(key: K, value: Settings[K]): string {
  if (value === undefined || value === null) {
    return '';
  }
  const codec = SETTINGS_CODECS[key] as SettingCodec<K>;
  return codec.serialize(value as NonNullable<Settings[K]>);
}

/**
 * The settings written to the settings table when the database is created, with their text.
 * @returns Key and stored text of every seeded setting
 */
export function getSeededSettings(): Array<{ key: keyof Settings; value: string }> {
  return SETTING_KEYS.filter((key) => SETTINGS_CODECS[key].seed).map((key) => ({
    key,
    value: serializeSetting(key, SETTINGS_CODECS[key].default),
  }));
}
