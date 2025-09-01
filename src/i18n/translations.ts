//@ts-nocheck
import en from './locales/en/common.json'
import type { ConvertedToObjectType, TranslationJsonType } from './types'

// biome-ignore lint/suspicious/noExplicitAny: ignore this
export const translations: ConvertedToObjectType<TranslationJsonType> = {} as any

const convertLanguageJsonToObject = (
  // biome-ignore lint/suspicious/noExplicitAny: ignore this
  json: any,
  objToConvertTo = translations,
  current?: string
) => {
  for (const key in json) {
    const currentLookupKey = current ? `${current}.${key}` : key
    if (typeof json[key] === 'object') {
      objToConvertTo[key] = {}
      convertLanguageJsonToObject(json[key], objToConvertTo[key], currentLookupKey)
    } else {
      objToConvertTo[key] = currentLookupKey
    }
  }
}

convertLanguageJsonToObject(en)
