'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Card, CardContent, Input,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  toast,
} from '@hysp/ui-kit'
import {
  Search, Loader2, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Monitor, Ban, Power,
} from 'lucide-react'
import { agentRegistrationApi, type AgentRegistrationDTO } from '@/lib/cert-api'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

function isOnline(agent: AgentRegistrationDTO): boolean {
  if (!agent.last_seen_at) return false
  const threshold = (agent.poll_interval || 3600) * 2 * 1000
  return new Date(agent.last_seen_at).getTime() > Date.now() - threshold
}

function parseIPs(raw: string): string[] {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

const STATUS_FILTERS = ['all', 'online', 'offline'] as const

export function AgentList() {
  const { t } = useLocale()
  const cl = t.hycert.agentList

  const [agents, setAgents] = useState<AgentRegistrationDTO[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const pageSize = DEFAULT_PAGE_SIZE

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await agentRegistrationApi.list({ page, page_size: pageSize })
      let items = resp.data?.items ?? []

      // Client-side filtering (API doesn't support search/status filter yet)
      if (search) {
        const q = search.toLowerCase()
        items = items.filter(a =>
          a.name.toLowerCase().includes(q) ||
          a.hostname.toLowerCase().includes(q) ||
          a.agent_id.toLowerCase().includes(q) ||
          parseIPs(a.ip_addresses).some(ip => ip.includes(q))
        )
      }
      if (statusFilter === 'online') {
        items = items.filter(a => isOnline(a))
      } else if (statusFilter === 'offline') {
        items = items.filter(a => !isOnline(a))
      }

      setAgents(items)
      setTotal(resp.data?.total ?? 0)
      setTotalPages(resp.data?.total_pages ?? 0)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchList() }, [fetchList])

  const handleToggleStatus = async (agent: AgentRegistrationDTO) => {
    const newStatus = agent.status === 'disabled' ? 'active' : 'disabled'
    const msg = newStatus === 'disabled' ? cl.confirmDisable : cl.confirmEnable
    if (!confirm(msg)) return
    try {
      await agentRegistrationApi.updateStatus(agent.id, newStatus)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{cl.title}</h2>
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
          {STATUS_FILTERS.map(f => (
            <Button
              key={f}
              variant={statusFilter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(f); setPage(1) }}
            >
              {f === 'all' ? cl.filterAll : f === 'online' ? cl.filterOnline : cl.filterOffline}
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
          {loading && agents.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">{cl.empty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{cl.columnStatus}</TableHead>
                  <TableHead>{cl.columnName}</TableHead>
                  <TableHead>{cl.columnHostname}</TableHead>
                  <TableHead>{cl.columnIp}</TableHead>
                  <TableHead>{cl.columnOs}</TableHead>
                  <TableHead>{cl.columnVersion}</TableHead>
                  <TableHead>{cl.columnInterval}</TableHead>
                  <TableHead>{cl.columnLastSeen}</TableHead>
                  <TableHead>{cl.columnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map(a => {
                  const online = isOnline(a)
                  const ips = parseIPs(a.ip_addresses)
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        {a.status === 'disabled' ? (
                          <Badge variant="destructive" className="text-xs">
                            <Ban className="h-3 w-3 mr-1" />{cl.statusDisabled}
                          </Badge>
                        ) : online ? (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />{cl.statusOnline}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />{cl.statusOffline}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                          {a.name || a.hostname}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.hostname}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {ips.length > 0 ? ips.join(', ') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{a.os || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{a.version || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatInterval(a.poll_interval || 3600)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(a.last_seen_at)}</TableCell>
                      <TableCell>
                        {a.status === 'disabled' ? (
                          <Button variant="outline" size="sm" onClick={() => handleToggleStatus(a)}>
                            <Power className="h-3 w-3 mr-1" />{cl.actionEnable}
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleToggleStatus(a)}>
                            <Ban className="h-3 w-3 mr-1" />{cl.actionDisable}
                          </Button>
                        )}
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
    </div>
  )
}
