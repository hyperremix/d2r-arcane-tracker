import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach, expect } from 'vitest';
import en from '../i18n/locales/en/common.json';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Initialize i18next for tests so t() returns real English strings
i18n.use(initReactI18next).init({
  lng: 'en',
  ns: ['common'],
  defaultNS: 'common',
  resources: { en: { common: en } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Cleanup after each test case
afterEach(() => {
  cleanup();
});
