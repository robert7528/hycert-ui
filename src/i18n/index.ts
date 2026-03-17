import zhTW from './locales/zh-TW'
import en from './locales/en'

export type Locale = 'zh-TW' | 'en'

/** Recursively widen literal string types to `string` while keeping structure */
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>
}

export type Dictionary = DeepStringify<typeof zhTW>

export const locales: Record<Locale, Dictionary> = {
  'zh-TW': zhTW,
  en,
}

export const defaultLocale: Locale = 'zh-TW'
