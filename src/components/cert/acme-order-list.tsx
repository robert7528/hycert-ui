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
  Plus, Globe, RotateCw, XCircle, Trash2,
} from 'lucide-react'
import {
  acmeOrderApi, acmeAccountApi, acmeDnsProviderApi,
  type AcmeOrderDTO, type AcmeAccountDTO, type CreateAcmeOrderRequest,
  type DNSProviderDef,
} from '@/lib/cert-api'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
}

function parseDomains(raw: string): string[] {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : [raw]
  } catch {
    return raw ? [raw] : []
  }
}

function statusVariant(status: string) {
  switch (status) {
    case 'valid': return 'default'
    case 'processing': return 'secondary'
    case 'pending': return 'outline'
    case 'failed': return 'destructive'
    default: return 'secondary'
  }
}

const CHALLENGE_TYPES = ['dns-01', 'http-01'] as const
const KEY_TYPES = ['ec256', 'ec384', 'rsa2048', 'rsa4096'] as const

export function AcmeOrderList() {
  const { t } = useLocale()
  const cl = t.hycert.acmeOrder

  const [orders, setOrders] = useState<AcmeOrderDTO[]>([])
  const [accounts, setAccounts] = useState<AcmeAccountDTO[]>([])
  const [dnsProviders, setDnsProviders] = useState<DNSProviderDef[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [formAccountId, setFormAccountId] = useState('')
  const [formDomains, setFormDomains] = useState('')
  const [formChallenge, setFormChallenge] = useState<string>('dns-01')
  const [formDnsProvider, setFormDnsProvider] = useState<string>('cloudflare')
  const [formDnsConfig, setFormDnsConfig] = useState<Record<string, string>>({})
  const [formKeyType, setFormKeyType] = useState<string>('ec256')
  const [creating, setCreating] = useState(false)

  // Cancel
  const [cancelTarget, setCancelTarget] = useState<AcmeOrderDTO | null>(null)

  const pageSize = DEFAULT_PAGE_SIZE

  useEffect(() => {
    acmeAccountApi.list({ page_size: 100 }).then(resp => {
      setAccounts((resp.data?.items ?? []).filter(a => a.status === 'active'))
    }).catch(() => {})
    acmeDnsProviderApi.list().then(resp => {
      const providers = resp.data ?? []
      setDnsProviders(providers)
      if (providers.length > 0) setFormDnsProvider(providers[0].name)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await acmeOrderApi.list({
        page,
        page_size: pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      })
      setOrders(resp.data?.items ?? [])
      setTotal(resp.data?.total ?? 0)
      setTotalPages(resp.data?.total_pages ?? 0)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchList() }, [fetchList])

  const accountNameMap = new Map(accounts.map(a => [a.id, a.name]))

  const handleCreate = async () => {
    if (!formAccountId || !formDomains.trim()) return
    setCreating(true)
    try {
      const domains = formDomains.split(/[,\n]/).map(d => d.trim()).filter(Boolean)
      const req: CreateAcmeOrderRequest = {
        account_id: parseInt(formAccountId),
        domains,
        challenge_type: formChallenge,
        key_type: formKeyType,
      }
      if (formChallenge === 'dns-01') {
        req.dns_provider = formDnsProvider
        // Send non-empty credentials as env var key-value map
        const creds = Object.fromEntries(
          Object.entries(formDnsConfig).filter(([, v]) => v)
        )
        if (Object.keys(creds).length > 0) {
          req.dns_config = creds
        }
      }
      await acmeOrderApi.create(req)
      setShowCreate(false)
      setFormAccountId('')
      setFormDomains('')
      setFormDnsConfig({})
      fetchList()
      toast.success(cl.createSuccess)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRenew = async (order: AcmeOrderDTO) => {
    try {
      await acmeOrderApi.renew(order.id)
      toast.success(cl.renewSuccess)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    try {
      await acmeOrderApi.cancel(cancelTarget.id)
      setCancelTarget(null)
      fetchList()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const cancelIsDelete = cancelTarget?.status === 'failed' || cancelTarget?.status === 'cancelled'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{cl.title}</h2>
        <Button size="sm" onClick={() => setShowCreate(true)} disabled={accounts.length === 0}>
          <Plus className="h-4 w-4 mr-1" />{cl.createButton}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={cl.searchPlaceholder} value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['', 'pending', 'processing', 'valid', 'failed', 'cancelled'] as const).map(s => (
            <Button
              key={s || 'all'}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(s); setPage(1) }}
            >
              {s === '' ? cl.filterAll : cl[`status_${s}` as keyof typeof cl]}
            </Button>
          ))}
        </div>
        {total > 0 && <span className="text-sm text-muted-foreground ml-auto">{cl.totalItems.replace('{count}', String(total))}</span>}
      </div>

      {accounts.length === 0 && !loading && (
        <p className="text-sm text-amber-600">{cl.noAccounts}</p>
      )}

      <Card>
        <CardContent className="p-0">
          {loading && orders.length === 0 ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : orders.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">{cl.empty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">{cl.columnDomains}</th>
                  <th className="text-left p-3 font-medium">{cl.columnAccount}</th>
                  <th className="text-left p-3 font-medium">{cl.columnChallenge}</th>
                  <th className="text-left p-3 font-medium">{cl.columnKeyType}</th>
                  <th className="text-left p-3 font-medium">{cl.columnStatus}</th>
                  <th className="text-left p-3 font-medium">{cl.columnAutoRenew}</th>
                  <th className="text-left p-3 font-medium">{cl.columnCreatedAt}</th>
                  <th className="text-left p-3 font-medium">{cl.columnActions}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const domains = parseDomains(o.domains)
                  return (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-start gap-2">
                          <Globe className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div>
                            {domains.map((d, i) => (
                              <div key={i} className="font-medium text-xs">{d}</div>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{accountNameMap.get(o.account_id) ?? `#${o.account_id}`}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">{o.challenge_type}</Badge>
                        {o.dns_provider && <span className="text-xs text-muted-foreground ml-1">({o.dns_provider})</span>}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{o.key_type}</td>
                      <td className="p-3">
                        <Badge variant={statusVariant(o.status)} className={`text-xs ${o.status === 'valid' ? 'bg-green-600' : ''}`}>
                          {cl[`status_${o.status}` as keyof typeof cl] ?? o.status}
                        </Badge>
                        {o.retry_state && (
                          <Badge variant="outline" className="text-xs ml-1">
                            {cl[`retryState_${o.retry_state}` as keyof typeof cl] ?? o.retry_state}
                          </Badge>
                        )}
                        {o.error_message && (
                          <div className="text-xs text-destructive mt-1">{o.error_message}</div>
                        )}
                        {/* When something happened matters as much as what: created_at
                            dates the order, not the outcome, and those can be months
                            apart. A succeeded order reports when it last renewed; anything
                            else reports its last attempt, since that is what dates the
                            error text above. Note last_attempt_at is stamped on success
                            too, so the valid case has to be checked first. */}
                        {o.status === 'valid' && o.last_renewed_at ? (
                          <div className="text-xs text-muted-foreground mt-1">
                            {cl.lastRenewedAt} {formatDateTime(o.last_renewed_at)}
                          </div>
                        ) : o.last_attempt_at ? (
                          <div className="text-xs text-muted-foreground mt-1">
                            {cl.lastAttemptAt} {formatDateTime(o.last_attempt_at)}
                            {o.retry_count > 0 && ` · ${cl.retryCountSuffix.replace('{n}', String(o.retry_count))}`}
                          </div>
                        ) : (
                          /* An order the scanner never touched has no last_attempt_at, which
                             is every failed initial issuance -- and those are the rows most
                             in need of a date. updated_at is when the error was written, so
                             it answers the question for them, but it also moves if anyone
                             edits the order later. Hence the different label: close enough
                             to be useful, labelled honestly enough not to mislead. */
                          <div className="text-xs text-muted-foreground mt-1">
                            {cl.lastUpdatedAt} {formatDateTime(o.updated_at)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-xs">{o.auto_renew ? cl.autoRenewYes : cl.autoRenewNo}</td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDateTime(o.created_at)}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {/* A failed order is offered a retry only when it already has a
                              certificate, i.e. a failed *renewal* -- that is the case the
                              scanner may have parked behind a backoff or given up on, and
                              the only one where "renew" means what it says. A failed initial
                              issuance has nothing to renew: the API would fall through to a
                              fresh issuance and leave an orphaned certificate plus a second
                              auto-renewing order for a domain already covered elsewhere.
                              Those rows get the delete button below instead. Keep in step
                              with acme.Service.RenewOrder. */}
                          {(o.status === 'valid' || (o.status === 'failed' && o.certificate_id !== null)) && (
                            <Button variant="outline" size="sm" onClick={() => handleRenew(o)} title={cl.actionRenew}>
                              <RotateCw className="h-3 w-3" />
                            </Button>
                          )}
                          {(o.status === 'pending' || o.status === 'processing') && (
                            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelTarget(o)} title={cl.actionCancel}>
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
                          {(o.status === 'failed' || o.status === 'cancelled') && (
                            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelTarget(o)} title={cl.actionDelete}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
          <div className="bg-background rounded-lg border shadow-lg p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{cl.createTitle}</h3>
            <div className="space-y-4">
              <div>
                <Label>{cl.fieldAccount}</Label>
                <NativeSelect value={formAccountId} onChange={v => setFormAccountId(v)}>
                  <option value="">{cl.fieldAccountSelect}</option>
                  {accounts.map(a => (<option key={a.id} value={String(a.id)}>{a.name} ({a.email})</option>))}
                </NativeSelect>
              </div>
              <div>
                <Label>{cl.fieldDomains}</Label>
                <Input value={formDomains} onChange={e => setFormDomains(e.target.value)} placeholder={cl.fieldDomainsPlaceholder} />
                <p className="text-xs text-muted-foreground mt-1">{cl.fieldDomainsHint}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{cl.fieldChallenge}</Label>
                  <NativeSelect value={formChallenge} onChange={v => setFormChallenge(v)}>
                    {CHALLENGE_TYPES.map(c => (<option key={c} value={c}>{c}</option>))}
                  </NativeSelect>
                </div>
                <div>
                  <Label>{cl.fieldKeyType}</Label>
                  <NativeSelect value={formKeyType} onChange={v => setFormKeyType(v)}>
                    {KEY_TYPES.map(k => (<option key={k} value={k}>{k.toUpperCase()}</option>))}
                  </NativeSelect>
                </div>
              </div>
              {formChallenge === 'dns-01' && (
                <div className="space-y-3">
                  <div>
                    <Label>{cl.fieldDnsProvider}</Label>
                    <NativeSelect value={formDnsProvider} onChange={v => { setFormDnsProvider(v); setFormDnsConfig({}) }}>
                      {dnsProviders.map(p => (<option key={p.name} value={p.name}>{p.label}</option>))}
                    </NativeSelect>
                  </div>
                  {dnsProviders.find(p => p.name === formDnsProvider)?.fields.map(f => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <Input
                        type={f.secret ? 'password' : 'text'}
                        value={formDnsConfig[f.key] ?? ''}
                        onChange={e => setFormDnsConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.label}
                      />
                    </div>
                  ))}
                  {formDnsProvider === 'manual' && (
                    <p className="text-xs text-amber-600">{cl.fieldDnsManualHint}</p>
                  )}
                </div>
              )}
              {formChallenge === 'http-01' && (
                <p className="text-xs text-amber-600">{cl.fieldHttpHint}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreate(false)}>{cl.cancel}</Button>
              <Button onClick={handleCreate} disabled={creating || !formAccountId || !formDomains.trim()}>
                {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {cl.createButton}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!cancelTarget}
        title={cancelIsDelete ? cl.deleteTitle : cl.cancelTitle}
        description={cancelIsDelete ? cl.deleteConfirm : cl.cancelConfirm}
        confirmLabel={cancelIsDelete ? cl.actionDelete : cl.actionCancel}
        variant="destructive"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}
