import { vi } from 'vitest';

/**
 * Shared `sonner` toast mock for component tests.
 *
 * Vitest runs test files without isolation (`isolate: false`), so a module shared by several
 * suites (e.g. `@/hooks/useDatabaseBackup`) keeps the `sonner` binding from whichever suite
 * loaded it first. Suites that mock `sonner` with `vi.mock('sonner', () => import('@/test/sonnerMock'))`
 * share these spies, so assertions hold regardless of file order.
 */
export const toast = {
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
};
