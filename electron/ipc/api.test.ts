import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createElectronAPI, createIpcBridge, type IpcBridge } from './api';
import { INVENTORY_DRAG_STATE_CHANNEL, VAULT_DRAG_STATE_CHANNEL } from './contract';
import { IPC_INVOKE_CHANNELS } from './validators';

/**
 * Creates an `ipcRenderer` double backed by a real EventEmitter, so listener bookkeeping behaves
 * like Electron's.
 */
function createFakeIpcRenderer() {
  const emitter = new EventEmitter();
  return {
    emitter,
    invoke: vi.fn(async (_channel: string, ..._args: unknown[]) => 'result' as unknown),
    send: vi.fn(),
    on: vi.fn((channel: string, listener: (...args: unknown[]) => void) =>
      emitter.on(channel, listener),
    ),
    removeListener: vi.fn((channel: string, listener: (...args: unknown[]) => void) =>
      emitter.removeListener(channel, listener),
    ),
  };
}

function createRecordingBridge() {
  const invokedChannels: string[] = [];
  const bridge: IpcBridge = {
    invoke: vi.fn(async (channel: string) => {
      invokedChannels.push(channel);
      return undefined as never;
    }) as IpcBridge['invoke'],
    subscribe: vi.fn(() => () => undefined) as IpcBridge['subscribe'],
    send: vi.fn() as IpcBridge['send'],
  };
  return { bridge, invokedChannels };
}

describe('When the IPC bridge subscribes to main-process events', () => {
  it('Then the listener receives the payload without the IPC event object', () => {
    // Arrange
    const ipcRenderer = createFakeIpcRenderer();
    const bridge = createIpcBridge(ipcRenderer);
    const listener = vi.fn();

    // Act
    bridge.subscribe('settings-updated', listener);
    ipcRenderer.emitter.emit('settings-updated', { sender: 'event' }, { theme: 'dark' });

    // Assert
    expect(listener).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('Then calling the returned unsubscribe function removes the registered listener', () => {
    // Arrange
    const ipcRenderer = createFakeIpcRenderer();
    const bridge = createIpcBridge(ipcRenderer);
    const listener = vi.fn();
    const unsubscribe = bridge.subscribe('grail-progress-updated', listener);

    // Act
    unsubscribe();
    ipcRenderer.emitter.emit('grail-progress-updated', {});

    // Assert
    expect(listener).not.toHaveBeenCalled();
    expect(ipcRenderer.emitter.listenerCount('grail-progress-updated')).toBe(0);
  });

  it('Then unsubscribing one listener keeps the other listeners of the channel', () => {
    // Arrange
    const ipcRenderer = createFakeIpcRenderer();
    const bridge = createIpcBridge(ipcRenderer);
    const removed = vi.fn();
    const kept = vi.fn();
    const unsubscribe = bridge.subscribe('save-file-event', removed);
    bridge.subscribe('save-file-event', kept);

    // Act
    unsubscribe();
    unsubscribe();
    ipcRenderer.emitter.emit('save-file-event', {}, { type: 'modified' });

    // Assert
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.removeListener).toHaveBeenCalledTimes(1);
  });

  it('If the channel is not in the event allowlist, Then subscribing throws', () => {
    // Arrange
    const ipcRenderer = createFakeIpcRenderer();
    const bridge = createIpcBridge(ipcRenderer);

    // Act
    const subscribe = () => bridge.subscribe('grail:getSettings' as 'settings-updated', vi.fn());

    // Assert
    expect(subscribe).toThrow('Unknown IPC event channel: grail:getSettings');
    expect(ipcRenderer.on).not.toHaveBeenCalled();
  });

  it('If the listener is not a function, Then subscribing throws', () => {
    // Arrange
    const bridge = createIpcBridge(createFakeIpcRenderer());

    // Act
    const subscribe = () => bridge.subscribe('settings-updated', 'nope' as never);

    // Assert
    expect(subscribe).toThrow('IPC event listener must be a function');
  });
});

describe('When the IPC bridge sends or invokes', () => {
  it('Then send forwards allowlisted channels with their payload', () => {
    // Arrange
    const ipcRenderer = createFakeIpcRenderer();
    const bridge = createIpcBridge(ipcRenderer);
    const payload = { active: true, id: 'vault-1', gridWidth: 1, gridHeight: 2 };

    // Act
    bridge.send(VAULT_DRAG_STATE_CHANNEL, payload);

    // Assert
    expect(ipcRenderer.send).toHaveBeenCalledWith(VAULT_DRAG_STATE_CHANNEL, payload);
  });

  it('If the send channel is not allowlisted, Then send throws', () => {
    // Arrange
    const ipcRenderer = createFakeIpcRenderer();
    const bridge = createIpcBridge(ipcRenderer);

    // Act
    const send = () =>
      bridge.send('grail:updateSettings' as typeof VAULT_DRAG_STATE_CHANNEL, {} as never);

    // Assert
    expect(send).toThrow('Unknown IPC send channel: grail:updateSettings');
    expect(ipcRenderer.send).not.toHaveBeenCalled();
  });

  it('Then invoke forwards the channel and arguments and resolves with the result', async () => {
    // Arrange
    const ipcRenderer = createFakeIpcRenderer();
    const bridge = createIpcBridge(ipcRenderer);

    // Act
    const result = await bridge.invoke('grail:getProgress', 'char-1');

    // Assert
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('grail:getProgress', 'char-1');
    expect(result).toBe('result');
  });
});

describe('When the renderer API is created from the bridge', () => {
  it('Then every invoke channel of the contract is reachable through an API method', async () => {
    // Arrange
    const { bridge, invokedChannels } = createRecordingBridge();
    const api = createElectronAPI(bridge, 'win32');
    const callAll = (node: unknown) => {
      for (const value of Object.values(node as Record<string, unknown>)) {
        if (typeof value === 'function') {
          (value as (...args: unknown[]) => unknown)({});
        } else if (value && typeof value === 'object') {
          callAll(value);
        }
      }
    };

    // Act
    callAll(api);

    // Assert
    expect([...new Set(invokedChannels)].sort()).toEqual([...IPC_INVOKE_CHANNELS].sort());
  });

  it('Then the drag-state helpers send on the shared drag-state channels', () => {
    // Arrange
    const { bridge } = createRecordingBridge();
    const api = createElectronAPI(bridge, 'linux');
    const vaultPayload = { active: false, id: 'vault-1', gridWidth: 1, gridHeight: 1 };
    const itemPayload = {
      active: true,
      fingerprint: 'fp',
      sourceFilePath: '/saves/Sorc.d2s',
      sourceFileType: 'd2s' as const,
      sourceLocationContext: 'inventory',
      rawItemJson: '{}',
      gridWidth: 1,
      gridHeight: 1,
    };

    // Act
    api.inventory.sendVaultDragState(vaultPayload);
    api.inventory.sendItemDragState(itemPayload);

    // Assert
    expect(bridge.send).toHaveBeenCalledWith(VAULT_DRAG_STATE_CHANNEL, vaultPayload);
    expect(bridge.send).toHaveBeenCalledWith(INVENTORY_DRAG_STATE_CHANNEL, itemPayload);
  });

  it('Then the event helpers subscribe to their channels and return the unsubscribe function', () => {
    // Arrange
    const { bridge } = createRecordingBridge();
    const api = createElectronAPI(bridge, 'darwin');
    const callback = vi.fn();

    // Act
    const unsubscribers = [
      api.data.onServiceError(callback),
      api.update.onUpdateStatus(callback),
      api.runTracker.onGlobalHotkeyStatus(callback),
      api.on('item-detection-event', callback),
    ];

    // Assert
    expect(unsubscribers.every((unsubscribe) => typeof unsubscribe === 'function')).toBe(true);
    expect(vi.mocked(bridge.subscribe).mock.calls.map(([channel]) => channel)).toEqual([
      'service-error',
      'update:status',
      'run-tracker:global-hotkey-status',
      'item-detection-event',
    ]);
    expect(api.platform).toBe('darwin');
  });
});
