import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: path.resolve(process.cwd()),
  },
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
    //   - connect-src includes Supabase (storage/realtime) AND Railway CaptureAPI.
    //     The live session page opens a WebSocket directly from the browser to CaptureAPI
    //     for real-time PCM audio streaming — it is NOT server-to-server.
    //   - media-src includes blob: for the TTS audio blob URLs created client-side.
    const captureApiUrl = process.env.NEXT_PUBLIC_CAPTUREAPI_URL || 'https://captureapi-production.up.railway.app';
    const captureApiWss = captureApiUrl.replace(/^https?:\/\//, 'wss://');
    const captureApiHttps = captureApiUrl.replace(/^https?:\/\//, 'https://');
    const isDev = process.env.NODE_ENV === 'development';
    const csp = [
      "default-src 'self'",
      // 'unsafe-eval' is required in dev mode for React error overlays and HMR.
      // Excluded in production to strengthen XSS protection.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${captureApiHttps} ${captureApiWss}`,
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
