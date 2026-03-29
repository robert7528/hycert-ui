'use client'

import { useState, useEffect } from 'react'
import { useLocale } from '@/contexts/locale-context'
import { Card, CardContent, Badge, toast } from '@hysp/ui-kit'
import {
  Loader2, CheckCircle2, AlertTriangle, ShieldAlert, Clock,
  Server, Key, Globe, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  dashboardApi,
  type HealthSummary, type CertWarning, type DeployWarning,
  type AgentWarning, type TokenWarning, type AcmeOrderWarning,
} from '@/lib/cert-api'

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
}

function parseDomains(raw: string): string {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.join(', ') : raw
  } catch {
    return raw
  }
}

interface CategoryCardProps {
  label: string
  count: number
  color: 'red' | 'amber' | 'gray'
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children?: React.ReactNode
}

function CategoryCard({ label, count, color, icon, expanded, onToggle, children }: CategoryCardProps) {
  const colorMap = {
    red: { bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-600' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-600' },
    gray: { bg: 'bg-muted/30', border: 'border-muted', text: 'text-muted-foreground', badge: 'bg-muted-foreground' },
  }
  const c = count > 0 ? colorMap[color] : colorMap.gray

  return (
    <Card className={`${count > 0 ? c.bg : ''} ${count > 0 ? c.border : ''} transition-colors`}>
      <CardContent className="p-3">
        <button
          className="w-full flex items-center justify-between text-left"
          onClick={onToggle}
          disabled={count === 0}
        >
          <div className="flex items-center gap-2">
            <span className={count > 0 ? c.text : 'text-muted-foreground'}>{icon}</span>
            <span className={`text-sm font-medium ${count > 0 ? c.text : 'text-muted-foreground'}`}>{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {count > 0 ? (
              <>
                <Badge className={`${c.badge} text-white text-xs`}>{count}</Badge>
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </>
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
          </div>
        </button>
        {expanded && count > 0 && (
          <div className="mt-3 border-t pt-3">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function HealthDashboard() {
  const { t } = useLocale()
  const cl = t.hycert.healthDashboard

  const [data, setData] = useState<HealthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    dashboardApi.health().then(resp => {
      setData(resp.data ?? null)
    }).catch(err => {
      toast.error(err.message)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">{cl.loading}</span>
      </div>
    )
  }

  if (!data) return null

  const totalIssues = Object.values(data.counts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{cl.title}</h2>
        {totalIssues === 0 && (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {cl.noIssues}
          </Badge>
        )}
      </div>

      <div className="grid gap-3">
        {/* Certificates Expiring Soon */}
        <CategoryCard
          label={cl.certsExpiringSoon}
          count={data.counts.certs_expiring_soon}
          color="amber"
          icon={<Clock className="h-4 w-4" />}
          expanded={!!expanded.expiring}
          onToggle={() => toggle('expiring')}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1">CN</th>
                <th className="text-left py-1">{cl.daysRemaining}</th>
                <th className="text-left py-1">Source</th>
              </tr>
            </thead>
            <tbody>
              {data.certs_expiring_soon?.map((c: CertWarning) => (
                <tr key={c.id} className="border-t">
                  <td className="py-1.5 font-medium">{c.common_name}</td>
                  <td className="py-1.5">
                    <Badge variant={c.days_remaining <= 7 ? 'destructive' : 'outline'} className="text-xs">
                      {c.days_remaining}
                    </Badge>
                  </td>
                  <td className="py-1.5 text-muted-foreground">{c.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CategoryCard>

        {/* Expired but Active */}
        <CategoryCard
          label={cl.certsExpiredActive}
          count={data.counts.certs_expired_active}
          color="red"
          icon={<ShieldAlert className="h-4 w-4" />}
          expanded={!!expanded.expired}
          onToggle={() => toggle('expired')}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1">CN</th>
                <th className="text-left py-1">Not After</th>
              </tr>
            </thead>
            <tbody>
              {data.certs_expired_active?.map((c: CertWarning) => (
                <tr key={c.id} className="border-t">
                  <td className="py-1.5 font-medium">{c.common_name}</td>
                  <td className="py-1.5 text-destructive">{formatDateTime(c.not_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CategoryCard>

        {/* Deployments Failed */}
        <CategoryCard
          label={cl.deploymentsFailed}
          count={data.counts.deployments_failed}
          color="red"
          icon={<AlertTriangle className="h-4 w-4" />}
          expanded={!!expanded.deployFailed}
          onToggle={() => toggle('deployFailed')}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1">Host</th>
                <th className="text-left py-1">Service</th>
                <th className="text-left py-1">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.deployments_failed?.map((d: DeployWarning) => (
                <tr key={d.id} className="border-t">
                  <td className="py-1.5 font-medium">{d.target_host}</td>
                  <td className="py-1.5">{d.target_service}</td>
                  <td className="py-1.5 text-muted-foreground">{formatDateTime(d.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CategoryCard>

        {/* Deployments Pending Long */}
        <CategoryCard
          label={cl.deploymentsPendingLong}
          count={data.counts.deployments_pending_long}
          color="amber"
          icon={<Clock className="h-4 w-4" />}
          expanded={!!expanded.deployPending}
          onToggle={() => toggle('deployPending')}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1">Host</th>
                <th className="text-left py-1">Service</th>
                <th className="text-left py-1">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.deployments_pending_long?.map((d: DeployWarning) => (
                <tr key={d.id} className="border-t">
                  <td className="py-1.5 font-medium">{d.target_host}</td>
                  <td className="py-1.5">{d.target_service}</td>
                  <td className="py-1.5 text-muted-foreground">{formatDateTime(d.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CategoryCard>

        {/* Agents Offline */}
        <CategoryCard
          label={cl.agentsOffline}
          count={data.counts.agents_offline}
          color="amber"
          icon={<Server className="h-4 w-4" />}
          expanded={!!expanded.agents}
          onToggle={() => toggle('agents')}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1">Name</th>
                <th className="text-left py-1">Hostname</th>
                <th className="text-left py-1">Status</th>
                <th className="text-left py-1">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {data.agents_offline?.map((a: AgentWarning) => (
                <tr key={a.id} className="border-t">
                  <td className="py-1.5 font-medium">{a.name}</td>
                  <td className="py-1.5">{a.hostname}</td>
                  <td className="py-1.5">
                    <Badge variant={a.status === 'disabled' ? 'destructive' : 'secondary'} className="text-xs">{a.status}</Badge>
                  </td>
                  <td className="py-1.5 text-muted-foreground">{formatDateTime(a.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CategoryCard>

        {/* Tokens Expired */}
        <CategoryCard
          label={cl.tokensExpired}
          count={data.counts.tokens_expired}
          color="gray"
          icon={<Key className="h-4 w-4" />}
          expanded={!!expanded.tokens}
          onToggle={() => toggle('tokens')}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1">Name</th>
                <th className="text-left py-1">Label</th>
                <th className="text-left py-1">Status</th>
                <th className="text-left py-1">Expires</th>
              </tr>
            </thead>
            <tbody>
              {data.tokens_expired?.map((tk: TokenWarning) => (
                <tr key={tk.id} className="border-t">
                  <td className="py-1.5 font-medium">{tk.name}</td>
                  <td className="py-1.5">{tk.label || '—'}</td>
                  <td className="py-1.5">
                    <Badge variant="destructive" className="text-xs">{tk.status}</Badge>
                  </td>
                  <td className="py-1.5 text-muted-foreground">{formatDateTime(tk.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CategoryCard>

        {/* ACME Orders Failed */}
        <CategoryCard
          label={cl.acmeOrdersFailed}
          count={data.counts.acme_orders_failed}
          color="red"
          icon={<Globe className="h-4 w-4" />}
          expanded={!!expanded.acme}
          onToggle={() => toggle('acme')}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1">Domains</th>
                <th className="text-left py-1">{cl.errorMessage}</th>
              </tr>
            </thead>
            <tbody>
              {data.acme_orders_failed?.map((o: AcmeOrderWarning) => (
                <tr key={o.id} className="border-t">
                  <td className="py-1.5 font-medium">{parseDomains(o.domains)}</td>
                  <td className="py-1.5 text-destructive text-xs">{o.error_message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CategoryCard>
      </div>
    </div>
  )
}
