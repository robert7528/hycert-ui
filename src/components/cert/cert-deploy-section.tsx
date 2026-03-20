'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Input, Label, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  ConfirmModal, toast,
} from '@hysp/ui-kit'
import { Plus, Pencil, Trash2, Loader2, Server } from 'lucide-react'
import {
  deployCrudApi,
  type DeploymentDTO,
  type CreateDeploymentRequest,
  type UpdateDeploymentRequest,
} from '@/lib/cert-api'

interface Props {
  certificateId: number
  certificateName?: string
}

const SERVICE_OPTIONS = ['nginx', 'apache', 'tomcat', 'k8s', 'haproxy', 'iis', 'other'] as const

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sv-SE')
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

  // Form fields
  const [host, setHost] = useState('')
  const [service, setService] = useState('nginx')
  const [detail, setDetail] = useState('')
  const [port, setPort] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('active')

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

  const resetForm = () => {
    setHost('')
    setService('nginx')
    setDetail('')
    setPort('')
    setNotes('')
    setStatus('active')
    setEditTarget(null)
    setFormOpen(false)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (d: DeploymentDTO) => {
    setEditTarget(d)
    setHost(d.target_host)
    setService(d.target_service)
    setDetail(d.target_detail)
    setPort(d.port ? String(d.port) : '')
    setNotes(d.notes)
    setStatus(d.status)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!host.trim() || !service) return
    setSaving(true)
    try {
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
        const req: CreateDeploymentRequest = {
          certificate_id: certificateId,
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
              <Select value={service} onValueChange={setService}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{cl.deployDetail}</Label>
              <Input
                value={detail}
                onChange={e => setDetail(e.target.value)}
                placeholder={cl.deployDetailPlaceholder}
              />
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
            <div key={d.id} className="flex items-start gap-3 text-sm border rounded-lg p-3">
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
                </div>
                {d.target_detail && (
                  <div className="text-xs text-muted-foreground">{d.target_detail}</div>
                )}
                <div className="text-xs text-muted-foreground">
                  {cl.deployDeployedBy}: {d.deployed_by || '—'} · {formatDate(d.deployed_at)}
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
