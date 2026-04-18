import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    // Content-Security-Policy:
    //   - script-src includes 'unsafe-inline' because Next.js inlines bootstrap scripts
    //     at build time. Tighten to nonce-based CSP once nonce middleware is wired in.
    //   - connect-src includes Supabase (storage uploads from browser) and wss:// for
    //     Supabase Realtime channels. Railway CaptureAPI is server-to-server; not needed here.
    //   - media-src includes blob: for the TTS audio blob URLs created client-side.
    const csp = [
      "default-src 'self'",
      // 'unsafe-eval' is NOT included — Next.js production builds don't require it.
      // It is only needed in dev mode (HMR). Removing it strengthens XSS protection.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          // HSTS: 1 year, include subdomains. Only effective over HTTPS (Vercel always serves HTTPS).
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
