'use client'

import { useState, useEffect } from 'react'
import { CertToolbox } from './toolbox'
import { CertList } from './cert-list'
import { DeployList } from './deploy-list'
import { CSRList } from './csr-list'
import { AgentList } from './agent-list'
import { TokenList } from './token-list'
import { AcmeAccountList } from './acme-account-list'
import { AcmeOrderList } from './acme-order-list'
import { HealthDashboard } from './health-dashboard'

export function CertRouter() {
  const [pathname, setPathname] = useState('')

  useEffect(() => {
    setPathname(window.location.pathname)

    // Listen for popstate (back/forward navigation)
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (pathname.includes('/list')) {
    return <CertList />
  }

  if (pathname.includes('/csrs')) {
    return <CSRList />
  }

  if (pathname.includes('/deployments')) {
    return <DeployList />
  }

  if (pathname.includes('/agents')) {
    return <AgentList />
  }

  if (pathname.includes('/tokens')) {
    return <TokenList />
  }

  if (pathname.includes('/acme/orders')) {
    return <AcmeOrderList />
  }

  if (pathname.includes('/acme/accounts')) {
    return <AcmeAccountList />
  }

  if (pathname.includes('/health')) {
    return <HealthDashboard />
  }

  // Default: show health dashboard
  return <HealthDashboard />
}
