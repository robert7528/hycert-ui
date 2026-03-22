'use client'

import { useState } from 'react'
import { useLocale } from '@/contexts/locale-context'
import { Button, Input, Label, toast } from '@hysp/ui-kit'
import { Loader2 } from 'lucide-react'
import { NativeSelect } from '@/components/ui/native-select'
import { csrCrudApi } from '@/lib/cert-api'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CSRGenerateDialog({ open, onClose, onSuccess }: Props) {
  const { t } = useLocale()
  const cl = t.hycert.certList

  const [domain, setDomain] = useState('')
  const [sans, setSans] = useState('')
  const [org, setOrg] = useState('')
  const [orgUnit, setOrgUnit] = useState('')
  const [country, setCountry] = useState('')
  const [state, setState] = useState('')
  const [locality, setLocality] = useState('')
  const [keyType, setKeyType] = useState('RSA')
  const [keyBits, setKeyBits] = useState('2048')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const reset = () => {
    setDomain('')
    setSans('')
    setOrg('')
    setOrgUnit('')
    setCountry('')
    setState('')
    setLocality('')
    setKeyType('RSA')
    setKeyBits('2048')
  }

  const keyBitsOptions = keyType === 'RSA'
    ? [{ value: '2048', label: '2048' }, { value: '4096', label: '4096' }]
    : [{ value: '256', label: 'P-256' }, { value: '384', label: 'P-384' }]

  const handleSubmit = async () => {
    if (!domain.trim()) return
    setLoading(true)
    try {
      const sansArr = sans.trim()
        ? sans.split(',').map(s => s.trim()).filter(Boolean)
        : undefined

      const subject: Record<string, string> = {}
      if (org) subject.o = org
      if (orgUnit) subject.ou = orgUnit
      if (country) subject.c = country
      if (state) subject.st = state
      if (locality) subject.l = locality

      const resp = await csrCrudApi.generate({
        domain: domain.trim(),
        sans: sansArr,
        subject: Object.keys(subject).length > 0 ? subject : undefined,
        key_type: keyType,
        key_bits: parseInt(keyBits),
      })

      toast.success(cl.csrGenerateSuccess)

      // Auto-download CSR file
      if (resp.data) {
        try {
          const dlResp = await csrCrudApi.download(resp.data.id)
          const data = dlResp.data!
          const blob = new Blob([data.content], { type: 'application/x-pem-file' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = data.filename || `${domain.trim()}.csr`
          a.click()
          URL.revokeObjectURL(url)
        } catch {
          // Download is best-effort
        }
      }

      reset()
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{cl.csrGenerateTitle}</h2>
            <p className="text-sm text-muted-foreground">{cl.csrGenerateDesc}</p>
          </div>

          <div className="space-y-2">
            <Label>{cl.csrDomain}</Label>
            <Input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>{cl.csrSans}</Label>
            <Input
              value={sans}
              onChange={e => setSans(e.target.value)}
              placeholder="api.example.com, *.example.com"
            />
            <p className="text-xs text-muted-foreground">{cl.csrSansHint}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{cl.csrOrg}</Label>
              <Input value={org} onChange={e => setOrg(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{cl.csrOrgUnit}</Label>
              <Input value={orgUnit} onChange={e => setOrgUnit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{cl.csrCountry}</Label>
              <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="TW" maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label>{cl.csrState}</Label>
              <Input value={state} onChange={e => setState(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{cl.csrLocality}</Label>
              <Input value={locality} onChange={e => setLocality(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{cl.csrKeyType}</Label>
              <NativeSelect value={keyType} onChange={v => { setKeyType(v); setKeyBits(v === 'RSA' ? '2048' : '256') }}>
                <option value="RSA">RSA</option>
                <option value="EC">EC</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label>{cl.csrKeyBits}</Label>
              <NativeSelect value={keyBits} onChange={setKeyBits}>
                {keyBitsOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { reset(); onClose() }}>
              {cl.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={!domain.trim() || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {cl.csrGenerateSubmit}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
