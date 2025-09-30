/**
 * Type utility that recursively converts translation JSON structure to an object type.
 * Transforms string values to string type and recursively processes nested objects.
 * @template T - The translation JSON type to convert
 */
export type ConvertedToObjectType<T> = {
  [P in keyof T]: T[P] extends string ? string : ConvertedToObjectType<T[P]>;
};

/**
 * Type representing the structure of translation JSON files.
 * Based on the English common translation file.
 */
export type TranslationJsonType = typeof import('./locales/en/common.json');
