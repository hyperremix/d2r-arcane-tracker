import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createIpcMainRegistry, type IpcMainLike } from './handle';
import { IpcValidationError } from './validation';

type RegisteredHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

function createFakeIpcMain() {
  return {
    handle: vi.fn(),
    removeHandler: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

function getRegisteredHandler(
  ipcMain: ReturnType<typeof createFakeIpcMain>,
  channel: string,
): RegisteredHandler {
  const call = ipcMain.handle.mock.calls.find(([registered]) => registered === channel);
  if (!call) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return call[1] as RegisteredHandler;
}

describe('When an invoke handler is registered with handle()', () => {
  let consoleError: MockInstance;
  let ipcMain: ReturnType<typeof createFakeIpcMain>;

  beforeEach(() => {
    ipcMain = createFakeIpcMain();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('Then the handler receives the event and the validated arguments', async () => {
    // Arrange
    const { handle } = createIpcMainRegistry(ipcMain as unknown as IpcMainLike);
    const handler = vi.fn(() => []);
    handle('run-tracker:get-runs-by-session', handler);
    const event = { sender: { id: 1 } };

    // Act
    const result = await getRegisteredHandler(ipcMain, 'run-tracker:get-runs-by-session')(
      event,
      'session-1',
    );

    // Assert
    expect(handler).toHaveBeenCalledWith(event, 'session-1');
    expect(result).toEqual([]);
  });

  it('If the arguments violate the contract, Then the call rejects and the handler does not run', async () => {
    // Arrange
    const { handle } = createIpcMainRegistry(ipcMain as unknown as IpcMainLike);
    const handler = vi.fn(() => []);
    handle('run-tracker:get-runs-by-session', handler);

    // Act
    const result = getRegisteredHandler(ipcMain, 'run-tracker:get-runs-by-session')(
      {},
      { id: 'x' },
    );

    // Assert
    await expect(result).rejects.toBeInstanceOf(IpcValidationError);
    await expect(result).rejects.toThrow('Invalid session ID');
    expect(handler).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[IPC.run-tracker:get-runs-by-session]',
      expect.any(IpcValidationError),
    );
  });

  it('If the handler throws, Then the error is logged with the channel and rethrown', async () => {
    // Arrange
    const { handle } = createIpcMainRegistry(ipcMain as unknown as IpcMainLike);
    const failure = new Error('database locked');
    handle('grail:getCharacters', () => {
      throw failure;
    });

    // Act
    const result = getRegisteredHandler(ipcMain, 'grail:getCharacters')({});

    // Assert
    await expect(result).rejects.toBe(failure);
    expect(consoleError).toHaveBeenCalledWith('[IPC.grail:getCharacters]', failure);
  });

  it('Then extra arguments beyond the contract are not passed to the handler', async () => {
    // Arrange
    const { handle } = createIpcMainRegistry(ipcMain as unknown as IpcMainLike);
    const handler = vi.fn(() => []);
    handle('grail:getItems', handler);

    // Act
    await getRegisteredHandler(ipcMain, 'grail:getItems')({}, 'unexpected', 42);

    // Assert
    expect(handler).toHaveBeenCalledWith({});
  });
});

describe('When handlers and renderer message listeners are removed', () => {
  it('Then removeHandler removes the channel handler', () => {
    // Arrange
    const ipcMain = createFakeIpcMain();
    const { removeHandler } = createIpcMainRegistry(ipcMain as unknown as IpcMainLike);

    // Act
    removeHandler('run-tracker:get-global-hotkey-status');

    // Assert
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('run-tracker:get-global-hotkey-status');
  });

  it('Then the function returned by onRendererMessage removes the same listener', () => {
    // Arrange
    const ipcMain = createFakeIpcMain();
    const { onRendererMessage } = createIpcMainRegistry(ipcMain as unknown as IpcMainLike);
    const listener = vi.fn();
    const unsubscribe = onRendererMessage('inventory:vault-drag-state', listener);

    // Act
    unsubscribe();

    // Assert
    expect(ipcMain.on).toHaveBeenCalledWith('inventory:vault-drag-state', listener);
    expect(ipcMain.removeListener).toHaveBeenCalledWith('inventory:vault-drag-state', listener);
  });
});
