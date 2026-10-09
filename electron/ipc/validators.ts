import type {
  GrailProgress,
  InventoryItemMoveInput,
  InventorySnapshotWindowTarget,
  InventoryStackSplitInput,
  Settings,
  VaultItemFilter,
  VaultItemUpsertInput,
} from '../types/grail';
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

const byteArray: FieldValidator<Uint8Array> = (value) => {
  ensure(value instanceof Uint8Array, 'Invalid backup data: expected a byte array');
  return value;
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
  'grail:getProgressByItem': args(string('Invalid item ID')),
  'grail:updateProgress': args(validatedByHandler<GrailProgress>()),
  'grail:deleteProgress': args(nonEmptyString('Invalid progress ID')),
  'grail:getSettings': noArgs,
  'grail:updateSettings': args(
    plainObject<Partial<Settings>>('Invalid settings: expected an object'),
  ),
  'grail:backup': args(nonEmptyString('Invalid backup path')),
  'grail:restore': args(nonEmptyString('Invalid backup path')),
  'grail:restoreFromBuffer': args(byteArray),

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
  'icon:getByFilename': args(string('Invalid icon filename')),
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
  'shell:openExternal': args(string('Invalid URL')),

  // Run tracker
  'run-tracker:start-session': noArgs,
  'run-tracker:end-session': noArgs,
  'run-tracker:archive-session': args(sessionId),
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
