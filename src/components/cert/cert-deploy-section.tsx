'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Input, Label, Textarea,
  ConfirmModal, toast,
} from '@hysp/ui-kit'
import { NativeSelect } from '@/components/ui/native-select'
import { SearchSelect } from '@/components/ui/search-select'
import {
  Plus, Pencil, Trash2, Loader2, Server,
  ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, RotateCw,
} from 'lucide-react'
import {
  deployCrudApi, agentRegistrationApi,
  type DeploymentDTO,
  type CreateDeploymentRequest,
  type UpdateDeploymentRequest,
  type DeploymentHistoryItem,
  type AgentRegistrationDTO,
} from '@/lib/cert-api'

interface Props {
  certificateId: number
  certificateName?: string
}

const SERVICE_OPTIONS = ['nginx', 'apache', 'tomcat', 'k8s', 'haproxy', 'iis', 'other'] as const
const OS_OPTIONS = ['linux', 'windows'] as const

interface DetailJson {
  os?: string
  cert_path?: string
  key_path?: string
  reload_cmd?: string
}

function parseDetail(raw: string): DetailJson {
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw)
    return typeof obj === 'object' && obj !== null ? obj : {}
  } catch {
    // Legacy plain text — treat as cert_path
    return raw ? { cert_path: raw } : {}
  }
}

function formatDetail(d: DetailJson): string {
  const hasContent = d.os || d.cert_path || d.key_path || d.reload_cmd
  return hasContent ? JSON.stringify(d) : ''
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sv-SE')
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
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

export function CertDeploySection({ certificateId, certificateName }: Props) {
  const { t } = useLocale()
  const cl = t.hycert.certList

  const [deployments, setDeployments] = useState<DeploymentDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DeploymentDTO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeploymentDTO | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [agents, setAgents] = useState<AgentRegistrationDTO[]>([])

  // Form fields
  const [formAgentId, setFormAgentId] = useState('')
  const [host, setHost] = useState('')
  const [service, setService] = useState('nginx')
  const [port, setPort] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('active')
  // Structured detail fields
  const [detailOs, setDetailOs] = useState('linux')
  const [detailCertPath, setDetailCertPath] = useState('')
  const [detailKeyPath, setDetailKeyPath] = useState('')
  const [detailReloadCmd, setDetailReloadCmd] = useState('')

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await deployCrudApi.list({ certificate_id: certificateId, page_size: 50 })
      setDeployments(resp.data?.items ?? [])
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [certificateId])

  useEffect(() => { fetchList() }, [fetchList])

  useEffect(() => {
    agentRegistrationApi.list({ page_size: 100 }).then(resp => {
      setAgents(resp.data?.items ?? [])
    }).catch(() => {})
  }, [])

  const resetForm = () => {
    setFormAgentId('')
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
    setFormAgentId(d.agent_id || '')
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
          agent_id: formAgentId || undefined,
        }
        await deployCrudApi.update(editTarget.id, req)
      } else {
        const req: CreateDeploymentRequest = {
          certificate_id: certificateId,
          target_host: host,
          target_service: service,
          target_detail: detail || undefined,
          port: port ? parseInt(port) : undefined,
          notes: notes || undefined,
          agent_id: formAgentId || undefined,
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

  // Render deployment detail info
  const DetailInfo = ({ raw }: { raw: string }) => {
    const d = parseDetail(raw)
    if (!d.os && !d.cert_path && !d.key_path && !d.reload_cmd) {
      // Legacy plain text
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{cl.deployTitle}</h3>
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          {cl.deployAdd}
        </Button>
      </div>

      {/* Form (inline) */}
      {formOpen && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <h4 className="text-sm font-medium">
            {editTarget ? cl.deployEditTitle : cl.deployCreateTitle}
          </h4>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployHost}</Label>
              <Input
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder={cl.deployHostPlaceholder}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployService}</Label>
              <NativeSelect value={service} onChange={setService}>
                {SERVICE_OPTIONS.map(s => (<option key={s} value={s}>{s}</option>))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployPort}</Label>
              <Input
                type="number"
                value={port}
                onChange={e => setPort(e.target.value)}
                placeholder="443"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployOs}</Label>
              <NativeSelect value={detailOs} onChange={setDetailOs}>
                {OS_OPTIONS.map(o => (<option key={o} value={o}>{o === 'windows' ? 'Windows' : 'Linux'}</option>))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployCertPath}</Label>
              <Input
                value={detailCertPath}
                onChange={e => setDetailCertPath(e.target.value)}
                placeholder={detailOs === 'windows' ? 'C:\\nginx\\ssl\\cert.pem' : '/etc/nginx/ssl/cert.pem'}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployKeyPath}</Label>
              <Input
                value={detailKeyPath}
                onChange={e => setDetailKeyPath(e.target.value)}
                placeholder={detailOs === 'windows' ? 'C:\\nginx\\ssl\\key.pem' : '/etc/nginx/ssl/key.pem'}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{cl.deployReloadCmd}</Label>
            <Input
              value={detailReloadCmd}
              onChange={e => setDetailReloadCmd(e.target.value)}
              placeholder={service === 'iis' ? 'iisreset /restart' : 'nginx -s reload'}
            />
          </div>
          {editTarget && (
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployStatus}</Label>
              <NativeSelect value={status} onChange={setStatus} className="w-[180px]">
                <option value="active">{cl.deployStatusActive}</option>
                <option value="removed">{cl.deployStatusRemoved}</option>
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
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : deployments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{cl.deployEmpty}</p>
      ) : (
        <div className="space-y-2">
          {deployments.map(d => (
            <div key={d.id} className="border rounded-lg">
              <div className="flex items-start gap-3 text-sm p-3">
                <Server className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{d.target_host}</span>
                    <Badge variant="outline" className="text-xs">{d.target_service}</Badge>
                    {d.port && <span className="text-xs text-muted-foreground">:{d.port}</span>}
                    <Badge
                      variant={d.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {d.status === 'active' ? cl.deployStatusActive : cl.deployStatusRemoved}
                    </Badge>
                    <DeployStatusBadge status={d.deploy_status} cl={cl} />
                  </div>
                  <DetailInfo raw={d.target_detail} />
                  <div className="text-xs text-muted-foreground">
                    {d.last_fingerprint && (
                      <>{cl.deployFingerprint}: <span className="font-mono">{d.last_fingerprint.slice(0, 19)}…</span> · </>
                    )}
                    {d.last_deployed_at && (
                      <>{cl.deployLastDeployedAt}: {formatDateTime(d.last_deployed_at)} · </>
                    )}
                    {cl.deployDeployedBy}: {d.deployed_by || '—'} · {formatDate(d.deployed_at)}
                  </div>
                  {d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}
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
