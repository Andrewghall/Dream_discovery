/**
 * Export Journey Map as landscape PDF or PNG
 *
 * GET /api/admin/workshops/[id]/export-journey?format=pdf|png
 *
 * Uses @sparticuz/chromium + puppeteer-core (same stack as sales PDF route).
 * Renders the journey grid as a self-contained HTML page in landscape and
 * exports it as A3 landscape PDF (default) or full-width PNG.
 */

import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function esc(s: any): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Journey HTML builder ────────────────────────────────────────────────────

function buildJourneyHtml(
  workshopName: string,
  orgName: string,
  journey: any,
  primaryColor: string,
): string {
  const { stages = [], actors = [], interactions = [] } = journey;

  const SENTIMENT: Record<string, { bg: string; border: string; text: string }> = {
    positive:  { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    neutral:   { bg: '#f8fafc', border: '#cbd5e1', text: '#475569' },
    concerned: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    critical:  { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  };

  function getInteractions(actorName: string, stage: string) {
    return interactions.filter(
      (i: any) =>
        i.actor?.toLowerCase() === actorName?.toLowerCase() &&
        i.stage?.toLowerCase() === stage?.toLowerCase(),
    );
  }

  // Header row
  const stageHeaders = stages
    .map(
      (s: string) =>
        `<th style="padding:10px 8px;font-size:9pt;font-weight:700;color:white;background:${esc(primaryColor)};text-align:center;border:1px solid rgba(255,255,255,0.2);white-space:nowrap;min-width:130px;">${esc(s)}</th>`,
    )
    .join('');

  // Actor rows
  const actorRows = actors
    .map((actor: any) => {
      const cells = stages
        .map((stage: string) => {
          const cellItems = getInteractions(actor.name, stage);
          if (!cellItems.length) {
            return `<td style="padding:6px;border:1px solid #e2e8f0;background:#fafafa;vertical-align:top;"></td>`;
          }
          const cards = cellItems
            .map((i: any) => {
              const s = SENTIMENT[i.sentiment] || SENTIMENT.neutral;
              const flags = [
                i.isPainPoint ? `<span style="font-size:7pt;font-weight:700;color:#dc2626;">⚠ PAIN</span>` : '',
                i.isMomentOfTruth ? `<span style="font-size:7pt;font-weight:700;color:#d97706;">★ MOT</span>` : '',
              ]
                .filter(Boolean)
                .join(' &nbsp;');
              const action = (i.action || '').substring(0, 100);
              return `<div style="background:${s.bg};border:1px solid ${s.border};border-radius:5px;padding:5px 7px;margin-bottom:4px;font-size:7.5pt;color:${s.text};line-height:1.4;">
                ${flags ? `<div style="margin-bottom:2px;">${flags}</div>` : ''}
                ${esc(action)}${i.action?.length > 100 ? '…' : ''}
              </div>`;
            })
            .join('');
          return `<td style="padding:6px;border:1px solid #e2e8f0;vertical-align:top;">${cards}</td>`;
        })
        .join('');

      return `<tr>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;vertical-align:middle;white-space:nowrap;">
          <div style="font-weight:700;font-size:8.5pt;color:#1e293b;">${esc(actor.name)}</div>
          <div style="font-size:7.5pt;color:#64748b;margin-top:1px;">${esc(actor.role || '')}</div>
          ${typeof actor.mentionCount === 'number' ? `<div style="font-size:7pt;color:#94a3b8;margin-top:2px;">${actor.mentionCount} mentions</div>` : ''}
        </td>
        ${cells}
      </tr>`;
    })
    .join('');

  // Stats
  const painCount = interactions.filter((i: any) => i.isPainPoint).length;
  const motCount = interactions.filter((i: any) => i.isMomentOfTruth).length;
  const sentimentCounts = interactions.reduce((acc: any, i: any) => {
    acc[i.sentiment || 'neutral'] = (acc[i.sentiment || 'neutral'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const legendItems = Object.entries(SENTIMENT)
    .map(
      ([key, val]) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:16px;font-size:7.5pt;color:#475569;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${val.bg};border:1px solid ${val.border};"></span>
          ${key.charAt(0).toUpperCase() + key.slice(1)} (${sentimentCounts[key] || 0})
        </span>`,
    )
    .join('');

  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Journey Map — ${esc(workshopName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: white;
      color: #1e293b;
      padding: 20px 24px 28px;
    }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:3px solid ${esc(primaryColor)};">
    <div>
      <div style="font-size:8pt;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:4px;">Journey Map</div>
      <div style="font-size:16pt;font-weight:800;color:${esc(primaryColor)};line-height:1.1;">${esc(workshopName)}</div>
      ${orgName ? `<div style="font-size:9pt;color:#64748b;margin-top:2px;">${esc(orgName)}</div>` : ''}
    </div>
    <div style="text-align:right;font-size:8pt;color:#94a3b8;">
      <div style="margin-bottom:2px;">${dateStr}</div>
      <div style="display:flex;gap:16px;margin-top:6px;">
        <span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:9999px;font-size:7.5pt;font-weight:600;">⚠ ${painCount} Pain Points</span>
        <span style="background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:9999px;font-size:7.5pt;font-weight:600;">★ ${motCount} Moments of Truth</span>
        <span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:9999px;font-size:7.5pt;font-weight:600;">${actors.length} Actors · ${stages.length} Stages</span>
      </div>
    </div>
  </div>

  <!-- Journey grid -->
  <table>
    <thead>
      <tr>
        <th style="padding:10px 10px;font-size:9pt;font-weight:700;color:white;background:#1e293b;text-align:left;border:1px solid rgba(255,255,255,0.1);white-space:nowrap;min-width:130px;">Actor</th>
        ${stageHeaders}
      </tr>
    </thead>
    <tbody>
      ${actorRows || '<tr><td colspan="999" style="padding:2rem;text-align:center;color:#94a3b8;">No interactions recorded</td></tr>'}
    </tbody>
  </table>

  <!-- Legend -->
  <div style="margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:4px;">
    <span style="font-size:7.5pt;color:#94a3b8;margin-right:8px;font-weight:600;">SENTIMENT:</span>
    ${legendItems}
  </div>
</body>
</html>`;
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;

    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role, auth.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const format = request.nextUrl.searchParams.get('format') === 'png' ? 'png' : 'pdf';

    // Fetch workshop + latest live session version
    const [workshop, latestVersion] = await Promise.all([
      prisma.workshop.findUnique({
        where: { id: workshopId },
        select: { name: true, organization: { select: { name: true, primaryColor: true } } },
      }),
      prisma.liveSessionVersion.findFirst({
        where: { workshopId },
        orderBy: { createdAt: 'desc' },
        select: { payload: true },
      }),
    ]);

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    const payload = latestVersion?.payload as any;
    const liveJourney = payload?.liveJourney;

    if (!liveJourney?.stages?.length || !liveJourney?.actors?.length) {
      return NextResponse.json(
        { error: 'No journey map data found. Complete a live session first.' },
        { status: 404 },
      );
    }

    const primaryColor = workshop.organization?.primaryColor || '#1e3a5f';
    const orgName = workshop.organization?.name || '';

    const html = buildJourneyHtml(workshop.name, orgName, liveJourney, primaryColor);

    // Launch Puppeteer
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: null,
    });

    try {
      const page = await browser.newPage();
      await page.emulateMediaType('screen');

      // Set wide viewport for landscape
      await page.setViewport({ width: 1587, height: 1123, deviceScaleFactor: 2 });

      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const slug = workshop.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      if (format === 'png') {
        // Full-page screenshot at 2× for crisp output
        const screenshot = await page.screenshot({
          fullPage: true,
          type: 'png',
          omitBackground: false,
        });

        return new NextResponse(new Uint8Array(screenshot as unknown as ArrayBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': `attachment; filename="${slug}-journey-map.png"`,
          },
        });
      } else {
        // A3 landscape PDF — wide enough for all stages
        const pdf = await page.pdf({
          format: 'A3',
          landscape: true,
          printBackground: true,
          margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
        });

        return new NextResponse(new Uint8Array(pdf as unknown as ArrayBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${slug}-journey-map.pdf"`,
          },
        });
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('[export-journey] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate journey export' },
      { status: 500 },
    );
  }
}
