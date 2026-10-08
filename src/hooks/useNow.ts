import { useEffect, useState } from 'react';

/**
 * Returns the current timestamp in milliseconds and refreshes it every `intervalMs`
 * while `enabled` is true. The interval is cleared when disabled or on unmount.
 * @param {boolean} enabled - Whether the clock should tick
 * @param {number} [intervalMs=1000] - Tick interval in milliseconds
 * @returns {number} The latest timestamp from `Date.now()`
 */
export function useNow(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [enabled, intervalMs]);

  return now;
}
