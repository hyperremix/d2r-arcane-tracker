import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { clearIconCache } from '../hooks/useIconsByFilename';
// The production i18n setup, so t() returns real English strings
import '../i18n';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test case
afterEach(() => {
  cleanup();
  // The icon cache is module state shared by all test files (isolate: false)
  clearIconCache();
});
