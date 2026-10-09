import { type IpcMainEvent, type IpcMainInvokeEvent, ipcMain } from 'electron';
import { createServiceLogger } from '../utils/serviceLogger';
import type { InvokeArgs, InvokeChannel, InvokeResult, SendChannel } from './contract';
import type { ArgsValidator } from './validation';
import { invokeArgValidators } from './validators';

const log = createServiceLogger('IPC');

/**
 * Main-process implementation of an invoke channel. Receives the validated arguments.
 */
export type InvokeHandler<C extends InvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: InvokeArgs<C>
) => InvokeResult<C> | Promise<InvokeResult<C>>;

/**
 * Registers the main-process handler of an invoke channel from the IPC contract.
 *
 * The renderer-provided arguments are validated with the channel's validator before the handler
 * runs. Validation and handler errors are logged with the channel as operation and rethrown, so
 * the renderer's `invoke` promise rejects.
 *
 * @param channel - Invoke channel from the contract
 * @param handler - Implementation receiving the validated, typed arguments
 */
export function handle<C extends InvokeChannel>(channel: C, handler: InvokeHandler<C>): void {
  const validate = invokeArgValidators[channel] as ArgsValidator<InvokeArgs<C>>;

  ipcMain.handle(channel, async (event, ...rawArgs: unknown[]) => {
    try {
      const args = validate(rawArgs);
      return await handler(event, ...args);
    } catch (error) {
      log.error(channel, error);
      throw error;
    }
  });
}

/**
 * Removes the main-process handler of an invoke channel.
 * @param channel - Invoke channel from the contract
 */
export function removeHandler(channel: InvokeChannel): void {
  ipcMain.removeHandler(channel);
}

/**
 * Listens for fire-and-forget messages a renderer sends on a channel from the contract.
 * The payload is untrusted and must be validated by the listener.
 *
 * @param channel - Send channel from the contract
 * @param listener - Called with the sender event and the raw payload
 * @returns Function that removes the listener
 */
export function onRendererMessage(
  channel: SendChannel,
  listener: (event: IpcMainEvent, payload: unknown) => void,
): () => void {
  ipcMain.on(channel, listener);
  return () => {
    ipcMain.removeListener(channel, listener);
  };
}
