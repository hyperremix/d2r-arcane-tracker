export type ConvertedToObjectType<T> = {
  [P in keyof T]: T[P] extends string ? string : ConvertedToObjectType<T[P]>;
};

export type TranslationJsonType = typeof import('./locales/en/common.json');
