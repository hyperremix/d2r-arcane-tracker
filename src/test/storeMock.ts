import type { Mock } from 'vitest';

/**
 * Makes a mocked zustand store hook (e.g. `vi.mocked(useGrailStore)`) behave like the real one
 * for the given state: called with a selector it returns the selected slice, called without one
 * it returns the whole state.
 * @param hook - The mocked store hook
 * @param state - The store state to serve
 */
export function mockStoreState(hook: unknown, state: unknown): void {
  (hook as Mock).mockImplementation((selector?: unknown) =>
    typeof selector === 'function' ? selector(state) : state,
  );
}
