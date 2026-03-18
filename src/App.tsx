import { LocaleProvider } from '@/contexts/locale-context'
import { CertRouter } from '@/components/cert/cert-router'

export default function App() {
  return (
    <LocaleProvider>
      <CertRouter />
    </LocaleProvider>
  )
}
