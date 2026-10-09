import en from './locales/en/common.json';
import type { ConvertedToObjectType, TranslationJsonType } from './types';

/** Nested translation keys; every leaf is the full dotted key path. */
interface TranslationKeyTree {
  [key: string]: string | TranslationKeyTree;
}

const PLURAL_SUFFIX_PATTERN = /_(zero|one|two|few|many|other)$/;

/**
 * Recursively converts a language JSON object to the same structure in which each leaf string is
 * replaced with its full key path, for type-safe translation access.
 * @param json - The (nested) translation JSON object
 * @param prefix - Key path of `json` (used for recursion)
 * @returns The key path tree
 */
function toKeyPaths(json: object, prefix?: string): TranslationKeyTree {
  const tree: TranslationKeyTree = {};
  for (const [key, value] of Object.entries(json)) {
    if (value !== null && typeof value === 'object') {
      tree[key] = toKeyPaths(value, prefix ? `${prefix}.${key}` : key);
    } else {
      // Plural variants (`key_one`, `key_other`, ...) share the base key so t(key, { count }) resolves them
      const baseKey = key.replace(PLURAL_SUFFIX_PATTERN, '');
      tree[baseKey] = prefix ? `${prefix}.${baseKey}` : baseKey;
    }
  }
  return tree;
}

/**
 * Translations object containing all translation keys as nested object paths.
 * This is used for type-safe translation key access throughout the application.
 */
export const translations = toKeyPaths(en) as unknown as ConvertedToObjectType<TranslationJsonType>;
