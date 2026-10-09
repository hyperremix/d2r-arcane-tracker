import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import Database from 'better-sqlite3';
import { afterEach } from 'vitest';
import { clearIconCache } from '@/lib/iconLoader';
// The production i18n setup, so t() returns real English strings
import '../i18n';
// Modules that show toasts and whose suites assert on the real `sonner` toasts. Test files share
// one module registry (isolate: false), so the suite that loads a module first decides its
// `sonner` binding for all later suites; e.g. a suite that mocks `sonner` and automocks the grail
// store would load the settings slice's dependencies with its mock. Loading them here, before any
// suite's `vi.mock('sonner', ...)` applies, keeps them bound to the real module.
import '../lib/updateActions';
import '../stores/settingsSaveFeedback';

// better-sqlite3 >= 13 picks its bundled prebuild from `process.platform` on the first
// connection and caches it. Several suites stub `process.platform` (and test files share one
// module registry), so open a connection while the real platform is still in place.
new Database(':memory:').close();

// Cleanup after each test case
afterEach(() => {
  cleanup();
  // The icon cache is module state shared by all test files (isolate: false)
  clearIconCache();
});
