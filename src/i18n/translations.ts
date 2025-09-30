//@ts-nocheck
import en from './locales/en/common.json';
import type { ConvertedToObjectType, TranslationJsonType } from './types';

/**
 * Translations object containing all translation keys as nested object paths.
 * This is used for type-safe translation key access throughout the application.
 */
// biome-ignore lint/suspicious/noExplicitAny: ignore this
export const translations: ConvertedToObjectType<TranslationJsonType> = {} as any;

/**
 * Recursively converts a language JSON file to a nested object structure.
 * Each leaf string value is replaced with the full key path for type-safe translation access.
 * @param {any} json - The JSON object to convert
 * @param {Object} [objToConvertTo=translations] - The target object to populate
 * @param {string} [current] - The current key path (used for recursion)
 */
const convertLanguageJsonToObject = (
  // biome-ignore lint/suspicious/noExplicitAny: ignore this
  json: any,
  objToConvertTo = translations,
  current?: string,
) => {
  for (const key in json) {
    const currentLookupKey = current ? `${current}.${key}` : key;
    if (typeof json[key] === 'object') {
      objToConvertTo[key] = {};
      convertLanguageJsonToObject(json[key], objToConvertTo[key], currentLookupKey);
    } else {
      objToConvertTo[key] = currentLookupKey;
    }
  }
};

convertLanguageJsonToObject(en);
