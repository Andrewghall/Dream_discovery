'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

function getOrCreateCookie(key: string, expireDays: number): string {
  const match = document.cookie.match(new RegExp(`(?:^| )${key}=([^;]+)`))
  if (match) return match[1]
  const id = crypto.randomUUID()
  const expires = new Date(Date.now() + expireDays * 86400000).toUTCString()
  document.cookie = `${key}=${id}; expires=${expires}; path=/; SameSite=Lax`
  return id
}

function getSessionId(): string {
  try {
    const raw = sessionStorage.getItem('_asid')
    if (raw) {
      const { id, ts } = JSON.parse(raw) as { id: string; ts: number }
      if (Date.now() - ts < 30 * 60 * 1000) {
        sessionStorage.setItem('_asid', JSON.stringify({ id, ts: Date.now() }))
        return id
      }
    }
  } catch {}
  const id = crypto.randomUUID()
  try { sessionStorage.setItem('_asid', JSON.stringify({ id, ts: Date.now() })) } catch {}
  return id
}

function getDeviceType(): string {
  const ua = navigator.userAgent
  if (/Mobi|Android/i.test(ua)) return 'mobile'
  if (/Tablet|iPad/i.test(ua)) return 'tablet'
  return 'desktop'
}

function isBot(): boolean {
  return /bot|crawl|spider|googlebot|bingbot|slurp|duckduck|baidu|yandex|lighthouse|headless/i.test(
    navigator.userAgent
  )
}

const SKIP_PATHS = ['/admin', '/api', '/login']

export function AnalyticsTracker() {
  const pathname = usePathname()
  const sentRef = useRef(false)

  useEffect(() => {
    if (isBot()) return
    if (SKIP_PATHS.some((p) => pathname.startsWith(p))) return

    sentRef.current = false
    const visitorId = getOrCreateCookie('_avid', 365)
    const sessionId = getSessionId()
    const deviceType = getDeviceType()
    const startTime = Date.now()
    const title = document.title
    const referrer = document.referrer || null

    const send = (isUnload: boolean) => {
      if (sentRef.current) return
      sentRef.current = true
      const payload = JSON.stringify({
        type: 'pageview',
        visitorId,
        sessionId,
        pagePath: pathname,
        pageTitle: title,
        referrer,
        deviceType,
        durationMs: Math.round(Date.now() - startTime),
      })
      if (isUnload) {
        navigator.sendBeacon('/api/analytics/track', payload)
      } else {
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    }

    const handleUnload = () => send(true)
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      send(false)
    }
  }, [pathname])

  return null
}
