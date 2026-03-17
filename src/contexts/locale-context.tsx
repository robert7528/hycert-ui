'use client'

import { LocaleProvider as BaseLocaleProvider, useLocale } from '@hysp/ui-kit'
import { locales } from '@/i18n'

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseLocaleProvider locales={locales} defaultLocale="zh-TW">
      {children}
    </BaseLocaleProvider>
  )
}

export { useLocale }
