'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Card, CardContent, Input, Label, Textarea,
  ConfirmModal, toast,
} from '@hysp/ui-kit'
import { NativeSelect } from '@/components/ui/native-select'
import { SearchSelect } from '@/components/ui/search-select'
import {
  Search, Pencil, Trash2, Plus, Loader2, Server,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, RotateCw, AlertTriangle,
} from 'lucide-react'
import {
  deployCrudApi, certCrudApi, agentRegistrationApi, agentTokenApi,
  type DeploymentDTO, type CertificateDTO, type DeploymentListParams,
  type CreateDeploymentRequest, type UpdateDeploymentRequest,
  type DeploymentHistoryItem, type AgentRegistrationDTO,
  type AgentTokenDTO,
} from '@/lib/cert-api'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sv-SE')
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
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
  if (!d.os && !d.cert_path && !d.key_path && !d.reload_cmd && !d.secret_name) {
    return raw ? <div className="text-xs text-muted-foreground">{raw}</div> : null
  }
  return (
    <div className="text-xs text-muted-foreground space-y-0.5">
      {d.os && <span className="mr-2">{d.os === 'windows' ? 'Windows' : 'Linux'}</span>}
      {d.secret_name && <div>{cl.deploySecretName}: {d.secret_name} ({d.namespace || 'default'})</div>}
      {d.kubeconfig && <div>{cl.deployKubeconfig}: {d.kubeconfig}</div>}
      {d.cert_path && <div>{cl.deployCertPath}: {d.cert_path}</div>}
      {d.key_path && <div>{cl.deployKeyPath}: {d.key_path}</div>}
      {d.reload_cmd && <div>{cl.deployReloadCmd}: <code>{d.reload_cmd}</code></div>}
    </div>
  )
}

function DeployStatusBadge({ status, cl }: { status: string; cl: any }) {
  switch (status) {
    case 'deployed':
      return <Badge variant="default" className="text-xs bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />{cl.deployAgentDeployed}</Badge>
    case 'failed':
      return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />{cl.deployAgentFailed}</Badge>
    case 'deploying':
      return <Badge variant="secondary" className="text-xs"><RotateCw className="h-3 w-3 mr-1 animate-spin" />{cl.deployAgentDeploying}</Badge>
    default:
      return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />{cl.deployAgentPending}</Badge>
  }
}

function HistoryPanel({ deploymentId, cl }: { deploymentId: number; cl: any }) {
  const [items, setItems] = useState<DeploymentHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    deployCrudApi.history(deploymentId, { page_size: 10 })
      .then(resp => setItems(resp.data?.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [deploymentId])

  if (loading) {
    return <div className="py-2 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
  }

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">{cl.deployHistoryEmpty}</p>
  }

  return (
    <div className="mt-2 border rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-2 py-1.5 font-medium">{cl.deployHistoryTime}</th>
            <th className="text-left px-2 py-1.5 font-medium">{cl.deployHistoryAction}</th>
            <th className="text-left px-2 py-1.5 font-medium">{cl.deployHistoryStatus}</th>
            <th className="text-left px-2 py-1.5 font-medium">{cl.deployHistoryFingerprint}</th>
            <th className="text-left px-2 py-1.5 font-medium">{cl.deployHistoryDuration}</th>
            <th className="text-left px-2 py-1.5 font-medium">{cl.deployHistoryError}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(h => (
            <tr key={h.id} className="border-t">
              <td className="px-2 py-1.5 whitespace-nowrap">{formatDateTime(h.deployed_at)}</td>
              <td className="px-2 py-1.5">{h.action}</td>
              <td className="px-2 py-1.5">
                {h.status === 'success'
                  ? <span className="text-green-600 font-medium">{cl.deployHistorySuccess}</span>
                  : <span className="text-destructive font-medium">{cl.deployHistoryFailed}</span>
                }
              </td>
              <td className="px-2 py-1.5 font-mono">{h.fingerprint ? h.fingerprint.slice(0, 19) + '…' : '—'}</td>
              <td className="px-2 py-1.5">{h.duration_ms != null ? `${h.duration_ms}ms` : '—'}</td>
              <td className="px-2 py-1.5 text-destructive max-w-[200px] truncate">{h.error_message || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SERVICE_OPTIONS = ['nginx', 'apache', 'haproxy', 'hyproxy', 'tomcat', 'kubernetes', 'iis', 'other'] as const
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
  const [agents, setAgents] = useState<AgentRegistrationDTO[]>([])
  const [tokens, setTokens] = useState<AgentTokenDTO[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [deployStatusFilter, setDeployStatusFilter] = useState('')

  // Edit/Create
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DeploymentDTO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeploymentDTO | null>(null)
  const [saving, setSaving] = useState(false)

  // History expand
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Form fields
  const [formCertId, setFormCertId] = useState('')
  const [formAgentId, setFormAgentId] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [host, setHost] = useState('')
  const [service, setService] = useState('nginx')
  const [port, setPort] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('active')
  const [detailOs, setDetailOs] = useState('linux')
  const [detailCertPath, setDetailCertPath] = useState('')
  const [detailKeyPath, setDetailKeyPath] = useState('')
  const [detailPassword, setDetailPassword] = useState('')
  const [detailAlias, setDetailAlias] = useState('')
  const [detailReloadCmd, setDetailReloadCmd] = useState('')
  // K8S fields
  const [detailSecretName, setDetailSecretName] = useState('')
  const [detailNamespace, setDetailNamespace] = useState('default')
  const [detailKubeconfig, setDetailKubeconfig] = useState('')

  const certNameMap = new Map(certs.map(c => [c.id, c.name || c.common_name]))
  const tokenMap = new Map(tokens.map(tk => [tk.id, tk]))

  // Check deployment warnings
  const getWarnings = (d: DeploymentDTO): string[] => {
    const warnings: string[] = []

    // No agent assigned
    if (!d.agent_id) {
      warnings.push(cl.warnNoAgent)
      return warnings
    }

    // Agent checks
    const agent = agents.find(a => a.agent_id === d.agent_id)
    if (!agent) {
      warnings.push(cl.warnAgentNotFound)
      return warnings
    }

    // Agent disabled
    if (agent.status === 'disabled') {
      warnings.push(cl.warnAgentDisabled)
    }

    // Agent offline
    const threshold = (agent.poll_interval || 3600) * 2 * 1000
    if (!agent.last_seen_at || new Date(agent.last_seen_at).getTime() < Date.now() - threshold) {
      warnings.push(cl.warnAgentOffline)
    }

    // Token label mismatch
    const token = tokenMap.get(agent.agent_token_id)
    if (token) {
      if (token.status === 'revoked') {
        warnings.push(cl.warnTokenRevoked)
      } else if (d.label && token.label && d.label !== token.label) {
        warnings.push(cl.warnLabelMismatch.replace('{deployLabel}', d.label).replace('{tokenLabel}', token.label))
      }
    }

    return warnings
  }
  const pageSize = DEFAULT_PAGE_SIZE

  // Load certs and agents for dropdowns
  useEffect(() => {
    certCrudApi.list({ page_size: 100 }).then(resp => {
      setCerts(resp.data?.items ?? [])
    }).catch(() => {})
    agentRegistrationApi.list({ page_size: 100 }).then(resp => {
      setAgents(resp.data?.items ?? [])
    }).catch(() => {})
    agentTokenApi.labels().then(resp => {
      setLabels(resp.data ?? [])
    }).catch(() => {})
    agentTokenApi.list({ page_size: 100 }).then(resp => {
      setTokens(resp.data?.items ?? [])
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
      if (search) params.search = search
      if (deployStatusFilter) params.deploy_status = deployStatusFilter
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
  }, [page, search, deployStatusFilter])

  useEffect(() => { fetchList() }, [fetchList])

  const resetForm = () => {
    setFormCertId('')
    setFormAgentId('')
    setFormLabel('')
    setHost('')
    setService('nginx')
    setPort('')
    setNotes('')
    setStatus('active')
    setDetailOs('linux')
    setDetailCertPath('')
    setDetailKeyPath('')
    setDetailPassword('')
    setDetailAlias('')
    setDetailReloadCmd('')
    setDetailSecretName('')
    setDetailNamespace('default')
    setDetailKubeconfig('')
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
    setFormAgentId(d.agent_id || '')
    setFormLabel(d.label || '')
    setHost(d.target_host)
    setService(d.target_service)
    setPort(d.port ? String(d.port) : '')
    setNotes(d.notes)
    setStatus(d.status)
    const detail = parseDetail(d.target_detail)
    setDetailOs(detail.os || 'linux')
    setDetailCertPath(detail.cert_path || '')
    setDetailKeyPath(detail.key_path || '')
    setDetailPassword(detail.password || '')
    setDetailAlias(detail.alias || '')
    setDetailReloadCmd(detail.reload_cmd || '')
    setDetailSecretName(detail.secret_name || '')
    setDetailNamespace(detail.namespace || 'default')
    setDetailKubeconfig(detail.kubeconfig || '')
    setFormOpen(true)
  }

  const buildDetail = (): string => {
    if (service === 'kubernetes') {
      return formatDetail({
        secret_name: detailSecretName || undefined,
        namespace: detailNamespace || undefined,
        kubeconfig: detailKubeconfig || undefined,
        reload_cmd: detailReloadCmd || undefined,
      })
    }
    return formatDetail({
      os: detailOs,
      cert_path: detailCertPath || undefined,
      key_path: detailKeyPath || undefined,
      password: detailPassword || undefined,
      alias: detailAlias || undefined,
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
          agent_id: formAgentId || undefined,
          label: formLabel || undefined,
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
          agent_id: formAgentId || undefined,
          label: formLabel || undefined,
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
        <div className="flex gap-1">
          {(['', 'deployed', 'pending', 'failed'] as const).map(s => (
            <Button
              key={s || 'all'}
              variant={deployStatusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setDeployStatusFilter(s); setPage(1) }}
            >
              {s === '' ? cl.deployFilterAll : s === 'deployed' ? cl.deployAgentDeployed : s === 'pending' ? cl.deployAgentPending : cl.deployAgentFailed}
            </Button>
          ))}
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
                <SearchSelect
                  value={formCertId}
                  onChange={setFormCertId}
                  options={certs.map(c => ({ value: String(c.id), label: c.name || c.common_name, description: c.common_name }))}
                  placeholder={cl.deployCert}
                  emptyLabel="—"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployAgent}</Label>
              <SearchSelect
                value={formAgentId}
                onChange={(v) => {
                  setFormAgentId(v)
                  const ag = agents.find(a => a.agent_id === v)
                  if (ag && !host) setHost(ag.hostname || ag.name)
                }}
                options={agents.map(a => ({
                  value: a.agent_id,
                  label: `${a.name || a.hostname} (${a.os})`,
                  description: `${a.hostname} · ${a.last_seen_at && new Date(a.last_seen_at) > new Date(Date.now() - (a.poll_interval || 3600) * 2000) ? cl.deployAgentOnline : cl.deployAgentOffline}`,
                }))}
                placeholder={cl.deployAgentSelect}
                emptyLabel={cl.deployAgentNone}
              />
            </div>
            <div>
              <Label className="text-xs">{cl.deployLabel}</Label>
              <NativeSelect value={formLabel} onChange={v => setFormLabel(v)}>
                <option value="">{cl.deployLabelNone}</option>
                {labels.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployHost}</Label>
                <Input value={host} onChange={e => setHost(e.target.value)} placeholder={cl.deployHostPlaceholder} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployService}</Label>
                <NativeSelect value={service} onChange={setService}>
                  {SERVICE_OPTIONS.map(s => (<option key={s} value={s}>{s}</option>))}
                </NativeSelect>
              </div>
              {service !== 'kubernetes' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">{cl.deployPort}</Label>
                    <Input type="number" value={port} onChange={e => setPort(e.target.value)} placeholder="443" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{cl.deployOs}</Label>
                    <NativeSelect value={detailOs} onChange={setDetailOs}>
                      {OS_OPTIONS.map(o => (<option key={o} value={o}>{o === 'windows' ? 'Windows' : 'Linux'}</option>))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{cl.deployCertPath}</Label>
                    <Input value={detailCertPath} onChange={e => setDetailCertPath(e.target.value)} placeholder={detailOs === 'windows' ? 'C:\\nginx\\ssl\\cert.pem' : '/etc/nginx/ssl/cert.pem'} />
                  </div>
                  {service !== 'tomcat' && service !== 'iis' && service !== 'haproxy' && (
                    <div className="space-y-1">
                      <Label className="text-xs">{cl.deployKeyPath}</Label>
                      <Input value={detailKeyPath} onChange={e => setDetailKeyPath(e.target.value)} placeholder={detailOs === 'windows' ? 'C:\\nginx\\ssl\\key.pem' : '/etc/nginx/ssl/key.pem'} />
                    </div>
                  )}
                </>
              )}
            </div>
            {service === 'kubernetes' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{cl.deploySecretName}</Label>
                  <Input value={detailSecretName} onChange={e => setDetailSecretName(e.target.value)} placeholder="my-tls-secret" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{cl.deployNamespace}</Label>
                  <Input value={detailNamespace} onChange={e => setDetailNamespace(e.target.value)} placeholder="default" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">{cl.deployKubeconfig}</Label>
                  <Input value={detailKubeconfig} onChange={e => setDetailKubeconfig(e.target.value)} placeholder="/root/.kube/config" />
                </div>
              </div>
            )}
            {(service === 'tomcat' || service === 'iis') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{cl.deployKeystorePassword}</Label>
                  <Input type="password" value={detailPassword} onChange={e => setDetailPassword(e.target.value)} placeholder="changeit" />
                </div>
                {service === 'tomcat' && (
                  <div className="space-y-1">
                    <Label className="text-xs">{cl.deployKeystoreAlias}</Label>
                    <Input value={detailAlias} onChange={e => setDetailAlias(e.target.value)} placeholder="tomcat" />
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployReloadCmd}</Label>
              <Input value={detailReloadCmd} onChange={e => setDetailReloadCmd(e.target.value)} placeholder={service === 'kubernetes' ? 'kubectl rollout restart deploy/my-app -n default' : service === 'iis' ? 'iisreset /restart' : service === 'tomcat' ? 'Restart-Service Tomcat8' : 'nginx -s reload'} />
            </div>
            {editTarget && (
              <div className="space-y-1">
                <Label className="text-xs">{cl.deployStatus}</Label>
                <NativeSelect value={status} onChange={setStatus} className="w-[180px]">
                  <option value="active">{cl.deployStatusActive}</option>
                  <option value="disabled">{cl.deployStatusDisabled}</option>
                </NativeSelect>
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
                <div key={d.id} className="border rounded-lg">
                  <div className="flex items-start gap-3 text-sm p-3">
                    <Server className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{d.target_host}</span>
                        <Badge variant="outline" className="text-xs">{d.target_service}</Badge>
                        {d.port && <span className="text-xs text-muted-foreground">:{d.port}</span>}
                        <Badge variant={d.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {d.status === 'active' ? cl.deployStatusActive : cl.deployStatusDisabled}
                        </Badge>
                        <DeployStatusBadge status={d.deploy_status} cl={cl} />
                      </div>
                      <DetailInfo raw={d.target_detail} cl={cl} />
                      <div className="text-xs text-muted-foreground">
                        {cl.deployCert}: {certNameMap.get(d.certificate_id) ?? `#${d.certificate_id}`}
                        {d.last_fingerprint && (
                          <> · {cl.deployFingerprint}: <span className="font-mono">{d.last_fingerprint.slice(0, 19)}…</span></>
                        )}
                        {d.last_deployed_at && (
                          <> · {cl.deployLastDeployedAt}: {formatDateTime(d.last_deployed_at)}</>
                        )}
                      </div>
                      {d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}
                      {(() => {
                        const warnings = getWarnings(d)
                        return warnings.length > 0 ? (
                          <div className="flex items-start gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <div>{warnings.join('；')}</div>
                          </div>
                        ) : null
                      })()}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                        title={cl.deployHistory}
                      >
                        {expandedId === d.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(d)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {expandedId === d.id && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="text-xs font-medium mb-1">{cl.deployHistory}</div>
                      <HistoryPanel deploymentId={d.id} cl={cl} />
                    </div>
                  )}
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
