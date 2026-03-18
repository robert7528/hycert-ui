import type { Metadata } from 'next'
import { LocaleProvider } from '@/contexts/locale-context'
import { HeightSync } from '@/components/height-sync'
import './globals.css'

export const metadata: Metadata = {
  title: 'HySP Certificate',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        <LocaleProvider>
          {children}
        </LocaleProvider>
        <HeightSync />
      </body>
    </html>
  )
}
