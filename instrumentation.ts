/**
 * instrumentation.ts
 *
 * Next.js 15+ server startup hook (runs once per server process, nodejs runtime only).
 * Validates required secrets at startup so misconfiguration fails fast rather than
 * silently producing insecure behavior at request time.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the Node.js server runtime — not in Edge or browser environments
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateSecrets } = await import('@/lib/compliance/secrets-guard');
    try {
      const result = validateSecrets();
      if (result.warnings.length > 0) {
        console.warn('[startup] Secret validation warnings:\n' + result.warnings.map((w) => `  • ${w}`).join('\n'));
      }
    } catch (err) {
      console.error('[startup] Secret validation FAILED:', err);
      // Hard crash only on the true Vercel production deployment.
      // Vercel sets NODE_ENV=production on ALL deployments (including preview/pre-live),
      // so we use VERCEL_ENV to distinguish true production from preview branches.
      // Outside Vercel (e.g. self-hosted), fall back to NODE_ENV=production.
      const isTrueProduction =
        process.env.VERCEL_ENV === 'production' ||
        (!process.env.VERCEL && process.env.NODE_ENV === 'production');
      if (isTrueProduction) {
        process.exit(1);
      }
    }
  }
}
