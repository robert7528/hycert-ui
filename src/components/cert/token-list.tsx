'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Card, CardContent, Input, Label,
  ConfirmModal, toast,
} from '@hysp/ui-kit'
import {
  Search, Loader2, ChevronLeft, ChevronRight,
  Plus, Key, Copy, ShieldOff, Pencil, Trash2, Eye, Users,
} from 'lucide-react'
import {
  agentTokenApi, agentRegistrationApi,
  type AgentTokenDTO, type CreateTokenRequest, type UpdateTokenRequest,
  type AgentRegistrationDTO,
} from '@/lib/cert-api'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sv-SE')
}

export function TokenList() {
  const { t } = useLocale()
  const cl = t.hycert.tokenList

  const [tokens, setTokens] = useState<AgentTokenDTO[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createLabel, setCreateLabel] = useState('')
  const [createExpiry, setCreateExpiry] = useState('')
  const [creating, setCreating] = useState(false)

  // Edit dialog
  const [editTarget, setEditTarget] = useState<AgentTokenDTO | null>(null)
  const [editName, setEditName] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editing, setEditing] = useState(false)

  // Token reveal dialog
  const [revealToken, setRevealToken] = useState('')
  const [copied, setCopied] = useState(false)

  // Revoke / Delete confirm
  const [revokeTarget, setRevokeTarget] = useState<AgentTokenDTO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AgentTokenDTO | null>(null)

  // Agent expand
  const [expandedTokenId, setExpandedTokenId] = useState<number | null>(null)
  const [expandedAgents, setExpandedAgents] = useState<AgentRegistrationDTO[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)

  const pageSize = DEFAULT_PAGE_SIZE

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await agentTokenApi.list({ page, page_size: pageSize })
      let items = resp.data?.items ?? []

      if (search) {
        const q = search.toLowerCase()
        items = items.filter(tk =>
          tk.name.toLowerCase().includes(q) ||
          tk.token_prefix.toLowerCase().includes(q) ||
          tk.label.toLowerCase().includes(q) ||
          tk.created_by.toLowerCase().includes(q)
        )
      }

      setTokens(items)
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
    if (!createName.trim()) return
    setCreating(true)
    try {
      const req: CreateTokenRequest = { name: createName.trim() }
      if (createLabel.trim()) req.label = createLabel.trim()
      if (createExpiry) req.expires_at = new Date(createExpiry).toISOString()
      const resp = await agentTokenApi.create(req)
      setRevealToken(resp.data?.token ?? '')
      setShowCreate(false)
      setCreateName('')
      setCreateLabel('')
      setCreateExpiry('')
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setEditing(true)
    try {
      const req: UpdateTokenRequest = {}
      if (editName.trim() !== editTarget.name) req.name = editName.trim()
      if (editLabel !== editTarget.label) req.label = editLabel
      await agentTokenApi.update(editTarget.id, req)
      setEditTarget(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setEditing(false)
    }
  }

  const openEdit = (tk: AgentTokenDTO) => {
    setEditTarget(tk)
    setEditName(tk.name)
    setEditLabel(tk.label)
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    try {
      await agentTokenApi.revoke(revokeTarget.id)
      setRevokeTarget(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await agentTokenApi.remove(deleteTarget.id)
      setDeleteTarget(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleReveal = async (tk: AgentTokenDTO) => {
    try {
      const resp = await agentTokenApi.reveal(tk.id)
      setRevealToken(resp.data?.token ?? '')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleCopy = () => {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = revealToken
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copy this token:', revealToken)
    }
  }

  const toggleAgents = async (tokenId: number) => {
    if (expandedTokenId === tokenId) {
      setExpandedTokenId(null)
      return
    }
    setExpandedTokenId(tokenId)
    setLoadingAgents(true)
    try {
      const resp = await agentRegistrationApi.list({ page_size: 100 })
      const agents = (resp.data?.items ?? []).filter(a => a.agent_token_id === tokenId)
      setExpandedAgents(agents)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoadingAgents(false)
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

      {/* Search */}
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
        {total > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            {cl.totalItems.replace('{count}', String(total))}
          </span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading && tokens.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">{cl.empty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">{cl.columnName}</th>
                  <th className="text-left p-3 font-medium">{cl.columnPrefix}</th>
                  <th className="text-left p-3 font-medium">{cl.columnLabel}</th>
                  <th className="text-left p-3 font-medium">{cl.columnAgents}</th>
                  <th className="text-left p-3 font-medium">{cl.columnStatus}</th>
                  <th className="text-left p-3 font-medium">{cl.columnLastUsed}</th>
                  <th className="text-left p-3 font-medium">{cl.columnExpiry}</th>
                  <th className="text-left p-3 font-medium">{cl.columnActions}</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map(tk => (
                  <>
                    <tr key={tk.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                          {tk.name}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{tk.token_prefix}...</td>
                      <td className="p-3">
                        {tk.label ? (
                          <Badge variant="outline" className="text-xs">{tk.label}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => toggleAgents(tk.id)}
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {tk.agent_count}
                        </Button>
                      </td>
                      <td className="p-3">
                        {tk.status === 'active' ? (
                          <Badge variant="default" className="text-xs bg-green-600">{cl.statusActive}</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">{cl.statusRevoked}</Badge>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDateTime(tk.last_used_at)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDate(tk.expires_at)}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {tk.can_reveal && (
                            <Button variant="outline" size="sm" onClick={() => handleReveal(tk)} title={cl.actionReveal}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                          {tk.status === 'active' && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openEdit(tk)} title={cl.actionEdit}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setRevokeTarget(tk)} title={cl.actionRevoke}>
                                <ShieldOff className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {tk.agent_count === 0 && (
                            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteTarget(tk)} title={cl.actionDelete}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedTokenId === tk.id && (
                      <tr key={`${tk.id}-agents`} className="bg-muted/30">
                        <td colSpan={8} className="p-3">
                          {loadingAgents ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          ) : expandedAgents.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center">{cl.noAgents}</p>
                          ) : (
                            <div className="space-y-1">
                              {expandedAgents.map(a => (
                                <div key={a.id} className="flex items-center gap-3 text-xs">
                                  <span className="font-medium">{a.name || a.hostname}</span>
                                  <span className="text-muted-foreground">{a.hostname}</span>
                                  <Badge variant={a.status === 'active' ? 'outline' : 'destructive'} className="text-xs">
                                    {a.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
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

      {/* Create Token Dialog */}
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
                <Label>{cl.fieldLabel}</Label>
                <Input value={createLabel} onChange={e => setCreateLabel(e.target.value)} placeholder={cl.fieldLabelPlaceholder} />
                <p className="text-xs text-muted-foreground mt-1">{cl.fieldLabelHint}</p>
              </div>
              <div>
                <Label>{cl.fieldExpiry}</Label>
                <Input type="date" value={createExpiry} onChange={e => setCreateExpiry(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">{cl.fieldExpiryHint}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)}>{cl.cancel}</Button>
              <Button onClick={handleCreate} disabled={creating || !createName.trim()}>
                {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {cl.createButton}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Token Dialog */}
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
                <Label>{cl.fieldLabel}</Label>
                <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder={cl.fieldLabelPlaceholder} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditTarget(null)}>{cl.cancel}</Button>
              <Button onClick={handleEdit} disabled={editing || !editName.trim()}>
                {editing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {cl.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Token Reveal Dialog */}
      {revealToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border shadow-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-2">{cl.revealTitle}</h3>
            <p className="text-sm text-muted-foreground mb-4">{cl.revealWarning}</p>
            <div className="flex items-center gap-2 bg-muted rounded p-3">
              <code className="text-xs break-all flex-1">{revealToken}</code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-3 w-3 mr-1" />
                {copied ? cl.copied : cl.copy}
              </Button>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={() => { setRevealToken(''); setCopied(false) }}>{cl.close}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirm */}
      <ConfirmModal
        open={!!revokeTarget}
        title={cl.revokeTitle}
        description={cl.revokeConfirm.replace('{name}', revokeTarget?.name ?? '')}
        confirmLabel={cl.actionRevoke}
        variant="destructive"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />

      {/* Delete Confirm */}
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
