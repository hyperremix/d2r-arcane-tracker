import type { GlobalHotkeyStatus } from 'electron/types/grail';
import { useEffect, useState } from 'react';

/**
 * Returns whether at least one run tracker shortcut is registered as a global hotkey.
 * @param status - The current global hotkey status
 */
export function isGlobalHotkeysActive(status: GlobalHotkeyStatus | undefined): boolean {
  return Boolean(
    status?.enabled &&
      status.registrations.some((registration) => registration.state === 'registered'),
  );
}

/**
 * Subscribes to the registration status of the run tracker global hotkeys.
 * @returns The latest status, or undefined until it has been loaded
 */
export function useGlobalHotkeyStatus(): GlobalHotkeyStatus | undefined {
  const [status, setStatus] = useState<GlobalHotkeyStatus | undefined>(undefined);

  useEffect(() => {
    const runTrackerApi = window.electronAPI?.runTracker;
    let cancelled = false;
    let receivedUpdate = false;

    const unsubscribe = runTrackerApi?.onGlobalHotkeyStatus?.((nextStatus) => {
      receivedUpdate = true;
      setStatus(nextStatus);
    });

    runTrackerApi
      ?.getGlobalHotkeyStatus?.()
      .then((initialStatus) => {
        // A pushed update is newer than the initial query result
        if (!cancelled && !receivedUpdate) {
          setStatus(initialStatus);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load global hotkey status:', error);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return status;
}
