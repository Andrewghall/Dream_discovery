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
      // In production: hard crash — misconfigured secrets must not silently run.
      // In development: log and continue so local dev is not blocked.
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}
