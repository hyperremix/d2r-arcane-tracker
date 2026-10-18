import { useEffect, useState } from 'react';

/**
 * Follows a value once it has stopped changing for the delay. The first value is returned
 * immediately; the timer is cleared when the value changes again or the component unmounts.
 * @param value - The value to follow
 * @param delayMs - Time without a change before the returned value catches up
 * @returns The value as it was `delayMs` ago, at the latest
 */
export function useDebouncedValue<Value>(value: Value, delayMs: number): Value {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
