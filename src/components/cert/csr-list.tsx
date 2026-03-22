'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  ConfirmModal, toast,
} from '@hysp/ui-kit'
import {
  Plus, Eye, Download, Trash2,
  Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { csrCrudApi, type CSRDTO, type CSRListParams } from '@/lib/cert-api'
import { CSRGenerateDialog } from './csr-generate-dialog'
import { CSRDetailDialog } from './csr-detail-dialog'

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

const STATUS_OPTIONS = ['', 'pending', 'signed'] as const

export function CSRList() {
  const { t } = useLocale()
  const cl = t.hycert.certList

  const [csrs, setCSRs] = useState<CSRDTO[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const [generateOpen, setGenerateOpen] = useState(false)
  const [detailCSR, setDetailCSR] = useState<CSRDTO | null>(null)
  const [deleteCSR, setDeleteCSR] = useState<CSRDTO | null>(null)

  const pageSize = 15

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: CSRListParams = { page, page_size: pageSize }
      if (status) params.status = status
      const resp = await csrCrudApi.list(params)
      const data = resp.data!
      setCSRs(data.items ?? [])
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { fetchList() }, [fetchList])

  const handleDelete = async () => {
    if (!deleteCSR) return
    try {
      await csrCrudApi.delete(deleteCSR.id)
      toast.success(cl.csrDeleteSuccess)
      setDeleteCSR(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDownload = async (csr: CSRDTO) => {
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
    }
  }

  const statusLabel = (s: string) => s === 'signed' ? cl.csrStatusSigned : cl.csrStatusPending
  const filterLabel = (s: string) => {
    if (s === '') return cl.csrFilterAll
    if (s === 'pending') return cl.csrFilterPending
    return cl.csrFilterSigned
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{cl.csrTitle}</h2>
        <Button size="sm" onClick={() => setGenerateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {cl.csrGenerate}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {STATUS_OPTIONS.map(s => (
            <Button
              key={s || 'all'}
              variant={status === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatus(s); setPage(1) }}
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
          {loading && csrs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : csrs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">{cl.csrEmpty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{cl.csrColumnCN}</TableHead>
                  <TableHead>SANs</TableHead>
                  <TableHead>{cl.csrColumnAlgorithm}</TableHead>
                  <TableHead>{cl.csrColumnStatus}</TableHead>
                  <TableHead>{cl.csrColumnCreatedAt}</TableHead>
                  <TableHead className="text-right">{cl.csrColumnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csrs.map(csr => {
                  const sans = parseSANs(csr.sans)
                  return (
                    <TableRow key={csr.id}>
                      <TableCell className="font-medium">{csr.common_name}</TableCell>
                      <TableCell className="text-sm">
                        {sans.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {sans.slice(0, 3).map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                            {sans.length > 3 && (
                              <Badge variant="outline" className="text-xs">+{sans.length - 3}</Badge>
                            )}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{csr.key_algorithm} {csr.key_bits}</TableCell>
                      <TableCell>
                        <Badge variant={csr.status === 'signed' ? 'default' : 'secondary'}>
                          {statusLabel(csr.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(csr.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailCSR(csr)} title={cl.csrActionView}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(csr)} title={cl.csrActionDownload}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteCSR(csr)} title={cl.csrActionDelete}>
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

      {/* Dialogs */}
      <CSRGenerateDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSuccess={fetchList}
      />
      <CSRDetailDialog
        csr={detailCSR}
        onClose={() => setDetailCSR(null)}
      />
      <ConfirmModal
        open={!!deleteCSR}
        title={cl.csrDeleteTitle}
        message={cl.csrDeleteMessage}
        confirmLabel={cl.csrDeleteConfirm}
        cancelLabel={cl.cancel}
        onConfirm={handleDelete}
        onCancel={() => setDeleteCSR(null)}
        variant="destructive"
      />
    </div>
  )
}
