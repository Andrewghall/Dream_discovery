/**
 * DREAM POCTR Capability Maturity Assessment  -  Public API
 *
 * POST: Validate submission, generate PDF via Puppeteer, email via Resend.
 * Public endpoint  -  rate-limited by IP (5 per hour).
 */

import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { generateAssessmentPdfHtml, type AssessmentPdfData } from '@/lib/dream-landing/assessment-pdf';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* ── Rate Limiter ─────────────────────────────────────────── */

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);

/* ── Validation ───────────────────────────────────────────── */

const VALID_DOMAINS = ['People', 'Organisation', 'Customer', 'Technology', 'Regulation'];
const VALID_LEVELS = ['Ad Hoc', 'Emerging', 'Defined', 'Managed', 'Leading'];

interface DomainScore {
  domain: string;
  score: number;
  levelName: string;
  levelDescriptor: string;
  nextLevelName: string;
  nextLevelDescriptor: string;
}

interface SubmissionPayload {
  name: string;
  email: string;
  organisation?: string;
  scores: DomainScore[];
  overallScore: number;
  overallLevelName: string;
  recommendation: string;
}

function validatePayload(body: unknown): SubmissionPayload | string {
  if (!body || typeof body !== 'object') return 'Invalid request body';
  const b = body as Record<string, unknown>;

  const name = String(b.name || '').trim();
  if (!name || name.length > 200) return 'Name is required (max 200 characters)';

  const email = String(b.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Valid email is required';

  const organisation = b.organisation ? String(b.organisation).trim().slice(0, 200) : undefined;

  if (!Array.isArray(b.scores) || b.scores.length !== 5) return 'Scores must contain exactly 5 domains';

  const scores = (b.scores as Array<Record<string, unknown>>).map((s) => {
    const domain = String(s.domain || '');
    const score = Number(s.score);
    const levelName = String(s.levelName || '');
    const levelDescriptor = String(s.levelDescriptor || '');
    const nextLevelName = String(s.nextLevelName || '');
    const nextLevelDescriptor = String(s.nextLevelDescriptor || '');
    if (!VALID_DOMAINS.includes(domain)) return null;
    if (score < 1 || score > 5) return null;
    if (!VALID_LEVELS.includes(levelName)) return null;
    return { domain, score, levelName, levelDescriptor, nextLevelName, nextLevelDescriptor };
  });

  if (scores.some((s) => s === null)) return 'Invalid domain scores (must be 1-5 with valid maturity level)';

  const overallScore = Number(b.overallScore);
  if (overallScore < 1 || overallScore > 5) return 'Invalid overall score';

  const overallLevelName = String(b.overallLevelName || '');
  if (!VALID_LEVELS.includes(overallLevelName)) return 'Invalid overall maturity level';

  const recommendation = String(b.recommendation || '');
  if (!['Foundation', 'Acceleration', 'Optimisation'].includes(recommendation))
    return 'Invalid recommendation type';

  return {
    name,
    email,
    organisation,
    scores: scores as DomainScore[],
    overallScore,
    overallLevelName,
    recommendation,
  };
}

/* ── POST Handler ─────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }

    // Parse & validate
    const body = await request.json();
    const result = validatePayload(body);

    if (typeof result === 'string') {
      return NextResponse.json({ error: result }, { status: 400 });
    }

    const payload = result;

    // Build PDF data
    const reportDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const pdfData: AssessmentPdfData = {
      name: payload.name,
      organisation: payload.organisation,
      date: reportDate,
      domains: payload.scores,
      overallScore: payload.overallScore,
      overallLevelName: payload.overallLevelName,
      recommendation: payload.recommendation as 'Foundation' | 'Acceleration' | 'Optimisation',
    };

    const html = generateAssessmentPdfHtml(pdfData);

    // Generate PDF via Puppeteer
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: { width: 1280, height: 720 },
    });

    let pdfBuffer: Buffer;

    try {
      const page = await browser.newPage();
      await page.emulateMediaType('screen');
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
      });

      pdfBuffer = Buffer.from(pdf);
    } finally {
      await browser.close();
    }

    // Send email with PDF attachment via Resend
    const emailHtml = buildConfirmationEmail(payload.name, payload.recommendation, payload.overallLevelName);

    // Use the raw Resend client for attachment support
    const { Resend } = await import('resend');
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('[Assessment] RESEND_API_KEY not configured');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

    const { error: emailError } = await resend.emails.send({
      from: `DREAM Assessment <${fromEmail.includes('<') ? fromEmail.split('<')[1].replace('>', '') : fromEmail}>`,
      to: [payload.email],
      subject: 'Your DREAM Transformation Readiness Report',
      html: emailHtml,
      attachments: [
        {
          filename: 'DREAM-Transformation-Readiness-Report.pdf',
          content: pdfBuffer.toString('base64'),
        },
      ],
    });

    if (emailError) {
      console.error('[Assessment] Email send error:', emailError);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    console.log(
      `[Assessment] Report sent to ${payload.email} (${payload.name}, ${payload.organisation || 'no org'}, maturity: L${Math.round(payload.overallScore)} ${payload.overallLevelName})`,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Assessment] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 },
    );
  }
}

/* ── Confirmation Email HTML ──────────────────────────────── */

function buildConfirmationEmail(name: string, focus: string, levelName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc;">
  <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #0d0d0d; border-radius: 16px; padding: 32px; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background: #5cf28e; display: inline-block;"></span>
        <span style="color: #fff; font-weight: 700; font-size: 14px;">ETHENTA DREAM</span>
      </div>
      <h1 style="color: #fff; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Your Transformation Readiness Report</h1>
      <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin: 0;">
        Hi ${escHtml(name)}, your POCTR Transformation Readiness report is attached as a PDF. Your organisation assessed at maturity level <strong style="color: #5cf28e;">${escHtml(levelName)}</strong>.
      </p>
    </div>
    <div style="background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 24px; margin-bottom: 20px;">
      <p style="font-size: 13px; line-height: 1.7; color: #475569; margin: 0 0 16px;">
        Based on your assessment, we recommend a <strong>${escHtml(focus)}</strong> workshop approach.
        The attached report contains your full maturity profile, domain breakdown, next-level recommendations, and personalised workshop guidance.
      </p>
      <p style="font-size: 13px; line-height: 1.7; color: #475569; margin: 0;">
        Ready to explore your results in more detail? Book a demo with our team.
      </p>
    </div>
    <div style="text-align: center; padding: 8px 0;">
      <a href="mailto:hello@ethenta.com?subject=DREAM%20Assessment%20%E2%80%94%20Book%20a%20Demo"
         style="display: inline-block; background: #5cf28e; color: #0d0d0d; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 10px; text-decoration: none;">
        Book a Demo
      </a>
    </div>
    <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px;">
      Ethenta  -  Decision Intelligence for Transformation
    </p>
  </div>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
