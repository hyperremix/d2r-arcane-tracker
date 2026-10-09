import type {
  GrailProgress,
  InventoryItemMoveInput,
  InventorySnapshotWindowTarget,
  InventoryStackSplitInput,
  Settings,
  VaultItemFilter,
  VaultItemUpsertInput,
} from '../types/grail';
import { MAX_SESSION_NOTES_LENGTH } from '../utils/sessionNotes';
import type { WidgetDisplayMode } from '../utils/widgetDisplay';
import {
  type AddRunItemInput,
  type FileDialogFilter,
  type InvokeArgs,
  type InvokeChannel,
  OPEN_DIALOG_PROPERTIES,
  type OpenFileDialogOptions,
  SAVE_DIALOG_PROPERTIES,
  type SaveFileDialogOptions,
  type TitleBarOverlayColors,
  type UnvaultTargetOptions,
} from './contract';
import {
  type ArgsValidator,
  args,
  boolean,
  ensure,
  type FieldValidator,
  finiteNumber,
  IpcValidationError,
  isPlainObject,
  noArgs,
  nonEmptyString,
  optional,
  plainObject,
  string,
  validatedByHandler,
} from './validation';

const optionalString = (message: string) => optional(string(message));

/**
 * Validates the options of a native file dialog.
 * @param allowedProperties - Dialog properties the renderer may request
 */
function fileDialogOptions<T extends OpenFileDialogOptions | SaveFileDialogOptions>(
  allowedProperties: readonly string[],
): FieldValidator<T> {
  return (value) => {
    ensure(isPlainObject(value), 'Invalid dialog options: expected an object');
    optionalString('Invalid dialog title')(value.title);
    optionalString('Invalid dialog default path')(value.defaultPath);
    if (value.filters !== undefined) {
      ensure(
        Array.isArray(value.filters) && value.filters.every(isFileDialogFilter),
        'Invalid dialog filters',
      );
    }
    if (value.properties !== undefined) {
      ensure(
        Array.isArray(value.properties) &&
          value.properties.every((property) => allowedProperties.includes(property)),
        'Invalid dialog properties',
      );
    }
    return {
      title: value.title,
      defaultPath: value.defaultPath,
      filters: value.filters,
      properties: value.properties,
    } as T;
  };
}

function isFileDialogFilter(value: unknown): value is FileDialogFilter {
  return (
    isPlainObject(value) &&
    typeof value.name === 'string' &&
    Array.isArray(value.extensions) &&
    value.extensions.every((extension) => typeof extension === 'string')
  );
}

const titleBarOverlayColors: FieldValidator<TitleBarOverlayColors> = (value) => {
  ensure(
    isPlainObject(value) &&
      typeof value.backgroundColor === 'string' &&
      typeof value.symbolColor === 'string',
    'Invalid title bar overlay colors',
  );
  return { backgroundColor: value.backgroundColor, symbolColor: value.symbolColor };
};

const terrorZoneConfig: FieldValidator<Record<string, boolean>> = (value) => {
  ensure(
    isPlainObject(value) && Object.values(value).every((enabled) => typeof enabled === 'boolean'),
    'Invalid terror zone config: expected zone IDs mapped to booleans',
  );
  return value as Record<string, boolean>;
};

const addRunItemInput: FieldValidator<AddRunItemInput> = (value) => {
  ensure(isPlainObject(value), 'Invalid run item: expected an object');
  const runId = nonEmptyString('Invalid run ID')(value.runId);
  const name = optionalString('Invalid run item name')(value.name);
  const grailProgressId = optionalString('Invalid grail progress ID')(value.grailProgressId);
  ensure(
    Boolean(name) || Boolean(grailProgressId),
    'Either name or grailProgressId must be provided',
  );
  const { foundTime } = value;
  ensure(
    foundTime === undefined || (foundTime instanceof Date && !Number.isNaN(foundTime.getTime())),
    'Invalid found time',
  );
  return { runId, name, grailProgressId, foundTime };
};

const sessionId = nonEmptyString('Invalid session ID');

const sessionNotes: FieldValidator<string> = (value) => {
  const notes = string('Invalid session notes')(value);
  ensure(
    notes.length <= MAX_SESSION_NOTES_LENGTH,
    `Invalid session notes: longer than ${MAX_SESSION_NOTES_LENGTH} characters`,
  );
  return notes;
};

/**
 * Whether the renderer may write a setting through `grail:updateSettings`. The mapped type forces a
 * decision for every new setting. Settings with a dedicated flow (and its own validation) or that
 * only the main process maintains are not writable here:
 * - `saveDir`: `saveFile:updateSaveDirectory` validates the path, truncates data of the previous
 *   directory and restarts monitoring; the value is also a fallback root for save file writes.
 * - `d2rInstallPath`: `icon:setD2RPath` also updates the icon service.
 * - `terrorZoneConfig`, `terrorZoneBackupCreated`: written by the terror zone handlers together
 *   with the game file.
 * - `iconConversionStatus`, `iconConversionProgress`, `mainWindowBounds`, `needsSeeding`:
 *   maintained by the main process.
 */
const RENDERER_WRITABLE_SETTINGS: Record<keyof Settings, boolean> = {
  saveDir: false,
  lang: true,
  gameMode: true,
  grailNormal: true,
  grailEthereal: true,
  grailRunes: true,
  grailRunewords: true,
  gameVersion: true,
  enableSounds: true,
  notificationVolume: true,
  inAppNotifications: true,
  nativeNotifications: true,
  needsSeeding: false,
  theme: true,
  showItemIcons: true,
  d2rInstallPath: false,
  iconConversionStatus: false,
  iconConversionProgress: false,
  tickReaderIntervalMs: true,
  chokidarPollingIntervalMs: true,
  fileStabilityThresholdMs: true,
  fileChangeDebounceMs: true,
  widgetEnabled: true,
  widgetDisplay: true,
  widgetPosition: true,
  widgetOpacity: true,
  widgetSizeOverall: true,
  widgetSizeSplit: true,
  widgetSizeAll: true,
  widgetSizeRunOnly: true,
  widgetLocked: true,
  widgetRunOnlyShowItems: true,
  mainWindowBounds: false,
  wizardCompleted: true,
  wizardSkipped: true,
  terrorZoneConfig: false,
  terrorZoneBackupCreated: false,
  runTrackerAutoStart: true,
  runTrackerEndThreshold: true,
  runTrackerMemoryReading: true,
  runTrackerMemoryPollingInterval: true,
  runTrackerShortcuts: true,
  runTrackerGlobalHotkeys: true,
};

const rendererWritableSettingKeys: ReadonlySet<string> = new Set(
  Object.entries(RENDERER_WRITABLE_SETTINGS)
    .filter(([, writable]) => writable)
    .map(([key]) => key),
);

/**
 * Checks whether the renderer may write a setting through `grail:updateSettings`.
 * @param key - Untrusted setting key
 * @returns True for settings without a dedicated flow
 */
export function isRendererWritableSetting(key: string): key is keyof Settings {
  return rendererWritableSettingKeys.has(key);
}

const settingsUpdate: FieldValidator<Partial<Settings>> = (value) => {
  ensure(isPlainObject(value), 'Invalid settings: expected an object');
  for (const key of Object.keys(value)) {
    ensure(
      isRendererWritableSetting(key),
      `Setting cannot be changed through grail:updateSettings: ${key}`,
    );
  }
  return value as Partial<Settings>;
};

/** Largest database backup accepted from the renderer. */
export const MAX_RESTORE_BACKUP_BYTES = 256 * 1024 * 1024;

/** Every SQLite database file starts with this 16-byte header. */
const SQLITE_HEADER = 'SQLite format 3\0';

/**
 * Checks for a Uint8Array (or Buffer), also when it was created in another realm.
 * @param value - Value to check
 * @returns True for byte arrays
 */
function isByteArray(value: unknown): value is Uint8Array {
  return Object.prototype.toString.call(value) === '[object Uint8Array]';
}

const sqliteBackup: FieldValidator<Uint8Array> = (value) => {
  ensure(isByteArray(value), 'Invalid backup data: expected a byte array');
  ensure(
    value.byteLength <= MAX_RESTORE_BACKUP_BYTES,
    `Invalid backup data: larger than ${MAX_RESTORE_BACKUP_BYTES / (1024 * 1024)} MB`,
  );
  const header = String.fromCharCode(...value.subarray(0, SQLITE_HEADER.length));
  ensure(header === SQLITE_HEADER, 'Invalid backup data: not a SQLite database');
  return value;
};

/**
 * Icon file names may contain folders but must stay inside the icon directory.
 */
const iconFilename: FieldValidator<string> = (value) => {
  ensure(
    typeof value === 'string' && !/(^|[\\/])\.\.([\\/]|$)/.test(value),
    'Invalid icon filename',
  );
  return value;
};

/**
 * Only web links may be opened in the system browser; other protocols (file:, custom app
 * handlers) could launch local programs.
 */
const externalUrl: FieldValidator<string> = (value) => {
  ensure(typeof value === 'string', 'Invalid URL');
  let protocol: string;
  try {
    protocol = new URL(value).protocol;
  } catch {
    throw new IpcValidationError('Invalid URL');
  }
  ensure(protocol === 'https:' || protocol === 'http:', 'Only http(s) URLs can be opened');
  return value;
};

/**
 * Argument validators for every invoke channel of the contract.
 *
 * The mapped type makes a missing or extra channel a compile error. Arguments marked
 * `validatedByHandler` are checked field by field (with precise error messages) by the handler.
 */
export const invokeArgValidators: { [C in InvokeChannel]: ArgsValidator<InvokeArgs<C>> } = {
  // Grail
  'grail:getCharacters': noArgs,
  'grail:getItems': noArgs,
  'grail:getAllRunewords': noArgs,
  'grail:getProgress': args(optionalString('Invalid character ID')),
  'grail:getProgressByItem': args(nonEmptyString('Invalid item ID')),
  'grail:updateProgress': args(validatedByHandler<GrailProgress>()),
  'grail:deleteProgress': args(nonEmptyString('Invalid progress ID')),
  'grail:getSettings': noArgs,
  'grail:updateSettings': args(settingsUpdate),
  'grail:backup': args(nonEmptyString('Invalid backup path')),
  'grail:restore': args(nonEmptyString('Invalid backup path')),
  'grail:restoreFromBuffer': args(sqliteBackup),

  // Save files
  'saveFile:startMonitoring': noArgs,
  'saveFile:stopMonitoring': noArgs,
  'saveFile:getSaveFiles': noArgs,
  'saveFile:getMonitoringStatus': noArgs,
  'saveFile:getDefaultDirectory': noArgs,
  'saveFile:updateSaveDirectory': args(validatedByHandler<string>()),
  'saveFile:inspectDirectory': args(string('Invalid save directory: expected a string')),
  'saveFile:restoreDefaultDirectory': noArgs,
  'saveFile:getAvailableRunes': noArgs,
  'saveFile:refreshSaveFiles': noArgs,

  // Vault
  'vault:addItem': args(validatedByHandler<VaultItemUpsertInput>()),
  'vault:removeItem': args(validatedByHandler<string>()),
  'vault:search': args(validatedByHandler<VaultItemFilter | undefined>()),
  'vault:unvaultItem': args(
    validatedByHandler<string>(),
    validatedByHandler<UnvaultTargetOptions | undefined>(),
    validatedByHandler<number | undefined>(),
  ),

  // Inventory
  'inventory:searchAll': args(validatedByHandler<VaultItemFilter | undefined>()),
  'inventory:openSnapshotWindow': args(validatedByHandler<InventorySnapshotWindowTarget>()),
  'inventory:moveItem': args(validatedByHandler<InventoryItemMoveInput>()),
  'inventory:splitStack': args(validatedByHandler<InventoryStackSplitInput>()),
  'inventory:getActiveDragState': noArgs,

  // Native dialogs
  'dialog:showSaveDialog': args(fileDialogOptions<SaveFileDialogOptions>(SAVE_DIALOG_PROPERTIES)),
  'dialog:showOpenDialog': args(fileDialogOptions<OpenFileDialogOptions>(OPEN_DIALOG_PROPERTIES)),
  'dialog:writeFile': args(validatedByHandler<string>(), validatedByHandler<string>()),

  // Icons
  'icon:setD2RPath': args(string('Invalid D2R installation path')),
  'icon:getD2RPath': noArgs,
  'icon:getSuggestedD2RPath': noArgs,
  'icon:convertSprites': noArgs,
  'icon:getConversionStatus': noArgs,
  'icon:getByFilename': args(iconFilename),
  'icon:validatePath': noArgs,

  // Widget (display modes and the lock state are validated by the handlers, which report
  // `{ success: false }` instead of rejecting)
  'widget:toggle': args(
    boolean('Invalid widget enabled state'),
    plainObject<Partial<Settings>>('Invalid widget settings: expected an object'),
  ),
  'widget:update-display': args(
    validatedByHandler<WidgetDisplayMode>(),
    plainObject<Partial<Settings>>('Invalid widget settings: expected an object'),
  ),
  'widget:update-opacity': args(finiteNumber('Invalid widget opacity')),
  'widget:set-locked': args(validatedByHandler<boolean>()),
  'widget:reset-size': args(validatedByHandler<WidgetDisplayMode>()),
  'widget:reset-position': noArgs,

  // App window
  'update-titlebar-overlay': args(titleBarOverlayColors),
  'app:getIconPath': noArgs,

  // Application updates
  'update:checkForUpdates': noArgs,
  'update:downloadUpdate': noArgs,
  'update:quitAndInstall': noArgs,
  'update:getUpdateInfo': noArgs,

  // Shell
  'shell:openExternal': args(externalUrl),

  // Run tracker
  'run-tracker:start-session': noArgs,
  'run-tracker:end-session': noArgs,
  'run-tracker:archive-session': args(sessionId),
  'run-tracker:update-session-notes': args(sessionId, sessionNotes),
  'run-tracker:start-run': args(optional(nonEmptyString('Invalid character ID'))),
  'run-tracker:end-run': noArgs,
  'run-tracker:pause': noArgs,
  'run-tracker:resume': noArgs,
  'run-tracker:get-state': noArgs,
  'run-tracker:get-all-sessions': args(optional(boolean('Invalid includeArchived flag'))),
  'run-tracker:get-session-by-id': args(sessionId),
  'run-tracker:get-runs-by-session': args(sessionId),
  'run-tracker:get-run-items': args(nonEmptyString('Invalid run ID')),
  'run-tracker:get-session-items': args(sessionId),
  'run-tracker:get-overall-statistics': noArgs,
  'run-tracker:get-memory-status': noArgs,
  'run-tracker:get-global-hotkey-status': noArgs,
  'run-tracker:add-run-item': args(addRunItemInput),

  // Terror zones
  'terrorZone:getZones': noArgs,
  'terrorZone:getConfig': noArgs,
  'terrorZone:updateConfig': args(terrorZoneConfig),
  'terrorZone:restoreOriginal': noArgs,
  'terrorZone:validatePath': noArgs,
};

/** All invoke channels of the contract. */
export const IPC_INVOKE_CHANNELS = Object.keys(invokeArgValidators) as InvokeChannel[];
