'use client'

import { useState } from 'react'
import { useLocale } from '@/contexts/locale-context'
import { Badge, Button, Separator, toast } from '@hysp/ui-kit'
import { Download, Loader2, X, Lock } from 'lucide-react'
import { csrCrudApi, type CSRDTO } from '@/lib/cert-api'

interface Props {
  csr: CSRDTO | null
  onClose: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE')
}

function parseSANs(sansStr: string): string[] {
  try {
    const arr = JSON.parse(sansStr)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function parseSubject(subjectStr: string): Record<string, string> {
  try {
    const obj = JSON.parse(subjectStr)
    return typeof obj === 'object' && obj !== null ? obj : {}
  } catch {
    return {}
  }
}

export function CSRDetailDialog({ csr, onClose }: Props) {
  const { t } = useLocale()
  const cl = t.hycert.certList

  const [downloading, setDownloading] = useState(false)

  if (!csr) return null

  const sans = parseSANs(csr.sans)
  const subject = parseSubject(csr.subject)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const resp = await csrCrudApi.download(csr.id)
      const data = resp.data!
      const blob = new Blob([data.content], { type: 'application/x-pem-file' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename || `${csr.common_name}.csr`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDownloading(false)
    }
  }

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all">{children}</span>
    </div>
  )

  const subjectLabels: Record<string, string> = {
    o: cl.csrOrg, ou: cl.csrOrgUnit, c: cl.csrCountry, st: cl.csrState, l: cl.csrLocality,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-lg shadow-lg w-full max-w-xl mx-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{cl.csrDetailTitle}</h2>
              <p className="text-sm text-muted-foreground">{csr.common_name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <Row label={cl.csrColumnCN}>{csr.common_name}</Row>
            <Row label={cl.csrDetailSANs}>
              {sans.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {sans.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
                </div>
              ) : '—'}
            </Row>
            <Row label={cl.csrColumnAlgorithm}>{csr.key_algorithm} {csr.key_bits}</Row>
            <Row label={cl.csrColumnStatus}>
              <Badge variant={csr.status === 'signed' ? 'default' : 'secondary'}>
                {csr.status === 'signed' ? cl.csrStatusSigned : cl.csrStatusPending}
              </Badge>
            </Row>
            {Object.entries(subject).filter(([, v]) => v).length > 0 && (
              <Row label={cl.csrDetailSubject}>
                <div className="space-y-0.5">
                  {Object.entries(subject).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="text-xs">
                      <span className="text-muted-foreground">{subjectLabels[k] ?? k}:</span> {v}
                    </div>
                  ))}
                </div>
              </Row>
            )}
            <Row label={cl.detailCreatedBy}>{csr.created_by || '—'}</Row>
            <Row label={cl.detailCreatedAt}>{formatDate(csr.created_at)}</Row>
            {csr.certificate_id && (
              <Row label={cl.csrDetailLinkedCert}>
                <Badge variant="outline">#{csr.certificate_id}</Badge>
              </Row>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              {cl.csrDetailKeyStored}
            </div>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              {cl.csrDetailDownload}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
