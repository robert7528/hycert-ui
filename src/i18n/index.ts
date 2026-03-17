import type { Locale } from '@hysp/ui-kit'
import zhTW from './locales/zh-TW'
import en from './locales/en'

type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>
}

export type Dictionary = DeepStringify<typeof zhTW>

export const locales: Record<Locale, Dictionary> = {
  'zh-TW': zhTW,
  en,
}

export type { Locale }
