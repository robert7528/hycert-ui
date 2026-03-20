'use client'

import { useState, useEffect } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Input, Label, Separator, toast,
} from '@hysp/ui-kit'
import { Download, Loader2, X, ShieldCheck, Shield, ShieldAlert } from 'lucide-react'
import { certCrudApi, certUtilityApi, type CertificateDTO, type ParseResponse } from '@/lib/cert-api'
import { CertDeploySection } from './cert-deploy-section'

interface Props {
  cert: CertificateDTO | null
  onClose: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE')
}

function parseTags(tagsStr: string): string[] {
  try {
    const arr = JSON.parse(tagsStr)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function parseSANs(sansStr: string): string[] {
  try {
    const arr = JSON.parse(sansStr)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'active') return 'default'
  if (status === 'expired') return 'destructive'
  return 'secondary'
}

function roleIcon(role: string) {
  if (role === 'root') return <ShieldCheck className="h-4 w-4 text-green-600" />
  if (role === 'intermediate') return <Shield className="h-4 w-4 text-blue-500" />
  return <ShieldAlert className="h-4 w-4 text-orange-500" />
}

function roleLabel(role: string, t: any) {
  const labels: Record<string, string> = {
    leaf: t.hycert.certList.detailRoleLeaf,
    intermediate: t.hycert.certList.detailRoleIntermediate,
    root: t.hycert.certList.detailRoleRoot,
  }
  return labels[role] ?? role
}

export function CertDetailDialog({ cert, onClose }: Props) {
  const { t } = useLocale()
  const cl = t.hycert.certList

  const [downloading, setDownloading] = useState('')
  const [exportPassword, setExportPassword] = useState('')
  const [includeKeyInPem, setIncludeKeyInPem] = useState(false)
  const [chainInfo, setChainInfo] = useState<ParseResponse | null>(null)
  const [chainLoading, setChainLoading] = useState(false)

  // Load chain info when cert changes
  useEffect(() => {
    if (!cert) {
      setChainInfo(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setChainLoading(true)
      try {
        // Download PEM (contains full chain), then parse it
        const dlResp = await certCrudApi.download(cert.id, 'pem')
        const pem = dlResp.data?.content
        if (pem && !cancelled) {
          const parseResp = await certUtilityApi.parse({ input: pem })
          if (!cancelled) setChainInfo(parseResp.data ?? null)
        }
      } catch {
        // Non-critical — chain info is supplementary
      } finally {
        if (!cancelled) setChainLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [cert?.id])

  if (!cert) return null

  const sans = parseSANs(cert.sans)
  const tags = parseTags(cert.tags)

  const handleDownload = async (format: string) => {
    if ((format === 'pfx' || format === 'jks' || format === 'key') && !cert.has_private_key) {
      toast.error(cl.detailNoKey)
      return
    }
    if ((format === 'pfx' || format === 'jks') && !exportPassword) {
      toast.error(cl.detailPasswordRequired)
      return
    }

    setDownloading(format)
    try {
      const opts: { password?: string; includeKey?: boolean } = {}
      if (format === 'pfx' || format === 'jks') opts.password = exportPassword
      if (format === 'pem' && includeKeyInPem) opts.includeKey = true
      const resp = await certCrudApi.download(cert.id, format, opts)
      const data = resp.data!

      let blob: Blob
      if (data.content) {
        blob = new Blob([data.content], { type: 'application/x-pem-file' })
      } else if (data.content_base64) {
        const bin = atob(data.content_base64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        blob = new Blob([bytes], { type: 'application/octet-stream' })
      } else {
        throw new Error('No content in response')
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename || `${cert.common_name}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDownloading('')
    }
  }

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all">{children}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{cl.detailTitle}</h2>
              <p className="text-sm text-muted-foreground">{cert.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Separator />

          {/* Basic info */}
          <div className="space-y-3">
            <Row label={cl.columnCN}>{cert.common_name}</Row>
            <Row label={cl.columnIssuer}>{cert.issuer_cn}</Row>
            <Row label={cl.detailSANs}>
              {sans.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {sans.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
                </div>
              ) : '—'}
            </Row>
            <Row label={cl.detailSerial}>
              <code className="text-xs">{cert.serial_number}</code>
            </Row>
            <Row label={cl.columnAlgorithm}>{cert.key_algorithm}</Row>
            <Row label={cl.columnStatus}>
              <Badge variant={statusVariant(cert.status)}>
                {cert.status === 'active' ? cl.statusActive : cert.status === 'expired' ? cl.statusExpired : cl.statusRevoked}
              </Badge>
            </Row>
            <Row label={t.hycert.toolbox.result.notBefore}>{formatDate(cert.not_before)}</Row>
            <Row label={t.hycert.toolbox.result.notAfter}>{formatDate(cert.not_after)}</Row>
            <Row label={cl.detailFingerprint}>
              <code className="text-xs">{cert.fingerprint_sha256}</code>
            </Row>
            <Row label={cl.columnKey}>
              {cert.has_private_key ? (
                <Badge variant="default">{cl.hasKey}</Badge>
              ) : (
                <span className="text-muted-foreground">{cl.noKey}</span>
              )}
            </Row>
            <Row label={cl.detailSource}>{cert.source}</Row>
            <Row label={cl.detailCreatedBy}>{cert.created_by || '—'}</Row>
            <Row label={cl.detailCreatedAt}>{formatDate(cert.created_at)}</Row>
            {tags.length > 0 && (
              <Row label={cl.detailTags}>
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag, i) => <Badge key={i} variant="outline">{tag}</Badge>)}
                </div>
              </Row>
            )}
            {cert.notes && <Row label={cl.detailNotes}>{cert.notes}</Row>}
          </div>

          {/* Chain info */}
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{cl.detailChain}</h3>
            {chainLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {cl.loading}
              </div>
            ) : chainInfo && chainInfo.certificates.length > 0 ? (
              <div className="space-y-2">
                {chainInfo.certificates.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm border rounded-lg p-3">
                    <div className="mt-0.5">{roleIcon(c.role)}</div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{c.subject.cn}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{roleLabel(c.role, t)}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.hycert.toolbox.result.issuer}: {c.issuer.cn}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.hycert.toolbox.result.validity}: {formatDate(c.validity.not_before)} — {formatDate(c.validity.not_after)}
                        {c.validity.is_expired && (
                          <Badge variant="destructive" className="ml-2 text-xs">{t.hycert.toolbox.result.expired}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.hycert.toolbox.result.algorithm}: {c.key_info.algorithm} {c.key_info.bits}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{cl.detailChainEmpty}</p>
            )}
          </div>

          {/* Deployment targets */}
          <Separator />
          <CertDeploySection certificateId={cert.id} certificateName={cert.name} />

          {/* Download section */}
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-medium">{cl.detailDownload}</h3>

            {cert.has_private_key && (
              <div className="space-y-3">
                {/* PFX/JKS password */}
                <div className="space-y-2">
                  <Label>{cl.detailPasswordLabel}</Label>
                  <Input
                    type="password"
                    value={exportPassword}
                    onChange={e => setExportPassword(e.target.value)}
                    placeholder="PFX / JKS"
                  />
                </div>
                {/* Include key in PEM (for HAProxy) */}
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeKeyInPem}
                    onChange={e => setIncludeKeyInPem(e.target.checked)}
                    className="rounded"
                  />
                  {cl.detailIncludeKeyInPem}
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!!downloading}
                onClick={() => handleDownload('pem')}
              >
                {downloading === 'pem' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                PEM
              </Button>
              {cert.has_private_key && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!downloading}
                  onClick={() => handleDownload('key')}
                >
                  {downloading === 'key' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                  KEY
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={!!downloading}
                onClick={() => handleDownload('der')}
              >
                {downloading === 'der' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                DER
              </Button>
              {cert.has_private_key && ['pfx', 'jks'].map(fmt => (
                <Button
                  key={fmt}
                  variant="outline"
                  size="sm"
                  disabled={!!downloading}
                  onClick={() => handleDownload(fmt)}
                >
                  {downloading === fmt ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                  {fmt.toUpperCase()}
                </Button>
              ))}
            </div>

            {!cert.has_private_key && (
              <p className="text-xs text-muted-foreground">{cl.detailNoKey}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
