'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Card, CardContent, Input, Label, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  ConfirmModal, toast,
} from '@hysp/ui-kit'
import {
  Search, Pencil, Trash2, Plus, Loader2, Server,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  deployCrudApi, certCrudApi,
  type DeploymentDTO, type CertificateDTO, type DeploymentListParams,
  type CreateDeploymentRequest, type UpdateDeploymentRequest,
} from '@/lib/cert-api'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sv-SE')
}

function parseDetail(raw: string): Record<string, string> {
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw)
    return typeof obj === 'object' && obj !== null ? obj : {}
  } catch {
    return raw ? { cert_path: raw } : {}
  }
}

function formatDetail(d: Record<string, string | undefined>): string {
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(d)) {
    if (v) clean[k] = v
  }
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : ''
}

function DetailInfo({ raw, cl }: { raw: string; cl: any }) {
  const d = parseDetail(raw)
  if (!d.os && !d.cert_path && !d.key_path && !d.reload_cmd) {
    return raw ? <div className="text-xs text-muted-foreground">{raw}</div> : null
  }
  return (
    <div className="text-xs text-muted-foreground space-y-0.5">
      {d.os && <span className="mr-2">{d.os === 'windows' ? 'Windows' : 'Linux'}</span>}
      {d.cert_path && <div>{cl.deployCertPath}: {d.cert_path}</div>}
      {d.key_path && <div>{cl.deployKeyPath}: {d.key_path}</div>}
      {d.reload_cmd && <div>{cl.deployReloadCmd}: <code>{d.reload_cmd}</code></div>}
    </div>
  )
}

const SERVICE_OPTIONS = ['nginx', 'apache', 'tomcat', 'k8s', 'haproxy', 'iis', 'other'] as const
const OS_OPTIONS = ['linux', 'windows'] as const

export function DeployList() {
  const { t } = useLocale()
  const cl = t.hycert.certList

  const [deployments, setDeployments] = useState<DeploymentDTO[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // Filters
  const [certs, setCerts] = useState<CertificateDTO[]>([])
  const [certFilter, setCertFilter] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Edit/Create
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DeploymentDTO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeploymentDTO | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [formCertId, setFormCertId] = useState('')
  const [host, setHost] = useState('')
  const [service, setService] = useState('nginx')
  const [port, setPort] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('active')
  const [detailOs, setDetailOs] = useState('linux')
  const [detailCertPath, setDetailCertPath] = useState('')
  const [detailKeyPath, setDetailKeyPath] = useState('')
  const [detailReloadCmd, setDetailReloadCmd] = useState('')

  const certNameMap = new Map(certs.map(c => [c.id, c.name || c.common_name]))
  const pageSize = 20

  // Load certs for dropdown
  useEffect(() => {
    certCrudApi.list({ page_size: 100 }).then(resp => {
      setCerts(resp.data?.items ?? [])
    }).catch(() => {})
  }, [])

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: DeploymentListParams = { page, page_size: pageSize }
      if (certFilter && certFilter !== 'all') params.certificate_id = parseInt(certFilter)
      if (search) params.search = search
      const resp = await deployCrudApi.list(params)
      const data = resp.data!
      setDeployments(data.items ?? [])
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, certFilter, search])

  useEffect(() => { fetchList() }, [fetchList])

  const resetForm = () => {
    setFormCertId('')
    setHost('')
    setService('nginx')
    setPort('')
    setNotes('')
    setStatus('active')
    setDetailOs('linux')
    setDetailCertPath('')
    setDetailKeyPath('')
    setDetailReloadCmd('')
    setEditTarget(null)
    setFormOpen(false)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (d: DeploymentDTO) => {
    setEditTarget(d)
    setFormCertId(String(d.certificate_id))
    setHost(d.target_host)
    setService(d.target_service)
    setPort(d.port ? String(d.port) : '')
    setNotes(d.notes)
    setStatus(d.status)
    const detail = parseDetail(d.target_detail)
    setDetailOs(detail.os || 'linux')
    setDetailCertPath(detail.cert_path || '')
    setDetailKeyPath(detail.key_path || '')
    setDetailReloadCmd(detail.reload_cmd || '')
    setFormOpen(true)
  }

  const buildDetail = (): string => {
    return formatDetail({
      os: detailOs,
      cert_path: detailCertPath || undefined,
      key_path: detailKeyPath || undefined,
      reload_cmd: detailReloadCmd || undefined,
    })
  }

  const handleSubmit = async () => {
    if (!host.trim() || !service) return
    setSaving(true)
    try {
      const detail = buildDetail()
      if (editTarget) {
        const req: UpdateDeploymentRequest = {
          target_host: host,
          target_service: service,
          target_detail: detail || undefined,
          port: port ? parseInt(port) : undefined,
          notes: notes || undefined,
          status,
        }
        await deployCrudApi.update(editTarget.id, req)
      } else {
        if (!formCertId) { toast.error('Please select a certificate'); setSaving(false); return }
        const req: CreateDeploymentRequest = {
          certificate_id: parseInt(formCertId),
          target_host: host,
          target_service: service,
          target_detail: detail || undefined,
          port: port ? parseInt(port) : undefined,
          notes: notes || undefined,
        }
        await deployCrudApi.create(req)
      }
      toast.success(cl.deploySuccess)
      resetForm()
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deployCrudApi.delete(deleteTarget.id)
      toast.success(cl.deployDeleteSuccess)
      setDeleteTarget(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{cl.deployTitle}</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          {cl.deployAdd}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={cl.deploySearchPlaceholder}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-[220px]">
          <Select value={certFilter} onValueChange={v => { setCertFilter(v); setPage(1) }}>
            <SelectTrigger><SelectValue placeholder={cl.deployAllCerts} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{cl.deployAllCerts}</SelectItem>
              {certs.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name || c.common_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {total > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            {cl.totalItems.replace('{count}', String(total))}
          </span>
        )}
      </div>

      {/* Inline Form */}
      {formOpen && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-medium">
              {editTarget ? cl.deployEditTitle : cl.deployCreateTitle}
            </h4>
            {!editTarget && (
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployCert}</Label>
                <Select value={formCertId} onValueChange={setFormCertId}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {certs.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name || c.common_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployHost}</Label>
                <Input value={host} onChange={e => setHost(e.target.value)} placeholder={cl.deployHostPlaceholder} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployService}</Label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployPort}</Label>
                <Input type="number" value={port} onChange={e => setPort(e.target.value)} placeholder="443" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployOs}</Label>
                <Select value={detailOs} onValueChange={setDetailOs}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OS_OPTIONS.map(o => (<SelectItem key={o} value={o}>{o === 'windows' ? 'Windows' : 'Linux'}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployCertPath}</Label>
                <Input value={detailCertPath} onChange={e => setDetailCertPath(e.target.value)} placeholder={detailOs === 'windows' ? 'C:\\nginx\\ssl\\cert.pem' : '/etc/nginx/ssl/cert.pem'} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployKeyPath}</Label>
                <Input value={detailKeyPath} onChange={e => setDetailKeyPath(e.target.value)} placeholder={detailOs === 'windows' ? 'C:\\nginx\\ssl\\key.pem' : '/etc/nginx/ssl/key.pem'} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployReloadCmd}</Label>
              <Input value={detailReloadCmd} onChange={e => setDetailReloadCmd(e.target.value)} placeholder={service === 'iis' ? 'iisreset /restart' : 'nginx -s reload'} />
            </div>
            {editTarget && (
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployStatus}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{cl.deployStatusActive}</SelectItem>
                    <SelectItem value="removed">{cl.deployStatusRemoved}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployNotes}</Label>
              <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>{cl.cancel}</Button>
              <Button size="sm" onClick={handleSubmit} disabled={!host.trim() || saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {cl.deploySubmit}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-4">
          {loading && deployments.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : deployments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">{cl.deployEmpty}</p>
          ) : (
            <div className="space-y-2">
              {deployments.map(d => (
                <div key={d.id} className="flex items-start gap-3 text-sm border rounded-lg p-3">
                  <Server className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{d.target_host}</span>
                      <Badge variant="outline" className="text-xs">{d.target_service}</Badge>
                      {d.port && <span className="text-xs text-muted-foreground">:{d.port}</span>}
                      <Badge variant={d.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {d.status === 'active' ? cl.deployStatusActive : cl.deployStatusRemoved}
                      </Badge>
                    </div>
                    <DetailInfo raw={d.target_detail} cl={cl} />
                    <div className="text-xs text-muted-foreground">
                      {cl.deployCert}: {certNameMap.get(d.certificate_id) ?? `#${d.certificate_id}`}
                      {' · '}{cl.deployDeployedBy}: {d.deployed_by || '—'}
                      {' · '}{formatDate(d.deployed_at)}
                    </div>
                    {d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(d)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {cl.pagination.replace('{page}', String(page)).replace('{total}', String(totalPages))}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={cl.deployDeleteTitle}
        message={cl.deployDeleteMessage}
        confirmLabel={cl.deployDeleteConfirm}
        cancelLabel={cl.cancel}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="destructive"
      />
    </div>
  )
}
