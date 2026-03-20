'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Card, CardContent, Input,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  ConfirmModal, toast,
} from '@hysp/ui-kit'
import {
  Search, Pencil, Trash2, Loader2, Server,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  deployCrudApi, certCrudApi,
  type DeploymentDTO, type CertificateDTO, type DeploymentListParams,
} from '@/lib/cert-api'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sv-SE')
}

export function DeployList() {
  const { t } = useLocale()
  const cl = t.hycert.certList

  const [deployments, setDeployments] = useState<DeploymentDTO[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // Cert filter
  const [certs, setCerts] = useState<CertificateDTO[]>([])
  const [certFilter, setCertFilter] = useState<string>('')
  const [deleteTarget, setDeleteTarget] = useState<DeploymentDTO | null>(null)

  // Cert name lookup
  const certNameMap = new Map(certs.map(c => [c.id, c.name || c.common_name]))

  const pageSize = 20

  // Load all certs for filter dropdown
  useEffect(() => {
    certCrudApi.list({ page_size: 100 }).then(resp => {
      setCerts(resp.data?.items ?? [])
    }).catch(() => {})
  }, [])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: DeploymentListParams = { page, page_size: pageSize }
      if (certFilter) params.certificate_id = parseInt(certFilter)
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
  }, [page, certFilter])

  useEffect(() => { fetchList() }, [fetchList])

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
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-[250px]">
          <Select value={certFilter} onValueChange={v => { setCertFilter(v); setPage(1) }}>
            <SelectTrigger>
              <SelectValue placeholder={cl.deployAllCerts} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{cl.deployAllCerts}</SelectItem>
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
                      {cl.deployCert}: {certNameMap.get(d.certificate_id) ?? `#${d.certificate_id}`}
                      {' · '}{cl.deployDeployedBy}: {d.deployed_by || '—'}
                      {' · '}{formatDate(d.deployed_at)}
                    </div>
                    {d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
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
