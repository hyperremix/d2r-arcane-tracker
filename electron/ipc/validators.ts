import { isAbsolute } from 'node:path';
import type { Difficulty, GrailProgress, Settings } from '../types/grail';
import { RUN_TRACKER_SHORTCUT_ACTIONS } from '../utils/runTrackerShortcuts';
import { MAX_SESSION_NOTES_LENGTH } from '../utils/sessionNotes';
import type { WidgetDisplayMode } from '../utils/widgetDisplay';
import {
  type AddRunItemInput,
  type FileDialogFilter,
  INVENTORY_DRAG_STATE_CHANNEL,
  type InvokeArgs,
  type InvokeChannel,
  OPEN_DIALOG_PROPERTIES,
  type OpenFileDialogOptions,
  SAVE_DIALOG_PROPERTIES,
  type SaveFileDialogOptions,
  type SendChannel,
  type SendPayload,
  type TitleBarOverlayColors,
  VAULT_DRAG_STATE_CHANNEL,
} from './contract';
import { inventoryDragStatePayload, vaultDragStatePayload } from './dragStateValidators';
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
import {
  inventoryItemMoveInput,
  inventorySnapshotWindowTarget,
  inventoryStackSplitInput,
  unvaultTargetOptions,
  vaultItemFilter,
  vaultItemId,
  vaultItemUpsertInput,
  withdrawCount,
} from './vaultValidators';

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

const VALID_DIFFICULTIES: readonly Difficulty[] = ['normal', 'nightmare', 'hell'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * A grail progress record the renderer saves (manual finds). Only the record fields are kept.
 */
const grailProgress: FieldValidator<GrailProgress> = (value) => {
  const message = 'Invalid grail progress payload';
  ensure(isPlainObject(value), message);
  const { id, characterId, itemId, foundDate, foundBy, manuallyAdded, difficulty, notes } = value;
  const { isEthereal, fromInitialScan } = value;
  ensure(
    isNonEmptyString(id) && isNonEmptyString(characterId) && isNonEmptyString(itemId),
    message,
  );
  ensure(typeof isEthereal === 'boolean' && typeof manuallyAdded === 'boolean', message);
  ensure(fromInitialScan === undefined || typeof fromInitialScan === 'boolean', message);
  ensure(foundBy === undefined || typeof foundBy === 'string', message);
  ensure(notes === undefined || typeof notes === 'string', message);
  ensure(
    foundDate === undefined || (foundDate instanceof Date && !Number.isNaN(foundDate.getTime())),
    message,
  );
  ensure(
    difficulty === undefined || (VALID_DIFFICULTIES as readonly unknown[]).includes(difficulty),
    message,
  );
  return {
    id,
    characterId,
    itemId,
    foundDate,
    foundBy,
    manuallyAdded,
    difficulty: difficulty as Difficulty | undefined,
    notes,
    isEthereal,
    fromInitialScan,
  };
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

/**
 * Checks that a renderer-provided shortcut mapping has a non-empty string for every action.
 * @param value - The untrusted runTrackerShortcuts value
 * @returns True if the value is a complete shortcut mapping
 */
function isValidRunTrackerShortcuts(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    RUN_TRACKER_SHORTCUT_ACTIONS.every((action) => isNonEmptyString(value[action]))
  );
}

const settingsUpdate: FieldValidator<Partial<Settings>> = (value) => {
  ensure(isPlainObject(value), 'Invalid settings: expected an object');
  for (const key of Object.keys(value)) {
    ensure(
      isRendererWritableSetting(key),
      `Setting cannot be changed through grail:updateSettings: ${key}`,
    );
  }
  // Settings whose type affects main-process behavior (global hotkey registration)
  ensure(
    value.runTrackerGlobalHotkeys === undefined ||
      typeof value.runTrackerGlobalHotkeys === 'boolean',
    'Invalid runTrackerGlobalHotkeys setting: expected a boolean',
  );
  ensure(
    value.runTrackerShortcuts === undefined ||
      isValidRunTrackerShortcuts(value.runTrackerShortcuts),
    'Invalid runTrackerShortcuts setting: expected an object with a non-empty string for each shortcut action',
  );
  return value as Partial<Settings>;
};

/** A new save directory: a non-empty absolute path, returned trimmed. */
const saveDirectory: FieldValidator<string> = (value) => {
  ensure(typeof value === 'string', 'Invalid save directory: expected a string');
  const trimmed = value.trim();
  ensure(
    trimmed !== '' && isAbsolute(trimmed),
    'Invalid save directory: expected a non-empty absolute path',
  );
  return trimmed;
};

/** Target of `dialog:writeFile`: an absolute path (the user picked it in a save dialog). */
const writableFilePath: FieldValidator<string> = (value) => {
  ensure(
    typeof value === 'string' && value.trim().length > 0 && isAbsolute(value),
    'Invalid file path',
  );
  return value;
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
 * The mapped type makes a missing or extra channel a compile error. The few arguments marked
 * `validatedByHandler` are checked by handlers that report invalid input as a failed result
 * instead of rejecting.
 */
export const invokeArgValidators: { [C in InvokeChannel]: ArgsValidator<InvokeArgs<C>> } = {
  // Grail
  'grail:getCharacters': noArgs,
  'grail:getItems': noArgs,
  'grail:getAllRunewords': noArgs,
  'grail:getProgress': args(optionalString('Invalid character ID')),
  'grail:getProgressByItem': args(nonEmptyString('Invalid item ID')),
  'grail:updateProgress': args(grailProgress),
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
  'saveFile:updateSaveDirectory': args(saveDirectory),
  'saveFile:inspectDirectory': args(string('Invalid save directory: expected a string')),
  'saveFile:restoreDefaultDirectory': noArgs,
  'saveFile:getAvailableRunes': noArgs,
  'saveFile:refreshSaveFiles': noArgs,

  // Vault
  'vault:addItem': args(vaultItemUpsertInput),
  'vault:removeItem': args(vaultItemId),
  'vault:search': args(vaultItemFilter),
  'vault:unvaultItem': args(vaultItemId, unvaultTargetOptions, withdrawCount),

  // Inventory
  'inventory:searchAll': args(vaultItemFilter),
  'inventory:openSnapshotWindow': args(inventorySnapshotWindowTarget),
  'inventory:moveItem': args(inventoryItemMoveInput),
  'inventory:splitStack': args(inventoryStackSplitInput),
  'inventory:getActiveDragState': noArgs,

  // Native dialogs
  'dialog:showSaveDialog': args(fileDialogOptions<SaveFileDialogOptions>(SAVE_DIALOG_PROPERTIES)),
  'dialog:showOpenDialog': args(fileDialogOptions<OpenFileDialogOptions>(OPEN_DIALOG_PROPERTIES)),
  'dialog:writeFile': args(writableFilePath, string('Invalid file content')),

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

/**
 * Payload validators for every send channel (fire-and-forget renderer messages). The mapped type
 * makes a missing or extra channel a compile error.
 */
export const sendPayloadValidators: { [C in SendChannel]: FieldValidator<SendPayload<C>> } = {
  [VAULT_DRAG_STATE_CHANNEL]: vaultDragStatePayload,
  [INVENTORY_DRAG_STATE_CHANNEL]: inventoryDragStatePayload,
};
