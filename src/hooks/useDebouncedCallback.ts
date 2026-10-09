import { useEffect, useMemo, useRef } from 'react';

/**
 * A debounced function: calling it (re)starts the delay, and only the last call's arguments are
 * passed to the callback once the delay elapses.
 */
interface DebouncedCallback<Args extends unknown[]> {
  (...args: Args): void;
  /** Drops the pending call, if any. */
  cancel: () => void;
  /** Runs the pending call immediately, if any. */
  flush: () => void;
  /** Whether a call is waiting for the delay to elapse. */
  isPending: () => boolean;
}

interface DebouncedCallbackOptions {
  /** Run a pending call when the component unmounts instead of dropping it. */
  flushOnUnmount?: boolean;
}

/**
 * Debounces a callback. The returned function keeps its identity as long as the delay does not
 * change, and always calls the latest callback. A pending call is dropped on unmount unless
 * `flushOnUnmount` is set.
 * @param callback - Function to call once the calls have settled
 * @param delayMs - Time without further calls before the callback runs
 * @param options - Unmount behavior
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
  { flushOnUnmount = false }: DebouncedCallbackOptions = {},
): DebouncedCallback<Args> {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  const debounced = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendingArgs: Args | undefined;

    const invoke = () => {
      const args = pendingArgs;
      timer = undefined;
      pendingArgs = undefined;
      if (args) {
        callbackRef.current(...args);
      }
    };

    const call = (...args: Args) => {
      pendingArgs = args;
      clearTimeout(timer);
      timer = setTimeout(invoke, delayMs);
    };

    return Object.assign(call, {
      cancel: () => {
        clearTimeout(timer);
        timer = undefined;
        pendingArgs = undefined;
      },
      flush: () => {
        if (timer === undefined) return;
        clearTimeout(timer);
        invoke();
      },
      isPending: () => timer !== undefined,
    });
  }, [delayMs]);

  useEffect(
    () => () => {
      if (flushOnUnmount) {
        debounced.flush();
      } else {
        debounced.cancel();
      }
    },
    [debounced, flushOnUnmount],
  );

  return debounced;
}
