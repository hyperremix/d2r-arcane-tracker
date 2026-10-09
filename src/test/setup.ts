import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import Database from 'better-sqlite3';
import { afterEach } from 'vitest';
import { clearIconCache } from '../hooks/useIconsByFilename';
// The production i18n setup, so t() returns real English strings
import '../i18n';

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
