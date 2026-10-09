import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { createServiceLogger } from '../utils/serviceLogger';
import type { InvokeArgs, InvokeChannel, InvokeResult, SendChannel } from './contract';
import type { ArgsValidator } from './validation';
import { invokeArgValidators } from './validators';

const log = createServiceLogger('IPC');

/** The subset of Electron's `ipcMain` the registry relies on. */
export type IpcMainLike = Pick<IpcMain, 'handle' | 'removeHandler' | 'on' | 'removeListener'>;

/**
 * Main-process implementation of an invoke channel. Receives the validated arguments.
 */
export type InvokeHandler<C extends InvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: InvokeArgs<C>
) => InvokeResult<C> | Promise<InvokeResult<C>>;

/**
 * Typed registration helpers bound to an `ipcMain` instance.
 */
export interface IpcMainRegistry {
  /**
   * Registers the main-process handler of an invoke channel from the IPC contract.
   *
   * The renderer-provided arguments are validated with the channel's validator before the
   * handler runs. Validation and handler errors are logged with the channel as operation and
   * rethrown, so the renderer's `invoke` promise rejects.
   *
   * @param channel - Invoke channel from the contract
   * @param handler - Implementation receiving the validated, typed arguments
   */
  handle<C extends InvokeChannel>(channel: C, handler: InvokeHandler<C>): void;

  /**
   * Removes the main-process handler of an invoke channel.
   * @param channel - Invoke channel from the contract
   */
  removeHandler(channel: InvokeChannel): void;

  /**
   * Listens for fire-and-forget messages a renderer sends on a channel from the contract.
   * The payload is untrusted and must be validated by the listener.
   *
   * @param channel - Send channel from the contract
   * @param listener - Called with the sender event and the raw payload
   * @returns Function that removes the listener
   */
  onRendererMessage(
    channel: SendChannel,
    listener: (event: IpcMainEvent, payload: unknown) => void,
  ): () => void;
}

/**
 * Creates the typed registration helpers for `ipcMain`.
 *
 * Handler modules pass in the `ipcMain` they import, which keeps this module free of a direct
 * Electron import (tests share one module registry, so each handler module must keep using the
 * `electron` module its own test mocks).
 *
 * @param ipcMain - Electron's `ipcMain`
 * @returns Registry used to register handlers and listeners
 */
export function createIpcMainRegistry(ipcMain: IpcMainLike): IpcMainRegistry {
  return {
    handle(channel, handler) {
      const validate = invokeArgValidators[channel] as ArgsValidator<InvokeArgs<typeof channel>>;

      ipcMain.handle(channel, async (event, ...rawArgs: unknown[]) => {
        try {
          const args = validate(rawArgs);
          return await handler(event, ...args);
        } catch (error) {
          log.error(channel, error);
          throw error;
        }
      });
    },

    removeHandler(channel) {
      ipcMain.removeHandler(channel);
    },

    onRendererMessage(channel, listener) {
      ipcMain.on(channel, listener);
      return () => {
        ipcMain.removeListener(channel, listener);
      };
    },
  };
}
