import { LocaleProvider } from '@/contexts/locale-context'
import { CertRouter } from '@/components/cert/cert-router'
import { Toaster } from '@hysp/ui-kit'

export default function App() {
  return (
    <LocaleProvider>
      <CertRouter />
      <Toaster />
    </LocaleProvider>
  )
}
