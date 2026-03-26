'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Card, CardContent, Input,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  ConfirmModal, toast,
} from '@hysp/ui-kit'
import {
  Plus, Search, Eye, Pencil, Download, Trash2,
  Loader2, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { certCrudApi, deployCrudApi, type CertificateDTO, type CertListParams } from '@/lib/cert-api'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { CertImportDialog } from './cert-import-dialog'
import { CertDetailDialog } from './cert-detail-dialog'
import { CertEditDialog } from './cert-edit-dialog'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE')
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'active') return 'default'
  if (status === 'expired') return 'destructive'
  return 'secondary'
}

const STATUS_OPTIONS = ['', 'active', 'expired', 'revoked'] as const

export function CertList() {
  const { t } = useLocale()
  const cl = t.hycert.certList

  // State
  const [certs, setCerts] = useState<CertificateDTO[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  // Deployment cert IDs (for "no deployment" warning)
  const [deployedCertIds, setDeployedCertIds] = useState<Set<number>>(new Set())

  // Dialogs
  const [importOpen, setImportOpen] = useState(false)
  const [detailCert, setDetailCert] = useState<CertificateDTO | null>(null)
  const [editCert, setEditCert] = useState<CertificateDTO | null>(null)
  const [deleteCert, setDeleteCert] = useState<CertificateDTO | null>(null)

  const pageSize = DEFAULT_PAGE_SIZE

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: CertListParams = {
        page,
        page_size: pageSize,
      }
      if (search) params.search = search
      if (status) params.status = status

      const resp = await certCrudApi.list(params)
      const data = resp.data!
      setCerts(data.items ?? [])
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // Load deployment cert IDs for warnings
  useEffect(() => {
    deployCrudApi.list({ page_size: 500 }).then(resp => {
      const ids = new Set((resp.data?.items ?? []).map(d => d.certificate_id))
      setDeployedCertIds(ids)
    }).catch(() => {})
  }, [])

  // Search debounce
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleStatusFilter = (s: string) => {
    setStatus(s)
    setPage(1)
  }

  const handleDelete = async () => {
    if (!deleteCert) return
    try {
      await certCrudApi.delete(deleteCert.id)
      toast.success(cl.deleteSuccess)
      setDeleteCert(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleQuickDownload = async (cert: CertificateDTO) => {
    try {
      const resp = await certCrudApi.download(cert.id, 'pem')
      const data = resp.data!
      const blob = new Blob([data.content ?? ''], { type: 'application/x-pem-file' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename || `${cert.common_name}.pem`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const statusLabel = (s: string) => {
    if (s === 'active') return cl.statusActive
    if (s === 'expired') return cl.statusExpired
    return cl.statusRevoked
  }

  const filterLabel = (s: string) => {
    if (s === '') return cl.filterAll
    if (s === 'active') return cl.filterActive
    if (s === 'expired') return cl.filterExpired
    return cl.filterRevoked
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{cl.title}</h2>
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {cl.buttonImport}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={cl.searchPlaceholder}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map(s => (
            <Button
              key={s || 'all'}
              variant={status === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusFilter(s)}
            >
              {filterLabel(s)}
            </Button>
          ))}
        </div>
        {total > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            {cl.totalItems.replace('{count}', String(total))}
          </span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading && certs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : certs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">{cl.empty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{cl.columnName}</TableHead>
                  <TableHead>{cl.columnIssuer}</TableHead>
                  <TableHead>{cl.columnExpiry}</TableHead>
                  <TableHead>{cl.columnStatus}</TableHead>
                  <TableHead>{cl.columnAlgorithm}</TableHead>
                  <TableHead className="text-center">{cl.columnKey}</TableHead>
                  <TableHead className="text-right">{cl.columnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certs.map(cert => {
                  const days = daysUntil(cert.not_after)
                  return (
                    <TableRow key={cert.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{cert.name}</span>
                          {cert.name !== cert.common_name && (
                            <span className="block text-xs text-muted-foreground">{cert.common_name}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{cert.issuer_cn}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(cert.not_after)}
                          <span className={`block text-xs ${days <= 30 && days > 0 ? 'text-orange-500' : days <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {days > 0
                              ? cl.daysRemaining.replace('{days}', String(days))
                              : cl.daysExpired.replace('{days}', String(Math.abs(days)))}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant={statusVariant(cert.status)}>
                            {statusLabel(cert.status)}
                          </Badge>
                          {days <= 30 && days > 0 && (
                            <span className="text-amber-600" title={cl.warnExpiringSoon}>
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                          {cert.status === 'active' && !deployedCertIds.has(cert.id) && (
                            <span className="text-muted-foreground" title={cl.warnNoDeployment}>
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{cert.key_algorithm}</TableCell>
                      <TableCell className="text-center text-sm">
                        {cert.has_private_key ? cl.hasKey : <span className="text-muted-foreground">{cl.noKey}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailCert(cert)} title={cl.actionView}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditCert(cert)} title={cl.actionEdit}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleQuickDownload(cert)} title={cl.actionDownload}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteCert(cert)} title={cl.actionDelete}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {cl.pagination.replace('{page}', String(page)).replace('{total}', String(totalPages))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <CertImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={fetchList}
      />
      <CertDetailDialog
        cert={detailCert}
        onClose={() => setDetailCert(null)}
      />
      <CertEditDialog
        cert={editCert}
        onClose={() => setEditCert(null)}
        onSuccess={fetchList}
      />
      <ConfirmModal
        open={!!deleteCert}
        title={cl.deleteTitle}
        message={cl.deleteMessage.replace('{name}', deleteCert?.name ?? '')}
        confirmLabel={cl.deleteConfirm}
        cancelLabel={cl.deleteCancel}
        onConfirm={handleDelete}
        onCancel={() => setDeleteCert(null)}
        variant="destructive"
      />
    </div>
  )
}
