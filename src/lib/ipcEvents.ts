import type { EventChannel, EventListener } from 'electron/ipc/contract';

const noop = () => undefined;

/**
 * Subscribes to an event the main process pushes to renderer windows.
 *
 * Return the result from the effect cleanup: it removes exactly this listener. Outside Electron
 * (no preload bridge) nothing is subscribed and a no-op is returned.
 *
 * @param channel - Event channel from the IPC contract
 * @param listener - Called with the event payload
 * @returns Function that removes the listener
 */
export function onMainEvent<C extends EventChannel>(
  channel: C,
  listener: EventListener<C>,
): () => void {
  return window.electronAPI?.on?.(channel, listener) ?? noop;
}

/**
 * Combines the unsubscribe functions of several {@link onMainEvent} subscriptions.
 * @param unsubscribers - Functions returned by {@link onMainEvent}
 * @returns Function that removes all listeners
 */
export function combineUnsubscribers(unsubscribers: Array<() => void>): () => void {
  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}
