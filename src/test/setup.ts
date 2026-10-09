import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { clearIconCache } from '../hooks/useIconsByFilename';
// The production i18n setup, so t() returns real English strings
import '../i18n';


// Cleanup after each test case
afterEach(() => {
  cleanup();
  // The icon cache is module state shared by all test files (isolate: false)
  clearIconCache();
});
