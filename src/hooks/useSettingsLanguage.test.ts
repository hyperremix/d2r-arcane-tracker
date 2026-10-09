import { act, renderHook } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, resolveSupportedLanguage } from '@/i18n';
import { useGrailStore } from '@/stores/grailStore';
import { useSettingsLanguage } from './useSettingsLanguage';

describe('When the language setting is applied', () => {
  const initialGrailState = useGrailStore.getInitialState();

  beforeEach(async () => {
    useGrailStore.setState(initialGrailState, true);
    document.documentElement.lang = 'xx';
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
  });

  afterEach(async () => {
    useGrailStore.setState(initialGrailState, true);
    document.documentElement.lang = DEFAULT_LANGUAGE;
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
  });

  describe('If the settings are not loaded yet', () => {
    it('Then the document language is left alone', () => {
      // Arrange & Act
      renderHook(() => useSettingsLanguage());

      // Assert
      expect(document.documentElement.lang).toBe('xx');
    });
  });

  describe('If the settings load with a supported language', () => {
    it('Then it is used for the translations and the document', () => {
      // Arrange
      renderHook(() => useSettingsLanguage());

      // Act
      act(() => {
        useGrailStore.getState().hydrateSettings({ lang: 'en' });
      });

      // Assert
      expect(document.documentElement.lang).toBe('en');
      expect(i18n.language).toBe('en');
    });
  });

  describe('If the settings load with a language the app has no translations for', () => {
    it('Then the default language is used', () => {
      // Arrange
      renderHook(() => useSettingsLanguage());

      // Act
      act(() => {
        useGrailStore.getState().hydrateSettings({ lang: 'de' });
      });

      // Assert
      expect(document.documentElement.lang).toBe(DEFAULT_LANGUAGE);
      expect(i18n.language).toBe(DEFAULT_LANGUAGE);
    });
  });
});

describe('When resolveSupportedLanguage is called', () => {
  it('If the language is supported, Then it is returned', () => {
    // Arrange & Act
    const language = resolveSupportedLanguage('en');

    // Assert
    expect(language).toBe('en');
  });

  it('If the language is missing or unsupported, Then the default language is returned', () => {
    // Arrange & Act
    const languages = [resolveSupportedLanguage(undefined), resolveSupportedLanguage('de')];

    // Assert
    expect(languages).toEqual([DEFAULT_LANGUAGE, DEFAULT_LANGUAGE]);
  });
});

describe('When the app translations are initialised', () => {
  it('Then they are available synchronously without suspending', () => {
    // Arrange & Act
    const title = i18n.t('grail.title');

    // Assert
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.options.react?.useSuspense).toBe(false);
    expect(title).toBe('Holy Grail');
  });
});
