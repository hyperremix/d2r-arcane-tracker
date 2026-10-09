/**
 * Single source of truth for every IPC channel between the main process and the renderer.
 *
 * - {@link IpcInvokeContract}: request/response channels (`ipcRenderer.invoke` → `ipcMain.handle`).
 * - {@link IpcEventContract}: events the main process pushes to renderer windows.
 * - {@link IpcSendContract}: fire-and-forget messages a renderer sends to the main process.
 *
 * Main-process handlers (`handle()` in `./handle`), argument validators (`./validators`), the
 * preload bridge (`./api`) and the renderer-facing `ElectronAPI` type are all derived from these
 * maps, so a channel that exists on one side only, or disagrees on its arguments or payload, is a
 * type error.
 *
 * This module must stay free of runtime dependencies on Node or Electron: it is bundled into the
 * sandboxed preload script and imported by the renderer.
 */
import type { ConversionResult, ConversionStatus } from '../services/iconService';
import type {
  RunEndedPayload,
  RunItemAddedPayload,
  RunPausedPayload,
  RunResumedPayload,
  RunStartedPayload,
  SessionEndedPayload,
  SessionStartedPayload,
} from '../types/events';
import type {
  Character,
  D2Item,
  D2SaveFile,
  GlobalHotkeyStatus,
  GrailProgress,
  InventoryItemMoveInput,
  InventorySearchResult,
  InventorySnapshotWindowTarget,
  InventoryStackSplitInput,
  Item,
  ItemDetectionEvent,
  MonitoringStatus,
  Run,
  RunItem,
  RunStatistics,
  SaveDirectoryInspection,
  SaveFileEvent,
  Session,
  Settings,
  TerrorZone,
  TerrorZoneValidationResult,
  UpdateStatus,
  VaultItem,
  VaultItemFilter,
  VaultItemSearchResult,
  VaultItemUpsertInput,
  VaultLocationContext,
  VaultSourceFileType,
} from '../types/grail';
import type { ServiceErrorPayload } from '../types/serviceError';
import type { WidgetDisplayMode, WidgetSize } from '../utils/widgetDisplay';

/** Channel used to relay the drag state of a vault item between windows. */
export const VAULT_DRAG_STATE_CHANNEL = 'inventory:vault-drag-state';
/** Channel used to relay the drag state of an inventory item between windows. */
export const INVENTORY_DRAG_STATE_CHANNEL = 'inventory:item-drag-state';

// ---------------------------------------------------------------------------------------------
// Payload and argument shapes
// ---------------------------------------------------------------------------------------------

/** Generic success result returned by most mutating channels. */
export interface SuccessResult {
  success: boolean;
}

/** Result of widget window operations; failures carry a technical error string. */
export interface WidgetResult {
  success: boolean;
  error?: string;
}

/** Drag state of a vault item, relayed between the main window and snapshot windows. */
export interface VaultDragStatePayload {
  active: boolean;
  id: string;
  gridWidth: number;
  gridHeight: number;
}

/** Drag state of an inventory item (or a stack pickup), relayed between windows. */
export interface InventoryDragStatePayload {
  active: boolean;
  fingerprint: string;
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceLocationContext: string;
  rawItemJson: string;
  itemCode?: string;
  sourceStashTab?: number;
  sourceGridX?: number;
  sourceGridY?: number;
  sourceEquippedSlotId?: number;
  gridWidth: number;
  gridHeight: number;
  stackPickup?: boolean;
  stackPickupCount?: number;
  stackPickupMaxCount?: number;
  stackPickupItemName?: string;
  stackPickupIconFileName?: string;
}

/** Drag states that are active right now, used by windows that open mid-drag. */
export interface ActiveDragStateSnapshot {
  vault?: VaultDragStatePayload;
  inventory?: InventoryDragStatePayload;
}

/** Target of moving a vaulted item back into a save file. */
export interface UnvaultTargetOptions {
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX: number;
  targetGridY: number;
  targetEquippedSlotId?: number;
}

/** File type filter of a native file dialog. */
export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

/** Properties a renderer may request for a native open dialog. */
export const OPEN_DIALOG_PROPERTIES = [
  'openFile',
  'openDirectory',
  'multiSelections',
  'showHiddenFiles',
  'createDirectory',
] as const;

/** Properties a renderer may request for a native save dialog. */
export const SAVE_DIALOG_PROPERTIES = [
  'showHiddenFiles',
  'createDirectory',
  'showOverwriteConfirmation',
] as const;

/** Options for a native open dialog. */
export interface OpenFileDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileDialogFilter[];
  properties?: (typeof OPEN_DIALOG_PROPERTIES)[number][];
}

/** Options for a native save dialog. */
export interface SaveFileDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileDialogFilter[];
  properties?: (typeof SAVE_DIALOG_PROPERTIES)[number][];
}

/** Colors of the Windows/Linux title bar overlay. */
export interface TitleBarOverlayColors {
  backgroundColor: string;
  symbolColor: string;
}

/** Result of validating the D2R installation path for icon extraction. */
export interface IconPathValidationResult {
  valid: boolean;
  path?: string;
  error?: string;
}

/** Progress of the sprite to PNG conversion. */
export interface IconConversionProgress {
  current: number;
  total: number;
}

/** Current state of the run tracker as reported to the renderer. */
export interface RunTrackerStateSnapshot {
  isRunning: boolean;
  isPaused: boolean;
  activeSession: Session | null;
  activeRun: Run | null;
}

/** Input for manually adding an item to a run. */
export interface AddRunItemInput {
  runId: string;
  name?: string;
  grailProgressId?: string;
  foundTime?: Date;
}

/** Whether memory reading (auto mode) is available. */
export interface MemoryStatus {
  available: boolean;
  reason: string | null;
}

/** Details sent with `grail-progress-updated` when an item is found for the first time. */
export interface GrailProgressDiscoveryPayload {
  character: Character;
  item: D2Item;
  progress: GrailProgress;
  autoDetected: boolean;
  firstTimeDiscovery: boolean;
}

/** Save file monitoring status change pushed to renderer windows. */
export type MonitoringStatusChangedPayload =
  | { status: 'started'; directory: string; saveFileCount: number }
  | { status: 'stopped' }
  | {
      status: 'error';
      error: string;
      errorType: string;
      directory: string | null;
      saveFileCount: number;
    };

// ---------------------------------------------------------------------------------------------
// Contract maps
// ---------------------------------------------------------------------------------------------

/**
 * Shape of a single invoke channel: the arguments the renderer passes and the resolved result.
 */
interface Invoke<Args extends unknown[], Result> {
  args: Args;
  result: Result;
}

/**
 * Every request/response channel. The key is the channel name.
 */
export interface IpcInvokeContract {
  // Grail
  'grail:getCharacters': Invoke<[], Character[]>;
  'grail:getItems': Invoke<[], Item[]>;
  'grail:getAllRunewords': Invoke<[], Item[]>;
  'grail:getProgress': Invoke<[characterId?: string], GrailProgress[]>;
  'grail:getProgressByItem': Invoke<[itemId: string], GrailProgress[]>;
  'grail:updateProgress': Invoke<[progress: GrailProgress], SuccessResult>;
  'grail:deleteProgress': Invoke<[progressId: string], SuccessResult>;
  'grail:getSettings': Invoke<[], Partial<Settings>>;
  'grail:updateSettings': Invoke<[settings: Partial<Settings>], SuccessResult>;
  'grail:backup': Invoke<[backupPath: string], SuccessResult>;
  'grail:restore': Invoke<[backupPath: string], SuccessResult>;
  'grail:restoreFromBuffer': Invoke<[backupBuffer: Uint8Array], SuccessResult>;

  // Save files
  'saveFile:startMonitoring': Invoke<[], SuccessResult>;
  'saveFile:stopMonitoring': Invoke<[], SuccessResult>;
  'saveFile:getSaveFiles': Invoke<[], D2SaveFile[]>;
  'saveFile:getMonitoringStatus': Invoke<[], MonitoringStatus>;
  'saveFile:getDefaultDirectory': Invoke<[], string>;
  'saveFile:updateSaveDirectory': Invoke<[saveDir: string], SuccessResult>;
  'saveFile:inspectDirectory': Invoke<[directory: string], SaveDirectoryInspection>;
  'saveFile:restoreDefaultDirectory': Invoke<[], { success: boolean; defaultDirectory: string }>;
  'saveFile:getAvailableRunes': Invoke<[], Record<string, number>>;
  'saveFile:refreshSaveFiles': Invoke<[], SuccessResult>;

  // Vault
  'vault:addItem': Invoke<[item: VaultItemUpsertInput], VaultItem>;
  'vault:removeItem': Invoke<[itemId: string], SuccessResult>;
  'vault:search': Invoke<[filter?: VaultItemFilter], VaultItemSearchResult>;
  'vault:unvaultItem': Invoke<
    [itemId: string, targetOptions?: UnvaultTargetOptions, withdrawCount?: number],
    SuccessResult
  >;

  // Inventory
  'inventory:searchAll': Invoke<
    [filter?: VaultItemFilter],
    { inventory: InventorySearchResult; vault: VaultItemSearchResult }
  >;
  'inventory:openSnapshotWindow': Invoke<[target: InventorySnapshotWindowTarget], SuccessResult>;
  'inventory:moveItem': Invoke<[input: InventoryItemMoveInput], SuccessResult>;
  'inventory:splitStack': Invoke<[input: InventoryStackSplitInput], SuccessResult>;
  'inventory:getActiveDragState': Invoke<[], ActiveDragStateSnapshot>;

  // Native dialogs
  'dialog:showSaveDialog': Invoke<
    [options: SaveFileDialogOptions],
    { canceled: boolean; filePath?: string }
  >;
  'dialog:showOpenDialog': Invoke<
    [options: OpenFileDialogOptions],
    { canceled: boolean; filePaths?: string[] }
  >;
  'dialog:writeFile': Invoke<[filePath: string, content: string], SuccessResult>;

  // Icons
  'icon:setD2RPath': Invoke<[path: string], void>;
  'icon:getD2RPath': Invoke<[], string | null>;
  'icon:getSuggestedD2RPath': Invoke<[], string | undefined>;
  'icon:convertSprites': Invoke<[], ConversionResult>;
  'icon:getConversionStatus': Invoke<[], ConversionStatus>;
  'icon:getByFilename': Invoke<[filename: string], string | null>;
  'icon:validatePath': Invoke<[], IconPathValidationResult>;

  // Widget
  'widget:toggle': Invoke<[enabled: boolean, settings: Partial<Settings>], WidgetResult>;
  'widget:update-display': Invoke<
    [display: WidgetDisplayMode, settings: Partial<Settings>],
    WidgetResult
  >;
  'widget:update-opacity': Invoke<[opacity: number], WidgetResult>;
  'widget:set-locked': Invoke<[locked: boolean], WidgetResult>;
  'widget:reset-size': Invoke<
    [display: WidgetDisplayMode],
    { success: boolean; size: WidgetSize | null; error?: string }
  >;
  'widget:reset-position': Invoke<
    [],
    { success: boolean; position: { x: number; y: number } | null; error?: string }
  >;

  // App window
  'update-titlebar-overlay': Invoke<[colors: TitleBarOverlayColors], SuccessResult>;
  'app:getIconPath': Invoke<[], string>;

  // Application updates
  'update:checkForUpdates': Invoke<[], UpdateStatus>;
  'update:downloadUpdate': Invoke<[], SuccessResult>;
  'update:quitAndInstall': Invoke<[], void>;
  'update:getUpdateInfo': Invoke<[], { currentVersion: string; status: UpdateStatus }>;

  // Shell
  'shell:openExternal': Invoke<[url: string], { success: boolean; error?: string }>;

  // Run tracker
  'run-tracker:start-session': Invoke<[], Session>;
  'run-tracker:end-session': Invoke<[], SuccessResult>;
  'run-tracker:archive-session': Invoke<[sessionId: string], SuccessResult>;
  'run-tracker:update-session-notes': Invoke<[sessionId: string, notes: string], Session>;
  'run-tracker:start-run': Invoke<[characterId?: string], Run>;
  'run-tracker:end-run': Invoke<[], SuccessResult>;
  'run-tracker:pause': Invoke<[], SuccessResult>;
  'run-tracker:resume': Invoke<[], SuccessResult>;
  'run-tracker:get-state': Invoke<[], RunTrackerStateSnapshot>;
  'run-tracker:get-all-sessions': Invoke<[includeArchived?: boolean], Session[]>;
  'run-tracker:get-session-by-id': Invoke<[sessionId: string], Session | null>;
  'run-tracker:get-runs-by-session': Invoke<[sessionId: string], Run[]>;
  'run-tracker:get-run-items': Invoke<[runId: string], RunItem[]>;
  'run-tracker:get-session-items': Invoke<[sessionId: string], RunItem[]>;
  'run-tracker:get-overall-statistics': Invoke<[], RunStatistics>;
  'run-tracker:get-memory-status': Invoke<[], MemoryStatus>;
  'run-tracker:get-global-hotkey-status': Invoke<[], GlobalHotkeyStatus>;
  'run-tracker:add-run-item': Invoke<
    [data: AddRunItemInput],
    { success: boolean; runItem: RunItem }
  >;

  // Terror zones
  'terrorZone:getZones': Invoke<[], TerrorZone[]>;
  'terrorZone:getConfig': Invoke<[], Record<string, boolean>>;
  'terrorZone:updateConfig': Invoke<
    [config: Record<string, boolean>],
    { success: boolean; requiresRestart: boolean }
  >;
  'terrorZone:restoreOriginal': Invoke<[], SuccessResult>;
  'terrorZone:validatePath': Invoke<[], TerrorZoneValidationResult>;
}

/**
 * Every event the main process pushes to renderer windows, mapped to its payload.
 */
export interface IpcEventContract {
  /** Grail progress changed; carries details only for first-time discoveries. */
  'grail-progress-updated': GrailProgressDiscoveryPayload | undefined;
  /** Settings were saved; carries the partial settings that changed. */
  'settings-updated': Partial<Settings>;
  'save-file-event': SaveFileEvent;
  'item-detection-event': ItemDetectionEvent;
  'monitoring-status-changed': MonitoringStatusChangedPayload;
  'service-error': ServiceErrorPayload;
  'update:status': UpdateStatus;
  'icon:conversionProgress': IconConversionProgress;
  'run-tracker:session-started': SessionStartedPayload;
  'run-tracker:session-ended': SessionEndedPayload;
  'run-tracker:run-started': RunStartedPayload;
  'run-tracker:run-ended': RunEndedPayload;
  'run-tracker:run-paused': RunPausedPayload;
  'run-tracker:run-resumed': RunResumedPayload;
  'run-tracker:run-item-added': RunItemAddedPayload;
  'run-tracker:global-hotkey-status': GlobalHotkeyStatus;
  [VAULT_DRAG_STATE_CHANNEL]: VaultDragStatePayload;
  [INVENTORY_DRAG_STATE_CHANNEL]: InventoryDragStatePayload;
}

/**
 * Every fire-and-forget message a renderer sends to the main process, mapped to its payload.
 */
export interface IpcSendContract {
  [VAULT_DRAG_STATE_CHANNEL]: VaultDragStatePayload;
  [INVENTORY_DRAG_STATE_CHANNEL]: InventoryDragStatePayload;
}

export type InvokeChannel = keyof IpcInvokeContract;
export type InvokeArgs<C extends InvokeChannel> = IpcInvokeContract[C]['args'];
export type InvokeResult<C extends InvokeChannel> = IpcInvokeContract[C]['result'];

export type EventChannel = keyof IpcEventContract;
export type EventPayload<C extends EventChannel> = IpcEventContract[C];
export type EventListener<C extends EventChannel> = (payload: EventPayload<C>) => void;

export type SendChannel = keyof IpcSendContract;
export type SendPayload<C extends SendChannel> = IpcSendContract[C];

// ---------------------------------------------------------------------------------------------
// Runtime allowlists (the object literals must list every channel of the matching map)
// ---------------------------------------------------------------------------------------------

const EVENT_CHANNELS: Record<EventChannel, true> = {
  'grail-progress-updated': true,
  'settings-updated': true,
  'save-file-event': true,
  'item-detection-event': true,
  'monitoring-status-changed': true,
  'service-error': true,
  'update:status': true,
  'icon:conversionProgress': true,
  'run-tracker:session-started': true,
  'run-tracker:session-ended': true,
  'run-tracker:run-started': true,
  'run-tracker:run-ended': true,
  'run-tracker:run-paused': true,
  'run-tracker:run-resumed': true,
  'run-tracker:run-item-added': true,
  'run-tracker:global-hotkey-status': true,
  [VAULT_DRAG_STATE_CHANNEL]: true,
  [INVENTORY_DRAG_STATE_CHANNEL]: true,
};

const SEND_CHANNELS: Record<SendChannel, true> = {
  [VAULT_DRAG_STATE_CHANNEL]: true,
  [INVENTORY_DRAG_STATE_CHANNEL]: true,
};

/** All channels the main process may push to renderer windows. */
export const IPC_EVENT_CHANNELS = Object.keys(EVENT_CHANNELS) as EventChannel[];

/** All channels a renderer may send fire-and-forget messages on. */
export const IPC_SEND_CHANNELS = Object.keys(SEND_CHANNELS) as SendChannel[];

const eventChannelSet: ReadonlySet<string> = new Set(IPC_EVENT_CHANNELS);
const sendChannelSet: ReadonlySet<string> = new Set(IPC_SEND_CHANNELS);

/**
 * Checks whether a value is a channel renderer windows may subscribe to.
 * @param value - Untrusted channel name
 * @returns True if the channel is in the event allowlist
 */
export function isIpcEventChannel(value: unknown): value is EventChannel {
  return typeof value === 'string' && eventChannelSet.has(value);
}

/**
 * Checks whether a value is a channel renderer windows may send messages on.
 * @param value - Untrusted channel name
 * @returns True if the channel is in the send allowlist
 */
export function isIpcSendChannel(value: unknown): value is SendChannel {
  return typeof value === 'string' && sendChannelSet.has(value);
}
