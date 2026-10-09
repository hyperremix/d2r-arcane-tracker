import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { createServiceLogger } from '../utils/serviceLogger';
import type { InvokeArgs, InvokeChannel, InvokeResult, SendChannel, SendPayload } from './contract';
import type { ArgsValidator, FieldValidator } from './validation';
import { invokeArgValidators, sendPayloadValidators } from './validators';

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
   * The payload is validated with the channel's validator first; invalid messages are logged and
   * dropped (a send has no caller to reject).
   *
   * @param channel - Send channel from the contract
   * @param listener - Called with the sender event and the validated payload
   * @returns Function that removes the listener
   */
  onRendererMessage<C extends SendChannel>(
    channel: C,
    listener: (event: IpcMainEvent, payload: SendPayload<C>) => void,
  ): () => void;

  /**
   * Removes every handler and listener registered through this registry. Handler modules return
   * it (or call it from their own teardown) so the app lifecycle can unregister them on shutdown.
   */
  dispose(): void;
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
  const handledChannels = new Set<InvokeChannel>();
  const listenerRemovers = new Set<() => void>();

  return {
    handle(channel, handler) {
      const validate = invokeArgValidators[channel] as ArgsValidator<InvokeArgs<typeof channel>>;

      handledChannels.add(channel);
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
      handledChannels.delete(channel);
      ipcMain.removeHandler(channel);
    },

    onRendererMessage(channel, listener) {
      const validate = sendPayloadValidators[channel] as FieldValidator<
        SendPayload<typeof channel>
      >;
      const validatingListener = (event: IpcMainEvent, rawPayload: unknown) => {
        let payload: SendPayload<typeof channel>;
        try {
          payload = validate(rawPayload);
        } catch (error) {
          log.warn(channel, 'Dropped invalid renderer message', {
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }
        listener(event, payload);
      };

      ipcMain.on(channel, validatingListener);
      const removeListener = () => {
        listenerRemovers.delete(removeListener);
        ipcMain.removeListener(channel, validatingListener);
      };
      listenerRemovers.add(removeListener);
      return removeListener;
    },

    dispose() {
      for (const channel of handledChannels) {
        ipcMain.removeHandler(channel);
      }
      handledChannels.clear();
      for (const removeListener of [...listenerRemovers]) {
        removeListener();
      }
    },
  };
}
