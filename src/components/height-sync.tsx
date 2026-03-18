'use client'

import { useEffect } from 'react'

/**
 * Observes document body height and notifies parent app via postMessage.
 * Used in micro-app iframe mode to sync child content height to parent container.
 */
export function HeightSync() {
  useEffect(() => {
    // Only run inside iframe
    if (window === window.parent) return

    const appName = (window as Record<string, unknown>).__MICRO_APP_NAME__ as string | undefined

    let lastHeight = 0

    const notify = () => {
      const height = document.documentElement.scrollHeight
      if (height !== lastHeight) {
        lastHeight = height
        window.parent.postMessage(
          { type: 'HYSP_RESIZE', appName: appName ?? 'unknown', height },
          '*',
        )
      }
    }

    // Initial notify
    notify()

    // Observe body size changes
    const observer = new ResizeObserver(notify)
    observer.observe(document.body)

    // Also observe on DOM mutations (for dynamic content like API results)
    const mutationObserver = new MutationObserver(notify)
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  return null
}
