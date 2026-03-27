'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Card, CardContent, Input, Label,
  ConfirmModal, toast,
} from '@hysp/ui-kit'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Search, Loader2, ChevronLeft, ChevronRight,
  Plus, Shield, Pencil, Trash2,
} from 'lucide-react'
import {
  acmeAccountApi,
  type AcmeAccountDTO, type CreateAcmeAccountRequest, type UpdateAcmeAccountRequest,
} from '@/lib/cert-api'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
}

const CA_PRESETS = [
  { label: "Let's Encrypt", url: 'https://acme-v02.api.letsencrypt.org/directory' },
  { label: "Let's Encrypt (Staging)", url: 'https://acme-staging-v02.api.letsencrypt.org/directory' },
  { label: 'ZeroSSL', url: 'https://acme.zerossl.com/v2/DV90' },
  { label: 'Google Trust Services', url: 'https://dv.acme-v02.api.pki.goo.gl/directory' },
  { label: 'Buypass', url: 'https://api.buypass.com/acme/directory' },
]

function caLabel(url: string): string {
  const preset = CA_PRESETS.find(p => p.url === url)
  return preset ? preset.label : url
}

export function AcmeAccountList() {
  const { t } = useLocale()
  const cl = t.hycert.acmeAccount

  const [accounts, setAccounts] = useState<AcmeAccountDTO[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createCa, setCreateCa] = useState(CA_PRESETS[0].url)
  const [createCustomUrl, setCreateCustomUrl] = useState('')
  const [creating, setCreating] = useState(false)

  // Edit dialog
  const [editTarget, setEditTarget] = useState<AcmeAccountDTO | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editing, setEditing] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<AcmeAccountDTO | null>(null)

  const pageSize = DEFAULT_PAGE_SIZE

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await acmeAccountApi.list({ page, page_size: pageSize })
      let items = resp.data?.items ?? []
      if (search) {
        const q = search.toLowerCase()
        items = items.filter(a =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q)
        )
      }
      setAccounts(items)
      setTotal(resp.data?.total ?? 0)
      setTotalPages(resp.data?.total_pages ?? 0)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchList() }, [fetchList])

  const handleCreate = async () => {
    if (!createName.trim() || !createEmail.trim()) return
    setCreating(true)
    try {
      const directoryUrl = createCa === 'custom' ? createCustomUrl : createCa
      if (!directoryUrl) { toast.error('Directory URL is required'); setCreating(false); return }
      const req: CreateAcmeAccountRequest = {
        name: createName.trim(),
        email: createEmail.trim(),
        directory_url: directoryUrl,
      }
      await acmeAccountApi.create(req)
      setShowCreate(false)
      setCreateName('')
      setCreateEmail('')
      setCreateCa(CA_PRESETS[0].url)
      setCreateCustomUrl('')
      fetchList()
      toast.success(cl.createSuccess)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (a: AcmeAccountDTO) => {
    setEditTarget(a)
    setEditName(a.name)
    setEditEmail(a.email)
    setEditStatus(a.status)
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setEditing(true)
    try {
      const req: UpdateAcmeAccountRequest = {}
      if (editName.trim() !== editTarget.name) req.name = editName.trim()
      if (editEmail.trim() !== editTarget.email) req.email = editEmail.trim()
      if (editStatus !== editTarget.status) req.status = editStatus
      await acmeAccountApi.update(editTarget.id, req)
      setEditTarget(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await acmeAccountApi.remove(deleteTarget.id)
      setDeleteTarget(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{cl.title}</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />{cl.createButton}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={cl.searchPlaceholder} value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        {total > 0 && <span className="text-sm text-muted-foreground ml-auto">{cl.totalItems.replace('{count}', String(total))}</span>}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && accounts.length === 0 ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : accounts.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">{cl.empty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">{cl.columnName}</th>
                  <th className="text-left p-3 font-medium">{cl.columnEmail}</th>
                  <th className="text-left p-3 font-medium">{cl.columnCa}</th>
                  <th className="text-left p-3 font-medium">{cl.columnStatus}</th>
                  <th className="text-left p-3 font-medium">{cl.columnCreatedAt}</th>
                  <th className="text-left p-3 font-medium">{cl.columnActions}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                        {a.name}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{a.email}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">{caLabel(a.directory_url)}</Badge>
                    </td>
                    <td className="p-3">
                      {a.status === 'active' ? (
                        <Badge variant="default" className="text-xs bg-green-600">{cl.statusActive}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">{cl.statusInactive}</Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDateTime(a.created_at)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(a)} title={cl.actionEdit}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteTarget(a)} title={cl.actionDelete}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">{cl.pagination.replace('{page}', String(page)).replace('{total}', String(totalPages))}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-background rounded-lg border shadow-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{cl.createTitle}</h3>
            <div className="space-y-4">
              <div>
                <Label>{cl.fieldName}</Label>
                <Input value={createName} onChange={e => setCreateName(e.target.value)} placeholder={cl.fieldNamePlaceholder} />
              </div>
              <div>
                <Label>{cl.fieldEmail}</Label>
                <Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="admin@example.com" />
              </div>
              <div>
                <Label>{cl.fieldCa}</Label>
                <NativeSelect value={createCa} onChange={v => setCreateCa(v)}>
                  {CA_PRESETS.map(p => (<option key={p.url} value={p.url}>{p.label}</option>))}
                  <option value="custom">{cl.fieldCaCustom}</option>
                </NativeSelect>
              </div>
              {createCa === 'custom' && (
                <div>
                  <Label>{cl.fieldDirectoryUrl}</Label>
                  <Input value={createCustomUrl} onChange={e => setCreateCustomUrl(e.target.value)} placeholder="https://acme.example.com/directory" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)}>{cl.cancel}</Button>
              <Button onClick={handleCreate} disabled={creating || !createName.trim() || !createEmail.trim()}>
                {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {cl.createButton}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditTarget(null)}>
          <div className="bg-background rounded-lg border shadow-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{cl.editTitle}</h3>
            <div className="space-y-4">
              <div>
                <Label>{cl.fieldName}</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <Label>{cl.fieldEmail}</Label>
                <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
              </div>
              <div>
                <Label>{cl.fieldStatus}</Label>
                <NativeSelect value={editStatus} onChange={v => setEditStatus(v)}>
                  <option value="active">{cl.statusActive}</option>
                  <option value="inactive">{cl.statusInactive}</option>
                </NativeSelect>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditTarget(null)}>{cl.cancel}</Button>
              <Button onClick={handleEdit} disabled={editing || !editName.trim() || !editEmail.trim()}>
                {editing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {cl.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={cl.deleteTitle}
        description={cl.deleteConfirm.replace('{name}', deleteTarget?.name ?? '')}
        confirmLabel={cl.actionDelete}
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
