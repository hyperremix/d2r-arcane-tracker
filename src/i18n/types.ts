/**
 * i18next plural suffixes. Plural variants such as `description_one` / `description_other`
 * are exposed under their shared base key (`description`) so `t(key, { count })` can pick the form.
 */
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type PluralBaseKey<K, V> = V extends string
  ? K extends `${infer Base}_${PluralSuffix}`
    ? Base
    : K
  : K;

/**
 * Type utility that recursively converts translation JSON structure to an object type.
 * Transforms string values to string type and recursively processes nested objects.
 * @template T - The translation JSON type to convert
 */
export type ConvertedToObjectType<T> = {
  [P in keyof T as PluralBaseKey<P, T[P]>]: T[P] extends string
    ? string
    : ConvertedToObjectType<T[P]>;
};

/**
 * Type representing the structure of translation JSON files.
 * Based on the English common translation file.
 */
export type TranslationJsonType = typeof import('./locales/en/common.json');
