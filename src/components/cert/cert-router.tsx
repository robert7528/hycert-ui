'use client'

import { useState, useEffect } from 'react'
import { CertToolbox } from './toolbox'
import { CertList } from './cert-list'

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

  // Default: show toolbox
  return <CertToolbox />
}
