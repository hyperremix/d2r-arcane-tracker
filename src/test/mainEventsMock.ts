import { vi } from 'vitest';

type Listener = (payload: unknown) => void;

/**
 * Test double for `window.electronAPI.on`: keeps real listener bookkeeping so tests can emit
 * main-process events and check that unsubscribing removed the listener.
 */
export function createMainEventsMock() {
  const listeners = new Map<string, Set<Listener>>();

  const on = vi.fn((channel: string, listener: Listener) => {
    const channelListeners = listeners.get(channel) ?? new Set<Listener>();
    channelListeners.add(listener);
    listeners.set(channel, channelListeners);
    return () => {
      channelListeners.delete(listener);
    };
  });

  return {
    /** Use as `window.electronAPI.on`. */
    on,
    /** Delivers an event to every listener currently subscribed to the channel. */
    emit(channel: string, payload?: unknown): void {
      for (const listener of [...(listeners.get(channel) ?? [])]) {
        listener(payload);
      }
    },
    /** Number of listeners currently subscribed to the channel. */
    listenerCount(channel: string): number {
      return listeners.get(channel)?.size ?? 0;
    },
    /** Removes all listeners and clears the recorded calls. */
    reset(): void {
      listeners.clear();
      on.mockClear();
    },
  };
}

export type MainEventsMock = ReturnType<typeof createMainEventsMock>;
