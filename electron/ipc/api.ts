/**
 * Renderer-facing API exposed as `window.electronAPI` by the preload script.
 *
 * Every method is a thin, typed wrapper around one channel of the IPC contract, so the API cannot
 * drift from the main-process handlers. This module has no runtime dependency on Electron: the
 * preload passes in `ipcRenderer`, which keeps the bridge testable.
 */
import type { GlobalHotkeyStatus, UpdateStatus } from '../types/grail';
import {
  type EventChannel,
  type EventListener,
  INVENTORY_DRAG_STATE_CHANNEL,
  type InvokeArgs,
  type InvokeChannel,
  type InvokeResult,
  isIpcEventChannel,
  isIpcSendChannel,
  type SendChannel,
  type SendPayload,
  VAULT_DRAG_STATE_CHANNEL,
} from './contract';

/** Operating systems the app runs on. */
export type ElectronPlatform = 'darwin' | 'win32' | 'linux';

/** The subset of Electron's `ipcRenderer` the bridge relies on. */
export interface IpcRendererLike {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): unknown;
  removeListener(channel: string, listener: (event: unknown, ...args: unknown[]) => void): unknown;
}

/** Typed, allowlisted access to the IPC channels of the contract. */
export interface IpcBridge {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>>;
  subscribe<C extends EventChannel>(channel: C, listener: EventListener<C>): () => void;
  send<C extends SendChannel>(channel: C, payload: SendPayload<C>): void;
}

/**
 * Creates the typed IPC bridge on top of `ipcRenderer`.
 *
 * `subscribe` keeps the wrapper it registers and returns an unsubscribe function that removes
 * exactly that wrapper. Function identity does not survive the context bridge, so callers must use
 * the returned function instead of passing their listener to a separate `off`.
 *
 * @param ipcRenderer - Electron's `ipcRenderer` (or a test double)
 * @returns The bridge used to build the renderer API
 */
export function createIpcBridge(ipcRenderer: IpcRendererLike): IpcBridge {
  return {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args) as Promise<never>,

    subscribe: (channel, listener) => {
      if (!isIpcEventChannel(channel)) {
        throw new Error(`Unknown IPC event channel: ${String(channel)}`);
      }
      if (typeof listener !== 'function') {
        throw new Error('IPC event listener must be a function');
      }

      const wrapper = (_event: unknown, payload?: unknown) => {
        listener(payload as Parameters<typeof listener>[0]);
      };
      ipcRenderer.on(channel, wrapper);

      let subscribed = true;
      return () => {
        if (!subscribed) {
          return;
        }
        subscribed = false;
        ipcRenderer.removeListener(channel, wrapper);
      };
    },

    send: (channel, payload) => {
      if (!isIpcSendChannel(channel)) {
        throw new Error(`Unknown IPC send channel: ${String(channel)}`);
      }
      ipcRenderer.send(channel, payload);
    },
  };
}

/**
 * Builds the `window.electronAPI` object from the IPC bridge.
 * @param bridge - Typed IPC bridge
 * @param platform - Operating system of the main process
 * @returns The renderer-facing API
 */
export function createElectronAPI(bridge: IpcBridge, platform: ElectronPlatform) {
  const { invoke, subscribe, send } = bridge;

  return {
    /** Operating system of the main process. */
    platform,

    /**
     * Subscribes to an event the main process pushes to renderer windows.
     * @returns Function that removes the listener; call it from the effect cleanup.
     */
    on: subscribe,

    grail: {
      getCharacters: () => invoke('grail:getCharacters'),
      getItems: () => invoke('grail:getItems'),
      /** All runewords, regardless of the grailRunewords setting. */
      getAllRunewords: () => invoke('grail:getAllRunewords'),
      getProgress: (characterId?: string) => invoke('grail:getProgress', characterId),
      getProgressByItem: (itemId: string) => invoke('grail:getProgressByItem', itemId),
      /** Saves a manually added progress record. */
      updateProgress: (...args: InvokeArgs<'grail:updateProgress'>) =>
        invoke('grail:updateProgress', ...args),
      /** Deletes a manually added progress record. */
      deleteProgress: (progressId: string) => invoke('grail:deleteProgress', progressId),
      getSettings: () => invoke('grail:getSettings'),
      updateSettings: (...args: InvokeArgs<'grail:updateSettings'>) =>
        invoke('grail:updateSettings', ...args),
      backup: (backupPath: string) => invoke('grail:backup', backupPath),
      restore: (backupPath: string) => invoke('grail:restore', backupPath),
      restoreFromBuffer: (backupBuffer: Uint8Array) =>
        invoke('grail:restoreFromBuffer', backupBuffer),
    },

    saveFile: {
      startMonitoring: () => invoke('saveFile:startMonitoring'),
      stopMonitoring: () => invoke('saveFile:stopMonitoring'),
      getSaveFiles: () => invoke('saveFile:getSaveFiles'),
      getMonitoringStatus: () => invoke('saveFile:getMonitoringStatus'),
      /** Platform-specific default save directory. */
      getDefaultDirectory: () => invoke('saveFile:getDefaultDirectory'),
      updateSaveDirectory: (saveDir: string) => invoke('saveFile:updateSaveDirectory', saveDir),
      /** Inspects a candidate save directory without applying it. */
      inspectDirectory: (directory: string) => invoke('saveFile:inspectDirectory', directory),
      restoreDefaultDirectory: () => invoke('saveFile:restoreDefaultDirectory'),
      /** Rune counts from the most recent save file scan. */
      getAvailableRunes: () => invoke('saveFile:getAvailableRunes'),
      /** Forces a re-parse of all save files. */
      refreshSaveFiles: () => invoke('saveFile:refreshSaveFiles'),
    },

    vault: {
      addItem: (...args: InvokeArgs<'vault:addItem'>) => invoke('vault:addItem', ...args),
      removeItem: (itemId: string) => invoke('vault:removeItem', itemId),
      search: (...args: InvokeArgs<'vault:search'>) => invoke('vault:search', ...args),
      unvaultItem: (...args: InvokeArgs<'vault:unvaultItem'>) =>
        invoke('vault:unvaultItem', ...args),
    },

    inventory: {
      searchAll: (...args: InvokeArgs<'inventory:searchAll'>) =>
        invoke('inventory:searchAll', ...args),
      openSnapshotWindow: (...args: InvokeArgs<'inventory:openSnapshotWindow'>) =>
        invoke('inventory:openSnapshotWindow', ...args),
      moveItem: (...args: InvokeArgs<'inventory:moveItem'>) =>
        invoke('inventory:moveItem', ...args),
      splitStack: (...args: InvokeArgs<'inventory:splitStack'>) =>
        invoke('inventory:splitStack', ...args),
      /** Drag states that are active in any window right now. */
      getActiveDragState: () => invoke('inventory:getActiveDragState'),
      /** Shares the drag state of a vault item with the other windows. */
      sendVaultDragState: (payload: SendPayload<typeof VAULT_DRAG_STATE_CHANNEL>) =>
        send(VAULT_DRAG_STATE_CHANNEL, payload),
      /** Shares the drag state of an inventory item with the other windows. */
      sendItemDragState: (payload: SendPayload<typeof INVENTORY_DRAG_STATE_CHANNEL>) =>
        send(INVENTORY_DRAG_STATE_CHANNEL, payload),
    },

    dialog: {
      showSaveDialog: (...args: InvokeArgs<'dialog:showSaveDialog'>) =>
        invoke('dialog:showSaveDialog', ...args),
      showOpenDialog: (...args: InvokeArgs<'dialog:showOpenDialog'>) =>
        invoke('dialog:showOpenDialog', ...args),
      writeFile: (filePath: string, content: string) =>
        invoke('dialog:writeFile', filePath, content),
    },

    data: {
      /**
       * Subscribes to service errors. The payload is untrusted and must be validated by the caller.
       * @returns Function that removes the listener
       */
      onServiceError: (callback: (payload: unknown) => void) =>
        subscribe('service-error', callback),
    },

    icon: {
      setD2RPath: (path: string) => invoke('icon:setD2RPath', path),
      getD2RPath: () => invoke('icon:getD2RPath'),
      /** Default D2R installation path for this platform, if it exists on disk. */
      getSuggestedD2RPath: () => invoke('icon:getSuggestedD2RPath'),
      convertSprites: () => invoke('icon:convertSprites'),
      getConversionStatus: () => invoke('icon:getConversionStatus'),
      /** Base64 data URL of an icon, or null if it was not found. */
      getByFilename: (filename: string) => invoke('icon:getByFilename', filename),
      validatePath: () => invoke('icon:validatePath'),
    },

    widget: {
      toggle: (...args: InvokeArgs<'widget:toggle'>) => invoke('widget:toggle', ...args),
      updateDisplay: (...args: InvokeArgs<'widget:update-display'>) =>
        invoke('widget:update-display', ...args),
      updateOpacity: (opacity: number) => invoke('widget:update-opacity', opacity),
      /** A locked widget is click-through and cannot be focused, dragged or resized. */
      setLocked: (locked: boolean) => invoke('widget:set-locked', locked),
      resetSize: (...args: InvokeArgs<'widget:reset-size'>) => invoke('widget:reset-size', ...args),
      resetPosition: () => invoke('widget:reset-position'),
    },

    /** Updates the title bar overlay colors (Windows/Linux only). */
    updateTitleBarOverlay: (...args: InvokeArgs<'update-titlebar-overlay'>) =>
      invoke('update-titlebar-overlay', ...args),

    /** Path to the app icon for native notifications. */
    getIconPath: () => invoke('app:getIconPath'),

    update: {
      checkForUpdates: () => invoke('update:checkForUpdates'),
      downloadUpdate: () => invoke('update:downloadUpdate'),
      quitAndInstall: () => invoke('update:quitAndInstall'),
      getUpdateInfo: () => invoke('update:getUpdateInfo'),
      /** @returns Function that removes the listener */
      onUpdateStatus: (callback: (status: UpdateStatus) => void) =>
        subscribe('update:status', callback),
    },

    shell: {
      openExternal: (url: string) => invoke('shell:openExternal', url),
    },

    runTracker: {
      startSession: () => invoke('run-tracker:start-session'),
      endSession: () => invoke('run-tracker:end-session'),
      archiveSession: (sessionId: string) => invoke('run-tracker:archive-session', sessionId),
      startRun: (characterId?: string) => invoke('run-tracker:start-run', characterId),
      endRun: () => invoke('run-tracker:end-run'),
      pauseRun: () => invoke('run-tracker:pause'),
      resumeRun: () => invoke('run-tracker:resume'),
      getState: () => invoke('run-tracker:get-state'),
      getAllSessions: (includeArchived?: boolean) =>
        invoke('run-tracker:get-all-sessions', includeArchived),
      getSessionById: (sessionId: string) => invoke('run-tracker:get-session-by-id', sessionId),
      getRunsBySession: (sessionId: string) => invoke('run-tracker:get-runs-by-session', sessionId),
      getRunItems: (runId: string) => invoke('run-tracker:get-run-items', runId),
      getSessionItems: (sessionId: string) => invoke('run-tracker:get-session-items', sessionId),
      getOverallStatistics: () => invoke('run-tracker:get-overall-statistics'),
      /** Whether memory reading (auto mode) is available. */
      getMemoryStatus: () => invoke('run-tracker:get-memory-status'),
      getGlobalHotkeyStatus: () => invoke('run-tracker:get-global-hotkey-status'),
      /** @returns Function that removes the listener */
      onGlobalHotkeyStatus: (callback: (status: GlobalHotkeyStatus) => void) =>
        subscribe('run-tracker:global-hotkey-status', callback),
      addRunItem: (...args: InvokeArgs<'run-tracker:add-run-item'>) =>
        invoke('run-tracker:add-run-item', ...args),
    },

    terrorZone: {
      getZones: () => invoke('terrorZone:getZones'),
      getConfig: () => invoke('terrorZone:getConfig'),
      /** Saves the zone configuration and applies it to the game file. */
      updateConfig: (config: Record<string, boolean>) => invoke('terrorZone:updateConfig', config),
      /** Restores the original desecratedzones.json from the backup. */
      restoreOriginal: () => invoke('terrorZone:restoreOriginal'),
      validatePath: () => invoke('terrorZone:validatePath'),
    },
  };
}

/** The API available to the renderer as `window.electronAPI`. */
export type ElectronAPI = ReturnType<typeof createElectronAPI>;

declare global {
  interface Window {
    /** Typed access to the main process, exposed by the preload script. */
    electronAPI: ElectronAPI;
  }
}
