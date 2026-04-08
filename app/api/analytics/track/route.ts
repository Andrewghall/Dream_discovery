import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BOT_UA = /bot|crawl|spider|googlebot|bingbot|slurp|duckduck|baidu|yandex|lighthouse|headless/i

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent') ?? ''
    if (BOT_UA.test(ua)) return NextResponse.json({ ok: true })

    let body: Record<string, unknown>
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      body = await req.json()
    } else {
      // sendBeacon sends text/plain
      const text = await req.text()
      body = JSON.parse(text)
    }

    const { type, visitorId, sessionId, pagePath, pageTitle, referrer, deviceType, durationMs } =
      body as Record<string, string | number | null>

    if (!visitorId || !sessionId || !pagePath) {
      return NextResponse.json({ ok: true })
    }

    // Country from Vercel edge headers
    const country = req.headers.get('x-vercel-ip-country') ?? null

    // Filter: only track public pages
    const path = String(pagePath)
    if (path.startsWith('/admin') || path.startsWith('/api') || path === '/login') {
      return NextResponse.json({ ok: true })
    }

    await prisma.analyticsEvent.create({
      data: {
        type: String(type ?? 'pageview'),
        visitorId: String(visitorId),
        sessionId: String(sessionId),
        pagePath: path,
        pageTitle: pageTitle ? String(pageTitle) : null,
        referrer: referrer ? String(referrer) : null,
        deviceType: deviceType ? String(deviceType) : null,
        durationMs: durationMs ? Number(durationMs) : null,
        country,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Never error to the client — analytics should be silent
    console.error('[analytics/track]', err)
    return NextResponse.json({ ok: true })
  }
}
