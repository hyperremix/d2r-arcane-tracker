import type { WebContents } from 'electron';
import type { EventChannel, EventPayload } from './contract';

/** The parts of `WebContents` needed to deliver an event. */
export type RendererTarget = Pick<WebContents, 'isDestroyed' | 'send'>;

/** The parts of `WebContents` needed to broadcast to renderer windows. */
export type BroadcastTarget = RendererTarget & Pick<WebContents, 'getType'>;

/** Arguments after the channel: the payload, optional for events without one. */
export type EventArgs<C extends EventChannel> =
  undefined extends EventPayload<C> ? [payload?: EventPayload<C>] : [payload: EventPayload<C>];

/**
 * Sends an event from the IPC contract to one renderer, unless it was destroyed.
 * @param target - Web contents of the receiving window
 * @param channel - Event channel from the contract
 * @param args - The event payload
 */
export function sendToRenderer<C extends EventChannel>(
  target: RendererTarget,
  channel: C,
  ...args: EventArgs<C>
): void {
  if (target.isDestroyed()) {
    return;
  }
  target.send(channel, ...args);
}

/** Sends an event from the IPC contract to every renderer window. */
export type BroadcastToRenderers = <C extends EventChannel>(
  channel: C,
  ...args: EventArgs<C>
) => void;

/**
 * Creates `broadcastToRenderers`, which sends an event from the IPC contract to every renderer
 * window. Destroyed web contents and non-window contents (DevTools, background pages) are skipped.
 *
 * @param getAllWebContents - Returns all web contents (Electron's `webContents.getAllWebContents`);
 *   handler modules pass a closure over their own `electron` import
 * @returns The broadcast function
 */
export function createRendererBroadcaster(
  getAllWebContents: () => BroadcastTarget[],
): BroadcastToRenderers {
  return function broadcastToRenderers<C extends EventChannel>(
    channel: C,
    ...args: EventArgs<C>
  ): void {
    for (const target of getAllWebContents() ?? []) {
      if (!target.isDestroyed() && target.getType() === 'window') {
        target.send(channel, ...args);
      }
    }
  };
}
